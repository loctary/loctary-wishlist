import { Center, Container, Title } from '@mantine/core';
import RegisterForm from 'loctary_auth/RegisterForm';

export default function RegisterPage() {
  return (
    <Center mih="100vh" bg="var(--mantine-color-body)">
      <Container size={440} py={40} w="100%">
        <Title ta="center" mb="xl">Create account</Title>
        <RegisterForm />
      </Container>
    </Center>
  );
}
