import Cookies from 'js-cookie';

export const AUTH_COOKIE_NAME = 'loctary_auth_token';

/** Read the domain-wide auth token set by loctary-auth. */
export function getAuthToken(): string | undefined {
  return Cookies.get(AUTH_COOKIE_NAME);
}

/** Remove the auth cookie across all subdomains. */
export function clearAuthToken(): void {
  Cookies.remove(AUTH_COOKIE_NAME, {
    domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN ?? 'localhost',
    path: '/',
  });
}
