import { AppShell } from '@mantine/core';
import type { ReactNode } from 'react';
import { AppBar } from '@components/AppBar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AppShell.Header>
        <AppBar />
      </AppShell.Header>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
