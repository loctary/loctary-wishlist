import { Anchor, Center, Code, Loader, Stack, Text } from '@mantine/core';
import type { NextPageWithLayout } from '../_app';
import { useEffect, useState } from 'react';
import { supabaseClient } from '@lib/supabaseClient';

async function persistSession(accessToken: string): Promise<void> {
  const res = await fetch('/api/auth/set-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'Failed to persist session.');
  }
}

const CallbackPage: NextPageWithLayout = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    // Supabase may have already cleaned the hash via history.replaceState —
    // capture it before anything else modifies the URL.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    // ── OAuth error ──────────────────────────────────────────────────────────
    const oauthError = query.get('error') ?? hash.get('error');
    if (oauthError) {
      const desc = query.get('error_description') ?? hash.get('error_description');
      setError(desc ? decodeURIComponent(desc.replaceAll('+', ' ')) : oauthError);
      return;
    }

    // ── PKCE flow: ?code=xxx ─────────────────────────────────────────────────
    const code = query.get('code');
    if (code) {
      supabaseClient.auth
        .exchangeCodeForSession(code)
        .then(async ({ data, error: err }) => {
          if (err || !data.session) { setError(err?.message ?? 'Code exchange failed.'); return; }
          await persistSession(data.session.access_token);
          window.location.href = query.get('next') ?? '/';
        })
        .catch((e: Error) => setError(e.message));
      return;
    }

    // ── Implicit flow: Supabase's client auto-processes #access_token and
    //    clears the hash via history.replaceState before our effect runs.
    //    We read the session it stored internally, OR subscribe to catch the
    //    event if processing is still in progress.
    let handled = false;

    const finish = async (accessToken: string) => {
      if (handled) return;
      handled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
      try {
        await persistSession(accessToken);
        window.location.href = query.get('next') ?? '/';
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to persist session.');
      }
    };

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => { if (session?.access_token) void finish(session.access_token); }
    );

    // Also check if session was already stored before we subscribed.
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) void finish(session.access_token);
    });

    const timeout = setTimeout(() => {
      if (handled) return;
      handled = true;
      subscription.unsubscribe();
      setError(
        'Sign-in timed out — no session was received.\n\n' +
        'Make sure:\n' +
        '• Google is enabled in Supabase → Authentication → Providers\n' +
        '• http://localhost:3000/auth/callback is added in\n' +
        '  Supabase → Authentication → URL Configuration → Redirect URLs'
      );
    }, 8000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  if (error) {
    return (
      <Center h="70vh">
        <Stack align="center" gap="sm" maw={480} px="md">
          <Text fw={600} c="red">Sign-in failed</Text>
          <Code block style={{ whiteSpace: 'pre-wrap', textAlign: 'left', fontSize: 12 }}>
            {error}
          </Code>
          <Anchor fw={500} onClick={() => (window.location.href = '/auth/login')}>
            ← Back to sign in
          </Anchor>
        </Stack>
      </Center>
    );
  }

  return (
    <Center h="70vh">
      <Stack align="center" gap="sm">
        <Loader size="md" />
        <Text size="sm" c="dimmed">Completing sign-in…</Text>
      </Stack>
    </Center>
  );
};

export default CallbackPage;
