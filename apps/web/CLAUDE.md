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
when logged out, or top-nav links (My wishlists → `/user/$id/wishlists`, Reserved →
`/reserved`) plus a user-avatar `Menu` (Profile / Log out) when logged in. The
host no longer reads `role` — every gate left in the UI is ownership-based and
the backend enforces the rest.

## Routes (`src/routes/`)

| Route | What |
| ----- | ---- |
| `/` | coming-soon stub with Log in / Register CTAs (or "Go to my wishlists" when signed in). The public wishlist directory will live here eventually. |
| `/user/$userId` | the user's public page — `UserPage` in `src/components/UserPage.tsx` (renders `OwnerUserPage` for self, `VisitorUserPage` otherwise). Header (avatar + title + "Joined …") over a 2-col tile grid of wishlists. Owner gets "+ Add wishlist" + per-tile edit/hide/delete menu and sees hidden lists dimmed with a badge; visitor sees only ACTIVE lists. |
| `/user/$userId/wishlists/$wishlistId` | one wishlist's items. Owner → `OwnerWishlist` (add-item flow scoped to this list + per-item toolset); visitor → cover/title/description + reservable `WishlistGrid wishlistId={wishlistId}` |
| `/user/$userId/wishlists/$wishlistId/$itemId` | single item detail; states which list it's on; reserve hidden for the owner |
| `/reserved` | the caller's own reservations, grouped by list-owner (logged-in only) |
| `/login` `/register` `/forgot-password` `/reset-password` `/verify-email` | one embedded auth page each via `AuthScreen page=…` (redirects home if already logged in) |
| `/profile` | embedded read-only profile via `ProfileScreen` (redirects to /login if logged out) |

Every user owns any number of **wishlists**; each item belongs to exactly one
list. The user's page (`UserPage.tsx`) is the entry point — visitor + owner
variants share layout but the owner branch adds the "+ Add wishlist" button and
per-tile CRUD via `WishlistFormModal`. Clicking a tile navigates to the
`WishlistView.tsx` (single list), which hands off to `OwnerWishlist.tsx` when
the viewer owns the profile, else to `WishlistGrid.tsx` (public infinite scroll,
list-scoped).

The owner-side toolset (approve / cancel reservation, hide/show, edit, delete,
plus the reserver line) is a single component `src/components/OwnerItemActions.tsx`,
used both as each `WishlistCard` footer in `OwnerWishlist` *and* on the item
detail page when the viewer is the owner. The detail page pulls the admin
projection it needs from the shared `["manage-items", wishlistId]` cache
(instant if the user came from their wishlist, otherwise one extra fetch).
Add-item is scoped to a specific list — moving items between lists isn't a v1
flow.

The app shell (`__root.tsx`) is a full-height flex column (header + `flex:1`
`main`), so short pages (auth, profile) center in the viewport.

## Images

Each **item** carries up to 3 image URLs (`item.images: string[]`, ordered,
index 0 is the cover) served from R2. Each **wishlist** carries an optional
`coverImageUrl` shown on its tile + page header. Everything goes through the
same staging endpoint (`POST /wishlist/manage/images/upload`) — the client
picks → crops 4:3 via `react-easy-crop` → `getCroppedItemImage`
(`src/lib/cropImage.ts`) compresses to WebP ≤300KB → the URL is kept in local
form state and submitted with the parent record.

`ImageCropperModal` is the shared picker; `ItemForm` uses it for the 3-up
grid of item images, `WishlistFormModal` uses it for the single cover slot.
If the user closes without saving, the staged R2 object is reaped by the
nightly orphan-cleanup cron (24h grace, references BOTH `items.images` and
`wishlists.cover_image_url`).

The optional "Product URL" field points at the exact store page (right
variant, correct size); when set, the item detail page renders it as an
"View product page" external anchor (dropped in 0004, added back in 0006).
The form's **"Fetch from link"** button POSTs the URL to
`/wishlist/manage/scrape-url` — the server pulls OG / Twitter / JSON-LD
Product metadata off the page and returns title / description / price /
currency / a mirrored image URL. The client only fills fields the user
hasn't touched and only appends the image if a slot is free.
The "Priority"/"Position" pair was merged into a single "Priority" field
that maps to the table's `position` column (0003 dropped the old `priority`
column). 0007 then collapsed `position` to a discrete **1 (Low) / 2 (Medium)
/ 3 (High)** — rendered as 1/2/3 lightning bolts in the item form and
constrained by a DB check. Existing rows were snapped to High. Item lists
sort **active first, then priority desc, then created_at desc**. The
`wishlist_item_images` side-table was replaced by an inline `text[]` (0004).

## Data layer

- `src/lib/api.ts` — typed wishlist client (`credentials: "include"`). Throws
  `WishlistApiError` (carries `fields`) on failure.
- React Query keys: public items on a list `["items", wishlistId]`, owner's items
  on a list `["manage-items", wishlistId]`, one wishlist `["wishlist", id]`, a
  user's public wishlists `["user-wishlists", ownerId]`, owner's list-of-lists
  `["manage-wishlists"]`, public profile `["user", id]`, reservations
  `["my-reservations"]`. Mutations invalidate the ones they affect; broad
  invalidations (`["items"]`, `["manage-items"]`) match every list via prefix.

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
