import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Group,
  Menu,
  Text,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconBookmark,
  IconListCheck,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
  IconUserCircle,
} from "@tabler/icons-react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useSession, useLogout } from "../lib/session";

/** Type-led brand wordmark: amber "l" + "octary". */
function Wordmark() {
  return (
    <span className="loctary-wordmark" style={{ fontSize: 22 }}>
      <span className="l">l</span>octary
    </span>
  );
}

export function AppHeader() {
  const { data: session, isLoading } = useSession();
  const logout = useLogout();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  const onLogout = async () => {
    await logout();
    router.navigate({ to: "/" });
  };

  const initial = (session?.email ?? "?").slice(0, 1).toUpperCase();

  const navLinks = [
    { to: "/", label: "My wishlist", icon: IconListCheck },
    { to: "/reserved", label: "Reserved", icon: IconBookmark },
  ] as const;

  return (
    <Box
      component="header"
      px="md"
      py="sm"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        backgroundColor: "color-mix(in srgb, var(--color-bg) 86%, transparent)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <Group justify="space-between" maw={1100} mx="auto" wrap="nowrap">
        <Link to="/" style={{ textDecoration: "none", lineHeight: 0 }}>
          <Wordmark />
        </Link>

        <Group gap="xs" wrap="nowrap">
          {session && (
            <Group gap={4} visibleFrom="xs" wrap="nowrap">
              {navLinks.map((l) => {
                const active = pathname === l.to;
                return (
                  <Button
                    key={l.to}
                    component={Link}
                    to={l.to}
                    size="sm"
                    radius="sm"
                    color="amber"
                    variant={active ? "light" : "subtle"}
                    c={active ? undefined : "var(--text-secondary)"}
                    leftSection={<l.icon size={17} />}
                  >
                    {l.label}
                  </Button>
                );
              })}
            </Group>
          )}

          <ActionIcon
            variant="subtle"
            color="gray"
            radius="md"
            size="lg"
            aria-label="Toggle color scheme"
            onClick={() => toggleColorScheme()}
          >
            {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>

          {isLoading ? null : session ? (
            <Menu position="bottom-end" withArrow shadow="md" width={220} radius="md">
              <Menu.Target>
                <ActionIcon variant="default" radius="xl" size="lg" aria-label="Account menu">
                  <Avatar size="sm" radius="xl" color="amber">
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
