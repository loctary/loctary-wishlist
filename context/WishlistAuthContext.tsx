import { createContext, useContext, type ReactNode } from 'react';
import { useAuth, type UseAuthReturn } from '@hooks/useAuth';

const WishlistAuthContext = createContext<UseAuthReturn>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  logout: async () => {},
});

export function WishlistAuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return (
    <WishlistAuthContext.Provider value={auth}>
      {children}
    </WishlistAuthContext.Provider>
  );
}

export function useWishlistAuth(): UseAuthReturn {
  return useContext(WishlistAuthContext);
}
