import { Center, Container, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import MFAVerification from 'loctary_auth/MFAVerification';
import { supabaseClient } from '@lib/supabaseClient';

export default function TwoFactorPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!data.session) { window.location.href = '/auth/login'; return; }
      supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data: aal }) => {
        if (!aal || aal.currentLevel === 'aal2' || aal.nextLevel === 'aal1') {
          const params = new URLSearchParams(window.location.search);
          window.location.href = params.get('redirect') ?? '/';
          return;
        }
        setReady(true);
      });
    });
  }, []);

  const handleVerified = () => {
    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get('redirect') ?? '/';
  };

  if (!ready) {
    return (
      <Center mih="100vh" bg="var(--mantine-color-body)">
        <Container size={440} py={40} w="100%" />
      </Center>
    );
  }

  return (
    <Center mih="100vh" bg="var(--mantine-color-body)">
      <Container size={440} py={40} w="100%">
        <Title ta="center" mb="xl">Two-factor authentication</Title>
        <MFAVerification
          onVerified={handleVerified}
          onCancel={() => { window.location.href = '/auth/login'; }}
        />
      </Container>
    </Center>
  );
}
