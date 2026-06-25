/**
 * Auth contract copied from loctary-auth's `apps/web/src/types.ts`. The remote
 * doesn't ship federated `.d.ts` (dts:false), so the host carries its own copy
 * of the prop shapes it passes to the mounted widget.
 */
export type AuthRoute =
  | "login"
  | "register"
  | "forgot-password"
  | "reset-password"
  | "verify-email";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export type AuthRoutes = Partial<Record<AuthRoute, string>>;

/** Everything the remote can mount as a single-page slot via `./mountPage`. */
export type AuthMountKey = AuthRoute | "profile";

export interface AuthMountProps {
  apiUrl?: string;
  initialRoute?: AuthRoute;
  initialEmail?: string;
  productName?: string;
  routes?: AuthRoutes;
  onAuthenticated?: (user: AuthUser) => void;
  onNavigate?: (to: string, route: AuthRoute, params?: { email?: string }) => void;
}

/** Props for the single-page mount (`loctary_auth/mountPage`). */
export interface AuthPageMountProps extends AuthMountProps {
  page: AuthMountKey;
}

/** The signature of `loctary_auth/mount`'s default export (self-routing AuthApp). */
export type AuthMountFn = (el: HTMLElement, props: AuthMountProps) => () => void;

/** The signature of `loctary_auth/mountPage`'s default export (one page). */
export type AuthPageMountFn = (el: HTMLElement, props: AuthPageMountProps) => () => void;
