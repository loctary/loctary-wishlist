import { Center, Container, Title } from '@mantine/core';
import LoginForm from 'loctary_auth/LoginForm';

export default function LoginPage() {
  return (
    <Center mih="100vh" bg="var(--mantine-color-body)">
      <Container size={440} py={40} w="100%">
        <Title ta="center" mb="xl">Welcome back</Title>
        <LoginForm />
      </Container>
    </Center>
  );
}
