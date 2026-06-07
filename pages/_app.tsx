import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { AppProps } from 'next/app';
import { useEffect, useState, type ReactNode } from 'react';
import { theme } from '@theme/index';
import AuthProvider from 'loctary_auth/AuthProvider';

// The `loctary_auth` remote is loaded by Module Federation at runtime and does
// not render during SSR — the server emits an empty page body while the client
// renders the full tree, which makes React's hydration fail on the first DOM
// node it reaches (Mantine's AppShell <style>). Rendering the federated tree
// only after mount keeps the server output and the client's first render
// identical, so hydration succeeds. The Mantine providers stay outside the gate
// so their CSS-variable <style> still SSRs and matches.
function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <ClientOnly>
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </ClientOnly>
    </MantineProvider>
  );
}
