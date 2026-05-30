import { Center, Loader } from '@mantine/core';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useWishlistAuth } from '@context/WishlistAuthContext';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useWishlistAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/auth/login?redirect=${redirect}`;
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
