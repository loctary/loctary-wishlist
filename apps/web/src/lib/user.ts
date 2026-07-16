import { useQuery } from "@tanstack/react-query";

/**
 * Same shape as auth's `/auth/me` **minus `email`**, plus `createdAt` from the
 * `profiles` row so the UI can render "joined March 2026". Fetched directly
 * from the auth backend (single source of truth for identity + avatar rules)
 * so we don't have to re-implement the "profile avatar → Google avatar" fallback
 * in this app's backend.
 */
export interface PublicUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  /** Sign-in methods linked to the account, e.g. ["google","email"]. */
  providers: string[];
  /** ISO timestamp of when they joined. */
  createdAt: string | null;
}

const AUTH_API = (import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:3002").replace(/\/$/, "");

async function fetchAuthUser(id: string): Promise<PublicUser | null> {
  const res = await fetch(`${AUTH_API}/auth/users/${encodeURIComponent(id)}`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { user: PublicUser | null };
  return body.user ?? null;
}

/**
 * Fetch a user's public profile from the **auth** backend. Shared by every
 * screen that renders someone else's identity (user page, wishlist header,
 * item detail). Cached under `["auth-user", id]`; profile data doesn't change
 * often so `staleTime: Infinity` — mutations that touch a profile can
 * invalidate the key explicitly.
 */
export function useWishlistUser(id: string) {
  const query = useQuery({
    queryKey: ["auth-user", id],
    queryFn: () => fetchAuthUser(id),
    staleTime: Infinity,
  });
  return {
    user: query.data ?? undefined,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
