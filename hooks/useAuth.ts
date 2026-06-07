import { useCallback, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // The auth cookie is HttpOnly — js-cookie cannot read it.
    // Always hit /api/auth/me; the server reads the cookie and returns 401 if absent.
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ user: AuthUser }>) : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    window.location.href = '/';
  }, []);

  return { isAuthenticated: !!user, isLoading, user, logout };
}
