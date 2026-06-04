import { Center, Container, Title } from '@mantine/core';
import ResetPasswordForm from 'loctary_auth/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <Center mih="100vh" bg="var(--mantine-color-body)">
      <Container size={440} py={40} w="100%">
        <Title ta="center" mb="xl">New password</Title>
        <ResetPasswordForm />
      </Container>
    </Center>
  );
}
