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

/** Carried between auth steps: the in-progress `email`, and the `redirect` the
 * user should land on once authenticated (the page they came from). */
export interface AuthSearch {
  email?: string;
  redirect?: string;
}

/** Search validator shared by every auth route. */
export function validateAuthSearch(search: Record<string, unknown>): AuthSearch {
  const out: AuthSearch = {};
  if (typeof search.email === "string" && search.email) out.email = search.email;
  if (typeof search.redirect === "string" && isSafeRedirect(search.redirect)) {
    out.redirect = search.redirect;
  }
  return out;
}

const AUTH_PATHS_SET = new Set<string>(Object.values(AUTH_PATHS));

const BACKSLASH = 0x5c;

/**
 * A redirect target is trusted only if it is a single root-relative path within
 * this app — never something that could resolve to another origin, and never an
 * auth screen itself (which would loop back to login). Rejects, in order:
 *   - anything not starting with `/` (absolute URLs, `javascript:`, mailto, …);
 *   - `//host` and `/\host` — protocol-relative forms (browsers read `\` as `/`);
 *   - any backslash or ASCII control/space char (CR/LF/TAB/NUL/space), which a
 *     browser may strip to *reveal* one of the above (e.g. `/\t/evil.com`);
 *   - the auth routes themselves.
 * Window-free on purpose: it also runs during SSR, where there is no URL to
 * resolve against. The OAuth path adds two more layers (it is re-rooted at our
 * origin client-side and re-validated by origin allowlist on the auth server).
 */
export function isSafeRedirect(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path[1] === "/" || path[1] === "\\") return false;
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code <= 0x20 || code === BACKSLASH) return false;
  }
  const pathname = path.split(/[?#]/, 1)[0];
  return !AUTH_PATHS_SET.has(pathname);
}

/** Where to send the user after auth: the validated `redirect`, else home. */
export function redirectTarget(redirect: string | undefined): string {
  return redirect && isSafeRedirect(redirect) ? redirect : "/";
}

/** Search params for sending the current page to `/login` and back. */
export function loginSearch(from: string): AuthSearch {
  return isSafeRedirect(from) ? { redirect: from } : {};
}
