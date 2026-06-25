import type { AuthRoute } from "./authTypes";

/**
 * Where each auth screen lives in THIS host. Passed to the remote as `routes` so
 * it builds correct `<a href>`s, and used by `onNavigate` to drive our router.
 * `as const` keeps the values as literal route paths so TanStack's typed
 * `navigate({ to })` accepts them.
 */
export const AUTH_PATHS = {
  login: "/login",
  register: "/register",
  "forgot-password": "/forgot-password",
  "reset-password": "/reset-password",
  "verify-email": "/verify-email",
} as const satisfies Record<AuthRoute, string>;

/** Email carried between auth steps (e.g. login → verify-email). */
export interface AuthSearch {
  email?: string;
}

/** Search validator shared by every auth route. */
export function validateAuthSearch(search: Record<string, unknown>): AuthSearch {
  return typeof search.email === "string" && search.email ? { email: search.email } : {};
}
