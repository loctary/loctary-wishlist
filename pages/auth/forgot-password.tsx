import { Center, Container, Title } from '@mantine/core';
import ForgotPasswordForm from 'loctary_auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <Center mih="100vh" bg="var(--mantine-color-body)">
      <Container size={440} py={40} w="100%">
        <Title ta="center" mb="xl">Reset password</Title>
        <ForgotPasswordForm />
      </Container>
    </Center>
  );
}
