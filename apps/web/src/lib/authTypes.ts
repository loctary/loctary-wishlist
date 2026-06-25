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

export interface AuthMountProps {
  apiUrl?: string;
  initialRoute?: AuthRoute;
  initialEmail?: string;
  productName?: string;
  routes?: AuthRoutes;
  onAuthenticated?: (user: AuthUser) => void;
  onNavigate?: (to: string, route: AuthRoute, params?: { email?: string }) => void;
}

/** The signature of `loctary_auth/mount`'s default export. */
export type AuthMountFn = (el: HTMLElement, props: AuthMountProps) => () => void;
