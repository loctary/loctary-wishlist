// Type declarations for Module Federation remotes from loctary-auth.
// Keep in sync with loctary-auth/next.config.js exposes.

declare module 'loctary_auth/AuthProvider' {
  import type { ReactNode } from 'react';
  export default function AuthProvider(props: { children: ReactNode }): JSX.Element;
}

declare module 'loctary_auth/useAuth' {
  export interface AuthUser {
    id: string;
    email: string;
    name: string;
  }
  export interface LoginResult {
    mfaRequired: boolean;
  }
  export interface AuthContextValue {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: AuthUser | null;
    login: (credentials: { email: string; password: string }) => Promise<LoginResult>;
    logout: () => Promise<void>;
  }
  export function useAuth(): AuthContextValue;
}

declare module 'loctary_auth/AuthPage' {
  export default function AuthPage(props: { defaultTab?: 'login' | 'register' }): JSX.Element;
}

declare module 'loctary_auth/LoginPage' {
  export default function LoginPage(): JSX.Element;
}

declare module 'loctary_auth/RegisterPage' {
  export default function RegisterPage(): JSX.Element;
}

declare module 'loctary_auth/LoginForm' {
  export default function LoginForm(): JSX.Element;
}

declare module 'loctary_auth/RegisterForm' {
  export default function RegisterForm(): JSX.Element;
}

declare module 'loctary_auth/ForgotPasswordForm' {
  export default function ForgotPasswordForm(props?: { hostOrigin?: string }): JSX.Element;
}

declare module 'loctary_auth/ResetPasswordForm' {
  export default function ResetPasswordForm(): JSX.Element;
}

declare module 'loctary_auth/VerifyEmailView' {
  export default function VerifyEmailView(): JSX.Element;
}

declare module 'loctary_auth/SSOButtons' {
  export default function SSOButtons(props?: { redirectTo?: string }): JSX.Element | null;
}

declare module 'loctary_auth/MFAVerification' {
  export default function MFAVerification(props: {
    onVerified: () => void;
    onCancel?: () => void;
  }): JSX.Element;
}

declare module 'loctary_auth/MFASetup' {
  export default function MFASetup(props?: { onStatusChange?: () => void }): JSX.Element;
}
