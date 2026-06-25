import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Group,
  Menu,
  Text,
  Title,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconGift,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
  IconUserCircle,
} from "@tabler/icons-react";
import { Link, useRouter } from "@tanstack/react-router";
import { useSession, useLogout } from "../lib/session";

export function AppHeader() {
  const { data: session, isLoading } = useSession();
  const logout = useLogout();
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  const onLogout = async () => {
    await logout();
    router.navigate({ to: "/" });
  };

  const initial = (session?.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <Box
      component="header"
      px="md"
      py="sm"
      style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
    >
      <Group justify="space-between" maw={1100} mx="auto">
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          <Group gap="xs">
            <IconGift size={24} color="var(--mantine-color-brand-6)" />
            <Title order={4} c="brand.7">
              Loctary Wishlist
            </Title>
          </Group>
        </Link>

        <Group gap="sm">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Toggle color scheme"
            onClick={() => toggleColorScheme()}
          >
            {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>

          {isLoading ? null : session ? (
            <Menu position="bottom-end" withArrow shadow="md" width={220}>
              <Menu.Target>
                <ActionIcon variant="default" radius="xl" size="lg" aria-label="Account menu">
                  <Avatar size="sm" radius="xl" color="brand">
                    {initial}
                  </Avatar>
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>
                  <Text size="xs" truncate>
                    {session.email}
                  </Text>
                </Menu.Label>
                <Menu.Item
                  leftSection={<IconUserCircle size={16} />}
                  onClick={() => router.navigate({ to: "/profile" })}
                >
                  Profile
                </Menu.Item>
                {session.role === "admin" && (
                  <Menu.Item
                    leftSection={<IconSettings size={16} />}
                    onClick={() => router.navigate({ to: "/admin" })}
                  >
                    Admin
                  </Menu.Item>
                )}
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={onLogout}>
                  Log out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Button size="sm" onClick={() => router.navigate({ to: "/login" })}>
              Log in
            </Button>
          )}
        </Group>
      </Group>
    </Box>
  );
}
