import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { theme } from '@theme/index';

interface RemoteMantineProviderProps {
  children: ReactNode;
}

// Exposed via Module Federation as `wishlist/ThemedMantineProvider`.
// loctary-auth imports this so all remotes share the same Mantine theme instance.
export default function RemoteMantineProvider({ children }: RemoteMantineProviderProps) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      {children}
    </MantineProvider>
  );
}
