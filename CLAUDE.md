# loctary-wishlist

Monorepo (pnpm workspaces) for a public wishlist app. A TanStack Start host
(`apps/web`) embeds loctary-auth's federated pages and renders the wishlist; a
Hono backend (`apps/server`) verifies the auth session cookie and owns the data.

See [README.md](README.md) for the architecture diagram and commands, and the
per-app docs: [apps/web/CLAUDE.md](apps/web/CLAUDE.md),
[apps/server/CLAUDE.md](apps/server/CLAUDE.md).

## The model in one paragraph

loctary-auth owns identity. It sets two HttpOnly cookies on `COOKIE_DOMAIN`
(`loctary_access_token`, `loctary_refresh_token`). This app **never** sees a
password: the frontend embeds auth's login/register pages over Module Federation
and learns auth state via auth's federated `authStore`; the backend reads the access
token cookie and verifies it against Supabase to identify the caller. Both this
app and auth must share the same `COOKIE_DOMAIN` (`.loctary.com` in prod) so the
cookie is visible across subdomains.

## Conventions

- TypeScript + ESM everywhere, `verbatimModuleSyntax`. Shared base config in
  [tsconfig.base.json](tsconfig.base.json).
- The backend is the **only** place with Supabase keys. The web app talks to it
  through `apps/web/src/lib/api.ts` and to auth through `apps/web/src/lib/session.ts`.
- Mirror loctary-auth's server patterns: lazy/memoised `env.ts`, `anon()`/`admin()`
  Supabase clients, uniform `fail()` + zod `parseBody` error contract, a Node
  `index.ts` entry + a Cloudflare `worker.ts` entry that bridges bindings.
- Cookie names in `apps/server/src/cookies.ts` MUST match loctary-auth exactly —
  that is how the backend reads the session.

## Expansion

Every `wishlist_items` row has an `owner_id`, so other users can own wishlists
later. Today the index renders `WISHLIST_OWNER_ID` (the admin's uuid). Future
per-user routes (`/u/:id`) just pass a different owner.
