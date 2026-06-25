import {
  ActionIcon,
  Box,
  Button,
  Group,
  Text,
  Title,
  useMantineColorScheme,
} from "@mantine/core";
import { IconGift, IconMoon, IconSun } from "@tabler/icons-react";
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
            <>
              {session.role === "admin" && (
                <Button variant="light" size="sm" onClick={() => router.navigate({ to: "/admin" })}>
                  Admin
                </Button>
              )}
              <Text size="sm" c="dimmed" visibleFrom="sm">
                {session.email}
              </Text>
              <Button variant="default" size="sm" onClick={onLogout}>
                Log out
              </Button>
            </>
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
