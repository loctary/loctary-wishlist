/**
 * Wishlist backend client. Every call uses `credentials: "include"` so the
 * shared session cookie flows to the API. Mutations return the API's uniform
 * `{ error, fields? }` shape on failure.
 */
const API = (import.meta.env.VITE_WISHLIST_API_URL ?? "http://localhost:3003").replace(/\/$/, "");

export type ItemStatus = "available" | "reserved" | "confirmed" | "declined";

/**
 * What the current viewer may do with this item — computed server-side against
 * the session, so the UI can render button state up-front. Flags are true only
 * for the asker (never reveal *who* reserved an item to anyone else).
 */
export interface ItemViewerCaps {
  isOwner: boolean;
  isReserver: boolean;
  canReserve: boolean;
  canCancel: boolean;
}

/** Public projection (what the list/detail endpoints return). */
export interface WishItem {
  id: string;
  ownerId: string;
  wishlistId: string;
  title: string;
  description: string | null;
  /** Optional external product URL (e.g. the store page). */
  url: string | null;
  price: number | null;
  currency: string;
  /** Priority: 1 (Low), 2 (Medium), 3 (High). Higher sorts first. */
  position: 1 | 2 | 3;
  status: ItemStatus;
  /** Visible on the public list? Inactive items are owner-only. */
  isActive: boolean;
  createdAt: string;
  /** Up to 3 ordered image URLs. Index 0 is the card cover / carousel preview. */
  images: string[];
  viewer: ItemViewerCaps;
}

/** Owner projection — adds the reservation + who made it (id + name, no email). */
export interface AdminWishItem extends WishItem {
  reservedBy: string | null;
  reservedAt: string | null;
  reserver: { id: string; name: string | null } | null;
  updatedAt: string;
}

export interface ItemsPage {
  items: WishItem[];
  nextCursor: string | null;
}

/* --- wishlists ------------------------------------------------------------ */

/** Public projection of a wishlist. Only active lists are returned publicly. */
export interface Wishlist {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  /** Priority: 1 (Low), 2 (Medium), 3 (High). Higher sorts first. */
  position: 1 | 2 | 3;
  createdAt: string;
  /** Number of ACTIVE items on this list (what visitors will see). */
  itemsCount: number;
  /** Number of items that have been claimed (reserved or gifted). */
  reservedCount: number;
}

/** Owner projection — adds `isActive` + `updatedAt`. */
export interface AdminWishlist extends Wishlist {
  isActive: boolean;
  updatedAt: string;
}

export interface WishlistInput {
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  isActive?: boolean;
  /** Priority: 1 (Low), 2 (Medium), 3 (High). Defaults to 3 on the server. */
  position?: 1 | 2 | 3;
}

/* --- errors --------------------------------------------------------------- */

export interface ApiError {
  error: string;
  fields?: Record<string, string>;
}

export class WishlistApiError extends Error {
  fields?: Record<string, string>;
  status: number;
  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = "WishlistApiError";
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const body = payload as Partial<ApiError>;
    throw new WishlistApiError(body.error ?? "Something went wrong", res.status, body.fields);
  }
  return payload as T;
}

/* ---------------------------- wishlists --------------------------- */

// Public user profiles are served by the auth backend; see `lib/user.ts`.

/** Public: a user's active wishlists (list-of-lists on their profile page). */
export function listUserWishlists(ownerId: string) {
  return request<{ wishlists: Wishlist[] }>(`/wishlist/wishlists?owner=${encodeURIComponent(ownerId)}`);
}

/**
 * Single wishlist. Response is either the public projection or the admin one
 * depending on whether the viewer owns it; consumers should type-check `isActive`
 * before using owner-only fields.
 */
export function getWishlist(id: string) {
  return request<{ wishlist: Wishlist | AdminWishlist }>(`/wishlist/wishlists/${id}`);
}

/** Owner: every list on the caller's account, including inactive. */
export function manageListWishlists() {
  return request<{ wishlists: AdminWishlist[] }>(`/wishlist/manage/wishlists`);
}

export function manageCreateWishlist(input: WishlistInput) {
  return request<{ wishlist: AdminWishlist }>(`/wishlist/manage/wishlists`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function manageUpdateWishlist(id: string, input: Partial<WishlistInput>) {
  return request<{ wishlist: AdminWishlist }>(`/wishlist/manage/wishlists/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function manageDeleteWishlist(id: string) {
  return request<{ ok: true }>(`/wishlist/manage/wishlists/${id}`, { method: "DELETE" });
}

export function manageSetWishlistActive(id: string, active: boolean) {
  return request<{ wishlist: AdminWishlist }>(`/wishlist/manage/wishlists/${id}/active`, {
    method: "POST",
    body: JSON.stringify({ active }),
  });
}

/* ----------------------------- items ------------------------------ */

/** Public paginated items in a wishlist. */
export function listItems(params: { wishlist: string; cursor?: string; limit?: number }) {
  const q = new URLSearchParams({ wishlist: params.wishlist });
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", String(params.limit));
  return request<ItemsPage>(`/wishlist/items?${q.toString()}`);
}

export function getItem(id: string) {
  return request<{ item: WishItem }>(`/wishlist/items/${id}`);
}

export function reserveItem(id: string) {
  return request<{ item: WishItem }>(`/wishlist/items/${id}/reserve`, { method: "POST" });
}

export function cancelReservation(id: string) {
  return request<{ item: WishItem }>(`/wishlist/items/${id}/reserve`, { method: "DELETE" });
}

/** A reservation of the caller's, with the list-owner resolved for grouping. */
export interface ReservedWishItem extends WishItem {
  reservedAt: string | null;
  owner: { id: string; name: string | null };
}

export function myReservations() {
  return request<{ items: ReservedWishItem[] }>(`/wishlist/me/reservations`);
}

/* --------------------- manage (your items) ------------------------ */

export interface ItemInput {
  /** Required on create; not editable (moving items between lists isn't a v1 flow). */
  wishlistId?: string;
  title: string;
  description?: string | null;
  /** Optional external product URL. Empty string is treated as null server-side. */
  url?: string | null;
  price?: number | null;
  currency?: string;
  /** Priority: 1 (Low), 2 (Medium), 3 (High). Defaults to 3 on the server. */
  position?: 1 | 2 | 3;
  isActive?: boolean;
  /** Up to 3 image URLs (must already be uploaded via `uploadImage`). */
  images?: string[];
}

/** All the caller's items on one of their own lists (includes reserver identity). */
export function manageListItems(wishlistId: string) {
  return request<{ items: AdminWishItem[] }>(`/wishlist/manage/items?wishlist=${encodeURIComponent(wishlistId)}`);
}

export function manageCreateItem(input: ItemInput & { wishlistId: string }) {
  return request<{ item: AdminWishItem }>(`/wishlist/manage/items`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function manageUpdateItem(id: string, input: Partial<ItemInput>) {
  const { wishlistId: _drop, ...body } = input;
  return request<{ item: AdminWishItem }>(`/wishlist/manage/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function manageDeleteItem(id: string) {
  return request<{ ok: true }>(`/wishlist/manage/items/${id}`, { method: "DELETE" });
}

/** Show/hide an item on your own list. Rejected (409) while it's reserved. */
export function manageSetActive(id: string, active: boolean) {
  return request<{ item: AdminWishItem }>(`/wishlist/manage/items/${id}/active`, {
    method: "POST",
    body: JSON.stringify({ active }),
  });
}

export function manageConfirmItem(id: string) {
  return request<{ item: AdminWishItem }>(`/wishlist/manage/items/${id}/confirm`, { method: "POST" });
}

export function manageDeclineItem(id: string) {
  return request<{ item: AdminWishItem }>(`/wishlist/manage/items/${id}/decline`, { method: "POST" });
}

/* --------------------- product-URL scrape ------------------------ */

/**
 * Ask the server to fetch a product URL and pull whatever it can from OG /
 * Twitter Card / JSON-LD. Every field is optional — the form fills in what's
 * present and leaves the rest to the user. `imageUrl` is already mirrored
 * into R2, so it can be dropped straight into `images[]`.
 */
export interface ScrapedProduct {
  title: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
}

export function scrapeProductUrl(url: string) {
  return request<ScrapedProduct>(`/wishlist/manage/scrape-url`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

/* ---------------------------- images ----------------------------- */

/**
 * Stage one cropped+compressed image (≤300KB) to R2 and get a public URL back.
 * The url isn't yet attached to any record — the caller stores it in the form's
 * local state and submits it with the item / wishlist. Images uploaded but
 * never attached are removed by the nightly orphan-cleanup cron.
 */
export async function uploadImage(blob: Blob): Promise<{ url: string }> {
  const res = await fetch(`${API}/wishlist/manage/images/upload`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const body = payload as Partial<ApiError>;
    throw new WishlistApiError(body.error ?? "Could not upload the image", res.status, body.fields);
  }
  return payload as { url: string };
}
