import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { AppProps } from 'next/app';
import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { AppLayout } from '@components/AppLayout';
import { WishlistAuthProvider } from '@context/WishlistAuthContext';
import { theme } from '@theme/index';

export type NextPageWithLayout = NextPage & { noLayout?: true };

const RemoteAuthProvider = dynamic(
  async () => {
    try {
      const mod = await import('loctary_auth/AuthProvider');
      return mod;
    } catch {
      return {
        default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      };
    }
  },
  { ssr: false }
);

export default function App({ Component, pageProps }: AppProps) {
  const C = Component as NextPageWithLayout;
  const page = <C {...pageProps} />;

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <WishlistAuthProvider>
        <Suspense fallback={null}>
          <RemoteAuthProvider>
            {C.noLayout ? page : <AppLayout>{page}</AppLayout>}
          </RemoteAuthProvider>
        </Suspense>
      </WishlistAuthProvider>
    </MantineProvider>
  );
}
