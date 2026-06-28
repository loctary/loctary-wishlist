# @loctary/wishlist-web

TanStack Start (SSR React + Mantine) host. Renders the public wishlist + admin
UI and embeds loctary-auth's login/register/… pages as a **Module Federation
remote**. Dev on **:3000**; deploys to a Cloudflare Worker (`wishlist.loctary.com`).

## Federation: native ESM import, mounted, client-only

We do NOT use the MF Vite plugin (keeps MF decoupled from Start's Vite/Nitro
build). loctary-auth's `remoteEntry.js` is an **ES module** built by
`@module-federation/vite`. `@module-federation/runtime`'s default loader injects
it as a classic `<script>` and can't read ESM exports → RUNTIME-001. Because the
remote **shares nothing**, there's no share-scope to negotiate, so
`src/lib/remoteAuth.ts` skips that loader: it pulls the container in with a native
dynamic `import()` (which parses ESM) and drives the MF container contract
(`init({})` → `get("./mount")`) directly.

The remote bundles its own React, so we **cannot** render its exposed page
*components* in our React tree (dual-React → "invalid hook call"). Instead we use
loctary-auth's imperative **`./mountPage`** entry and call `mount(el, { page, … })`
into a div (`src/components/RemoteAuthPage.tsx`). It runs in the browser only
(inside `useEffect`), so nothing federated executes during SSR.

> Cross-origin: native module import is CORS-gated. Auth's dev server sets
> `cors: true`; in prod auth's **static assets** (remoteEntry.js + /assets/*) must
> send `Access-Control-Allow-Origin` for `wishlist.loctary.com`.

**One page per route.** Each auth screen is its OWN host route mounting just its
own page (`page`: `login` | `register` | … | `profile`) — not the whole
self-routing `AuthApp`. Links between screens are wired back to the host router:
we pass `routes` (= `AUTH_PATHS` in `src/lib/authNav.ts`, so the remote builds
correct `<a href>`s) and an `onNavigate` that does `router.navigate({ to, search })`,
carrying the in-progress `email` in the route's `?email=` search param (each auth
route's `validateSearch`). On success `onAuthenticated` refreshes the session and
goes home.

## Session & roles

`src/lib/session.ts` — the single session source is the auth remote's federated
**`./authStore`** (loaded via `loadAuthStore()` in `remoteAuth.ts`). It is the
same singleton the embedded profile widget mutates on every edit, so subscribing
through `useSession()` (a 3-line `useSyncExternalStore` wrapper) means
name/avatar changes propagate to the header live — no `/wishlist/me` round-trip,
no React-Query invalidate. `useLogout()` calls auth's `POST /auth/logout` (auth
owns the cookie), then clears + refreshes the store.

The wishlist backend still enforces authorization (every mutation re-checks
ownership); the host only needs the auth uuid to drive its UI, which the
authStore already returns. The host has no `/me` endpoint of its own.

Session is resolved **client-side** (the auth remote loads in the browser; SSR
returns `{ user: null, loading: true }`). The two guards are mirror images,
both client-side: `AuthScreen` wraps the auth pages "only when logged **out**"
(logged-in → home); `ProfileScreen` wraps `/profile` "only when logged **in**"
(anonymous → /login). Both keep `RemoteAuthPage` mounted once the user is seen
— a background `authStore.invalidate()` flipping `loading` back to true must
not tear the embedded page down, or the remote's mount-time `invalidate()`
re-fires → infinite loop.

The header (`src/components/Header.tsx`) reflects session: a **Log in** button
when logged out, or top-nav links (My wishlist → `/user/$id/wishlist`, Reserved →
`/reserved`) plus a user-avatar `Menu` (Profile / Log out) when logged in. The
host no longer reads `role` — every gate left in the UI is ownership-based and
the backend enforces the rest.

## Routes (`src/routes/`)

| Route | What |
| ----- | ---- |
| `/` | always the admin's wishlist (`WISHLIST_OWNER_ID`) — `WishlistGrid` with no `owner` |
| `/user/$userId/wishlist` | a user's wishlist (public). Owner → management UI (`OwnerWishlist`: add/edit/delete + confirm/decline, sees the reserver); visitor → reservable `WishlistGrid owner={userId}` |
| `/user/$userId/wishlist/$itemId` | public single item; states whose list it's on; reserve is hidden for the owner |
| `/user/$userId` | public user page: display name + link to their wishlist |
| `/reserved` | the caller's own reservations, grouped by list-owner (logged-in only) |
| `/login` `/register` `/forgot-password` `/reset-password` `/verify-email` | one embedded auth page each via `AuthScreen page=…` (redirects home if already logged in) |
| `/profile` | embedded read-only profile via `ProfileScreen` (redirects to /login if logged out) |

Every user owns a wishlist. The infinite grid lives in
`src/components/WishlistGrid.tsx` (shared by `/` and the visitor view);
owner-mode management lives in `src/components/OwnerWishlist.tsx` (the old
`/admin` page, now keyed off ownership, not the admin role).

The owner-side toolset (approve / cancel reservation, hide/show, edit, delete,
plus the reserver line) is a single component `src/components/OwnerItemActions.tsx`,
used both as each `WishlistCard` footer in `OwnerWishlist` *and* on the item
detail page when the viewer is the owner. The detail page pulls the admin
projection it needs from the shared `["manage-items"]` cache (instant if the
user came from their wishlist, otherwise one extra fetch). `OwnerWishlist`
itself now only owns the "Add item" flow — every per-item action is delegated
to the shared component.

The app shell (`__root.tsx`) is a full-height flex column (header + `flex:1`
`main`), so short pages (auth, profile) center in the viewport.

## Item images

Each item carries up to 3 image URLs (`item.images: string[]`, ordered, index 0
is the cover) served from R2. The card cover and the item detail page render an
`ImageCarousel` (a CSS scroll-snap track with hover arrows; preview at index 0)
— the empty state falls back to the existing tinted gift icon.

The `ItemForm` Add/Edit modal manages images inline, after Description: a 3-up
grid of 4:3 thumbnails with a dashed "Select image" placeholder of the same
size while there's room. Clicking it opens `ImageCropperModal`: pick → 4:3
crop via `react-easy-crop` → `getCroppedItemImage` (`src/lib/cropImage.ts`)
compresses to WebP ≤300KB → `uploadImage` POSTs raw bytes to the staging
endpoint and returns a URL, which the form pushes into local state. Submit
sends the whole `images: string[]` with the item. If the user closes the
modal without submitting, the staged R2 objects are reaped by the server's
nightly orphan-cleanup cron (24h grace).

The "Product URL" field was dropped — the image carries the visual; an
external store link added little. The "Priority"/"Position" pair was merged
into a single "Priority" field — it maps to the table's `position` column
(the actual sort key); `priority` was dropped (migration 0003). The
`wishlist_item_images` side-table was replaced by an inline `text[]` (0004).

## Data layer

- `src/lib/api.ts` — typed wishlist client (`credentials: "include"`). Throws
  `WishlistApiError` (carries `fields`) on failure.
- React Query everywhere. Public list cache key `["items", owner]` (owner-scoped;
  `"index"` for the admin default), owner-management `["manage-items"]`, a user's
  public profile `["user", id]`, reservations `["my-reservations"]`, session
  `["session"]` — mutations invalidate the ones they affect (`ReserveButton`'s
  broad `["items"]` matches every owner via prefix).

## Theme

`src/theme.ts` (brand orange, matches auth). `src/lib/colorScheme.ts` is a
cookie-backed color-scheme manager writing the domain-wide `mode` cookie
(`VITE_COOKIE_DOMAIN`) shared with the embedded auth widget.

## Conventions

- The router is created in `src/router.tsx` (`getRouter`, required by Start). The
  root document + providers live in `src/routes/__root.tsx`. `src/routeTree.gen.ts`
  is generated by the Start plugin on `vite dev`/`build` — don't edit it.
- Prefer `router.navigate({ to })` / `<Link>` / `<Anchor component={Link}>` over
  hand-built hrefs.

## Env (build-time, public)

`VITE_AUTH_API_URL`, `VITE_AUTH_REMOTE_ENTRY`, `VITE_AUTH_REMOTE_NAME`,
`VITE_WISHLIST_API_URL`, `VITE_COOKIE_DOMAIN`. See root [.env.example](../../.env.example).
