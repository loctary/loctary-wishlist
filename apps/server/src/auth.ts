import type { Context, MiddlewareHandler } from "hono";
import { anon, admin } from "./supabase.js";
import {
  clearSessionCookies,
  readSessionCookies,
  setSessionCookies,
} from "./cookies.js";

/**
 * Session verification against the cookies loctary-auth set. This backend never
 * sees a password — it reads `loctary_access_token`, verifies it with Supabase,
 * and (like auth's `/me`) silently refreshes via `loctary_refresh_token` when
 * the access token has expired. The user's role comes from `profiles`.
 */

export type Role = "user" | "admin";

export interface SessionUser {
  id: string;
  email: string | null;
  role: Role;
  /** Display name from the `profiles` table, if set. */
  name: string | null;
  /** Profile picture from the OAuth metadata (Google etc.), if any. */
  avatarUrl: string | null;
}

/** Pull an avatar URL out of Supabase `user_metadata` (Google sets these). */
function avatarFrom(meta: Record<string, unknown> | null | undefined): string | null {
  const url = meta?.avatar_url ?? meta?.picture;
  return typeof url === "string" ? url : null;
}

/** Hono context variables set by `loadSession`. */
export interface AppVariables {
  user: SessionUser | null;
}

export type AppContext = Context<{ Variables: AppVariables }>;

/** The app's source of truth for a user's role + display name. */
async function profileFor(userId: string): Promise<{ role: Role; name: string | null }> {
  const { data } = await admin()
    .from("profiles")
    .select("role, display_name")
    .eq("id", userId)
    .maybeSingle();
  return {
    role: data?.role === "admin" ? "admin" : "user",
    name: (data?.display_name as string | null) ?? null,
  };
}

async function resolveSession(c: AppContext): Promise<SessionUser | null> {
  const { accessToken, refreshToken } = readSessionCookies(c);
  if (!accessToken && !refreshToken) return null;

  // Valid access token → identify directly.
  if (accessToken) {
    const { data, error } = await anon().auth.getUser(accessToken);
    if (!error && data.user) {
      const profile = await profileFor(data.user.id);
      return {
        id: data.user.id,
        email: data.user.email ?? null,
        role: profile.role,
        name: profile.name,
        avatarUrl: avatarFrom(data.user.user_metadata),
      };
    }
  }

  // Expired/missing access token → try a refresh (same cookie domain as auth).
  if (refreshToken) {
    const { data, error } = await anon().auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data.session && data.user) {
      setSessionCookies(c, data.session);
      const profile = await profileFor(data.user.id);
      return {
        id: data.user.id,
        email: data.user.email ?? null,
        role: profile.role,
        name: profile.name,
        avatarUrl: avatarFrom(data.user.user_metadata),
      };
    }
    // Refresh token is dead — clear the stale cookies.
    clearSessionCookies(c);
  }

  return null;
}

/**
 * Always-on middleware: resolves the session (if any) and stashes it on the
 * context. Public routes read `c.get("user")` to tailor the response; the guard
 * middleware below enforce presence/role.
 */
export const loadSession: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  c.set("user", await resolveSession(c as AppContext));
  await next();
};

/** 401 unless a session is present. */
export const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  if (!c.get("user")) return c.json({ error: "Authentication required" }, 401);
  await next();
};

/** 403 unless the session belongs to an admin. */
export const requireAdmin: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Authentication required" }, 401);
  if (user.role !== "admin") return c.json({ error: "Admin access required" }, 403);
  await next();
};
