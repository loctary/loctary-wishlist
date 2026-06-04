import { createContext, useContext } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface WishlistAuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
}

export const WishlistAuthContext = createContext<WishlistAuthContextValue>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
});

export function useWishlistAuth(): WishlistAuthContextValue {
  return useContext(WishlistAuthContext);
}
