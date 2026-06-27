# @loctary/wishlist-server

A **stateless Hono backend** for the wishlist. It owns the Supabase keys and the
wishlist data, and it **verifies** the session cookie loctary-auth set — it never
sees a password. Runs on **:3003** (`pnpm dev:server`) and deploys to a
Cloudflare Worker (`api.wishlist.loctary.com`).

## How auth works here

There is no login flow in this app. loctary-auth set two HttpOnly cookies on the
shared `COOKIE_DOMAIN` (`loctary_access_token`, `loctary_refresh_token`).
`src/auth.ts` reads the access token, verifies it with Supabase
(`anon().auth.getUser`), and — like auth's `/me` — silently refreshes via the
refresh token when the access token has expired (this Worker is on the same
cookie domain, so it may re-set them). The user's role **and display name** come
from `profiles` (`display_name`), not the auth `user_metadata`; only the avatar
still comes from metadata.

- `loadSession` — always-on; stashes `{ id, email, role, name, avatarUrl } | null` on the context.
- `requireUser` — 401 if no session.
- `requireAdmin` — 403 if `role !== 'admin'` (still defined; no longer used by
  any route — management is **ownership-based**, see below).

## Ownership, not admin

Every user owns a wishlist. The `/manage/*` routes act strictly on the caller's
**own** items: the `owner_id = caller.id` filter is baked into each query, so it's
atomic (a non-owner just gets a 404). The `admin` role no longer gates anything —
its only remaining meaning is that `WISHLIST_OWNER_ID` (the admin) is the list the
host's index page renders.

`src/cookies.ts` **must** keep the same cookie names/policy as loctary-auth.

## Files

| File                    | Role                                                              |
| ----------------------- | ---------------------------------------------------------------- |
| `src/index.ts`          | Node entry (`@hono/node-server`): logger, CORS, `/health`, mounts `/wishlist`. |
| `src/worker.ts`         | Cloudflare entry: same app, bridges Worker bindings → `process.env`. |
| `src/env.ts`            | Lazy, memoised config. Import `env`/`getEnv()`, never `process.env`. Adds `WISHLIST_OWNER_ID`. |
| `src/supabase.ts`       | `anon()` (verify/refresh tokens) and `admin()` (service-role; all data + role lookup). |
| `src/cookies.ts`        | Read/set/clear the session cookies. Names must match loctary-auth. |
| `src/auth.ts`           | Session verification + `requireUser` / `requireAdmin` guards.     |
| `src/routes/wishlist.ts`| All endpoints. Zod-validated, `fail()` error contract.            |

## Endpoints (under `/wishlist`)

| Method | Path                       | Guard        | Notes |
| ------ | -------------------------- | ------------ | ----- |
| GET    | `/items?owner=&cursor=&limit=` | public   | infinite list; keyset cursor over `(position, created_at, id)`; default owner = `WISHLIST_OWNER_ID`. `publicItem()` hides the reserver. **Only `is_active` items.** |
| GET    | `/items/:id`               | public       | single item (`publicItem()`); **404 for an inactive item unless you're the owner** |
| GET    | `/users/:id`               | public       | a user's public profile (`{ id, name }`; **no email**) — to label whose list it is |
| GET    | `/me/reservations`         | requireUser  | the caller's own reservations, each with its list `owner` resolved |
| POST   | `/items/:id/reserve`       | requireUser  | available → reserved; 409 if taken; idempotent for the same user; **400 if it's your own list** |
| DELETE | `/items/:id/reserve`       | requireUser  | cancel own reservation (only while `reserved`) → available |
| GET    | `/manage/items`            | requireUser  | the caller's **own** list incl. reserver id + name (**no email**) |
| POST   | `/manage/items`            | requireUser  | create (owner = caller) |
| PATCH  | `/manage/items/:id`        | requireUser + own | edit (404 if not your item) |
| POST   | `/manage/items/:id/active` | requireUser + own | show/hide (`{ active }`); **409 while reserved** |
| DELETE | `/manage/items/:id`        | requireUser + own | delete (404 if not your item); **409 if reserved or confirmed — gifted items deactivate instead** |
| POST   | `/manage/items/:id/confirm`| requireUser + own | reserved → confirmed (gift presented) |
| POST   | `/manage/items/:id/decline`| requireUser + own | reserved → available (release) |

## Error contract

Uniform JSON via `fail()`: `{ "error": "human message", "fields"?: { field: msg } }`.
`error` is always present (the client shows it in a notification); `fields` routes
zod validation messages to specific inputs.

## Reserve privacy

`publicItem()` exposes only `status` (`available` / `reserved` / `confirmed`),
never `reserved_by` / `reserved_at`. Only the owner's own `/manage/items` and the
caller's own `/me/reservations` reveal the reserver. Browsers see an item is taken
(no double-buying) without learning who took it; the list **owner**, however, does
see who reserved their items (so they can confirm/decline). **No endpoint ever
returns another user's email** — user objects expose only `{ id, name }`.

## Data access & RLS

All queries use `admin()` (service-role), which bypasses RLS; authorization is
done in middleware. RLS is enabled in the migration with no policies as
defense-in-depth (no direct anon/authenticated access). See
[../../supabase/migrations/0001_wishlist.sql](../../supabase/migrations/0001_wishlist.sql).

## Env

See root [.env.example](../../.env.example). Required: `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WISHLIST_OWNER_ID`. Optional:
`PORT` (3003), `COOKIE_DOMAIN`, `CORS_ALLOWED_ORIGINS`, `NODE_ENV`. Missing
required vars throw at boot.
