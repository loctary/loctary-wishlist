import { Center, Loader, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuth } from 'loctary_auth/useAuth';

interface AuthGuardProps {
  children: ReactNode;
  redirectTo?: string;
}

export default function AuthGuard({ children, redirectTo = '/auth/login' }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const dest = `${redirectTo}?redirect=${encodeURIComponent(window.location.pathname)}`;
      window.location.href = dest;
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  if (isLoading) {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Center mih="60vh">
        <Text c="dimmed">Redirecting…</Text>
      </Center>
    );
  }

  return <>{children}</>;
}
