import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { AppProps } from 'next/app';
import { theme } from '@theme/index';
import AuthProvider from 'loctary_auth/AuthProvider';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </MantineProvider>
  );
}
