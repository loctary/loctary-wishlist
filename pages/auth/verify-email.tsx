import { Center, Container, Title } from '@mantine/core';
import VerifyEmailView from 'loctary_auth/VerifyEmailView';

export default function VerifyEmailPage() {
  return (
    <Center mih="100vh" bg="var(--mantine-color-body)">
      <Container size={440} py={40} w="100%">
        <Title ta="center" mb="xl">Verify your email</Title>
        <VerifyEmailView />
      </Container>
    </Center>
  );
}
