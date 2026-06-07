import { Avatar, Button, Group, Menu, Skeleton, Text, UnstyledButton } from '@mantine/core';
import Link from 'next/link';
import { useWishlistAuth } from '@context/WishlistAuthContext';

export function AppBar() {
  const { isAuthenticated, isLoading, user, logout } = useWishlistAuth();

  return (
    <Group h="100%" px="md" justify="space-between">
      <Text
        component={Link}
        href="/"
        fw={700}
        size="lg"
        c="inherit"
        style={{ textDecoration: 'none' }}
      >
        Loctary
      </Text>

      <Group gap="sm">
        {isLoading ? (
          <Skeleton height={32} width={120} radius="sm" />
        ) : isAuthenticated && user ? (
          <Menu position="bottom-end" withArrow offset={4}>
            <Menu.Target>
              <UnstyledButton aria-label="Account menu">
                <Avatar radius="xl" size={34} color="orange" variant="filled">
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown miw={180}>
              <Menu.Label fw={500}>{user.name}</Menu.Label>
              <Menu.Label c="dimmed" fz="xs" mt={-4}>
                {user.email}
              </Menu.Label>
              <Menu.Divider />
              <Menu.Item component={Link} href="/profile">
                Edit profile
              </Menu.Item>
              <Menu.Item color="red" onClick={() => void logout()}>
                Log out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <>
            <Button component={Link} href="/auth/login" variant="subtle" size="sm">
              Sign in
            </Button>
            <Button component={Link} href="/auth/register" size="sm" color="orange">
              Create account
            </Button>
          </>
        )}
      </Group>
    </Group>
  );
}
