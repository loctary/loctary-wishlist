import { Avatar, Container, Divider, Stack, Text, Title } from '@mantine/core';
import AppLayout from '@components/AppLayout';
import AuthGuard from '@components/AuthGuard';
import MFASetup from 'loctary_auth/MFASetup';
import { useAuth } from 'loctary_auth/useAuth';

function ProfileContent() {
  const { user } = useAuth();

  return (
    <Container size="sm">
      <Stack gap="xl">
        <div>
          <Title mb="xs">Profile</Title>
          <Text c="dimmed">Manage your account settings.</Text>
        </div>

        <Stack gap="sm" align="flex-start">
          <Avatar name={user?.name} size="xl" color="orange" radius="xl" />
          <div>
            <Text fw={600} size="lg">{user?.name}</Text>
            <Text c="dimmed" size="sm">{user?.email}</Text>
          </div>
        </Stack>

        <Divider />

        <div>
          <Title order={3} mb="md">Security</Title>
          <MFASetup />
        </div>
      </Stack>
    </Container>
  );
}

export default function ProfilePage() {
  return (
    <AppLayout>
      <AuthGuard>
        <ProfileContent />
      </AuthGuard>
    </AppLayout>
  );
}
