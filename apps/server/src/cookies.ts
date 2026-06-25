import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Session } from "@supabase/supabase-js";
import { env } from "./env.js";

/**
 * Cookie names + policy MUST match loctary-auth exactly — that is how this
 * backend reads the session loctary-auth set. Both apps scope the cookies to
 * the same COOKIE_DOMAIN so they are visible across subdomains.
 */
export const ACCESS_COOKIE = "loctary_access_token";
export const REFRESH_COOKIE = "loctary_refresh_token";

function baseCookieOptions() {
  return {
    domain: env.cookieDomain,
    path: "/",
    httpOnly: true,
    secure: env.isProd,
    // Lax is enough: subdomains of one site are same-site.
    sameSite: "Lax" as const,
  };
}

/**
 * Re-set the session cookies after a silent refresh. This Worker is on the same
 * COOKIE_DOMAIN as auth, so it may legitimately refresh the access token.
 */
export function setSessionCookies(c: Context, session: Session): void {
  const opts = baseCookieOptions();

  setCookie(c, ACCESS_COOKIE, session.access_token, {
    ...opts,
    maxAge: session.expires_in ?? 3600,
  });

  if (session.refresh_token) {
    setCookie(c, REFRESH_COOKIE, session.refresh_token, {
      ...opts,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
}

export function clearSessionCookies(c: Context): void {
  const opts = { domain: env.cookieDomain, path: "/" };
  deleteCookie(c, ACCESS_COOKIE, opts);
  deleteCookie(c, REFRESH_COOKIE, opts);
}

export function readSessionCookies(c: Context): {
  accessToken?: string;
  refreshToken?: string;
} {
  return {
    accessToken: getCookie(c, ACCESS_COOKIE),
    refreshToken: getCookie(c, REFRESH_COOKIE),
  };
}
