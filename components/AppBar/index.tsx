import {
  Avatar,
  Button,
  Group,
  Menu,
  Text,
  UnstyledButton,
} from '@mantine/core';
import Link from 'next/link';
import { useAuth } from 'loctary_auth/useAuth';

export default function AppBar() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  return (
    <Group h="100%" px="md" justify="space-between">
      <Text fw={700} size="lg" component={Link} href="/" style={{ textDecoration: 'none' }}>
        Loctary
      </Text>

      <Group gap="sm">
        {isLoading ? null : isAuthenticated && user ? (
          <Menu shadow="md" width={180}>
            <Menu.Target>
              <UnstyledButton>
                <Avatar name={user.name} size="sm" color="orange" radius="xl" />
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{user.email}</Menu.Label>
              <Menu.Item component={Link} href="/profile">Profile</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" onClick={logout}>Sign out</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <>
            <Button variant="subtle" component={Link} href="/auth/login">Sign in</Button>
            <Button component={Link} href="/auth/register">Create account</Button>
          </>
        )}
      </Group>
    </Group>
  );
}
