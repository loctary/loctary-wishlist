// Type declarations for loctary_auth Module Federation remote.
// Keep in sync with what loctary-auth actually exposes.

declare module 'loctary_auth/AuthProvider' {
  import type { FC, ReactNode } from 'react';
  const AuthProvider: FC<{ children: ReactNode }>;
  export default AuthProvider;
}

declare module 'loctary_auth/AuthPage' {
  import type { FC } from 'react';
  const AuthPage: FC<{ defaultTab?: 'login' | 'register' }>;
  export default AuthPage;
}

declare module 'loctary_auth/LoginPage' {
  import type { FC } from 'react';
  const LoginPage: FC;
  export default LoginPage;
}

declare module 'loctary_auth/RegisterPage' {
  import type { FC } from 'react';
  const RegisterPage: FC;
  export default RegisterPage;
}

declare module 'loctary_auth/useAuth' {
  export interface AuthUser {
    id: string;
    email: string;
    name: string;
  }

  export interface UseAuthReturn {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: AuthUser | null;
    login: (credentials: { email: string; password: string }) => Promise<void>;
    logout: () => Promise<void>;
  }

  export function useAuth(): UseAuthReturn;
}
