import { Center, Loader, Text } from '@mantine/core';
import { useEffect } from 'react';

/**
 * Handles non-OAuth Supabase callbacks (magic links, email confirm links).
 * OAuth is handled server-side at /api/auth/callback.
 * For these flows, createBrowserClient detects the session from the URL hash
 * automatically and onAuthStateChange fires in AuthProvider.
 */
export default function CallbackPage() {
  useEffect(() => {
    // Give onAuthStateChange in AuthProvider time to fire and pick up the session,
    // then redirect home. For magic-link / email-confirm flows the hash is processed
    // automatically by the @supabase/ssr browser client.
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      window.location.replace(params.get('next') ?? '/');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Center mih="100vh" style={{ flexDirection: 'column', gap: 16 }}>
      <Loader size="lg" />
      <Text c="dimmed">Completing sign in…</Text>
    </Center>
  );
}
