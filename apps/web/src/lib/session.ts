import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Session for the host. The wishlist backend's `GET /wishlist/me` is the single
 * source: it reads the shared auth cookie (so it confirms login) AND reports the
 * role (so the host can gate admin UI). Logout is delegated to auth, which owns
 * the cookie.
 */
const WISHLIST_API = (import.meta.env.VITE_WISHLIST_API_URL ?? "http://localhost:3003").replace(/\/$/, "");
const AUTH_API = (import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:3002").replace(/\/$/, "");

export interface SessionUser {
  id: string;
  email: string | null;
  role: "user" | "admin";
}

export const sessionQueryKey = ["session"] as const;

export async function fetchSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch(`${WISHLIST_API}/wishlist/me`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: SessionUser | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    staleTime: 30_000,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return async () => {
    try {
      await fetch(`${AUTH_API}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      /* ignore — we clear local state regardless */
    }
    await qc.invalidateQueries({ queryKey: sessionQueryKey });
  };
}
