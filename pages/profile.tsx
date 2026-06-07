import {
  Avatar,
  Button,
  Center,
  Container,
  Divider,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { NextPage } from 'next';
import Head from 'next/head';
import { AuthGuard } from '@components/AuthGuard';
import { useAuth } from '@hooks/useAuth';

function ProfileContent() {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    );
  }

  if (!user) return null;

  return (
    <Container size={480} py="xl">
      <Head>
        <title>Profile – Loctary</title>
      </Head>
      <Title order={2} mb="xl">
        Profile
      </Title>
      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="md">
          <Avatar size={80} radius="xl" color="orange" variant="filled">
            {user.name.charAt(0).toUpperCase()}
          </Avatar>
          <Stack gap={4} align="center">
            <Text fw={600} size="lg">
              {user.name}
            </Text>
            <Text c="dimmed" size="sm">
              {user.email}
            </Text>
          </Stack>
        </Stack>

        <Divider my="xl" />

        <Stack gap="sm">
          <Button variant="default" fullWidth disabled>
            Edit profile (coming soon)
          </Button>
          <Button color="red" variant="light" fullWidth onClick={() => void logout()}>
            Log out
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

const ProfilePage: NextPage = () => (
  <AuthGuard>
    <ProfileContent />
  </AuthGuard>
);

export default ProfilePage;
