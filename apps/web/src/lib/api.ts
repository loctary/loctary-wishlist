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
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string;
  priority: number;
  position: number;
  status: ItemStatus;
  createdAt: string;
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

/* ----------------------------- public ----------------------------- */

export function listItems(params: { owner?: string; cursor?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.owner) q.set("owner", params.owner);
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return request<ItemsPage>(`/wishlist/items${qs ? `?${qs}` : ""}`);
}

export function getItem(id: string) {
  return request<{ item: WishItem }>(`/wishlist/items/${id}`);
}

/** A user's public profile — display name + avatar (no email). */
export interface PublicUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export function getUser(id: string) {
  return request<{ user: PublicUser }>(`/wishlist/users/${id}`);
}

/* ----------------------------- user ------------------------------- */

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

/* --------------------- manage (your own list) --------------------- */

export interface ItemInput {
  title: string;
  description?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  currency?: string;
  priority?: number;
  position?: number;
}

/** The caller's own list (always `owner = caller`), incl. who reserved each item. */
export function manageListItems() {
  return request<{ items: AdminWishItem[] }>(`/wishlist/manage/items`);
}

export function manageCreateItem(input: ItemInput) {
  return request<{ item: AdminWishItem }>(`/wishlist/manage/items`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function manageUpdateItem(id: string, input: Partial<ItemInput>) {
  return request<{ item: AdminWishItem }>(`/wishlist/manage/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function manageDeleteItem(id: string) {
  return request<{ ok: true }>(`/wishlist/manage/items/${id}`, { method: "DELETE" });
}

export function manageConfirmItem(id: string) {
  return request<{ item: AdminWishItem }>(`/wishlist/manage/items/${id}/confirm`, { method: "POST" });
}

export function manageDeclineItem(id: string) {
  return request<{ item: AdminWishItem }>(`/wishlist/manage/items/${id}/decline`, { method: "POST" });
}
