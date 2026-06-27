import {
  ActionIcon,
  Avatar,
  Box,
  Burger,
  Button,
  Drawer,
  Group,
  Menu,
  NavLink,
  Stack,
  Text,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBookmark,
  IconListCheck,
  IconLogout,
  IconMoon,
  IconSun,
  IconUserCircle,
} from "@tabler/icons-react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useSession, useLogout } from "../lib/session";
import { loginSearch } from "../lib/authNav";

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
  const here = useRouterState({ select: (s) => s.location.href });
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [drawerOpened, drawer] = useDisclosure(false);

  const onLogout = async () => {
    await logout();
    router.navigate({ to: "/" });
  };

  const initial = (session?.name ?? session?.email ?? "?").slice(0, 1).toUpperCase();

  // "My wishlist" → the caller's own list; active across its item subroutes.
  const myWishlistActive =
    !!session && pathname.startsWith(`/user/${session.id}/wishlist`);
  const reservedActive = pathname === "/reserved";

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
        <Group gap="sm" wrap="nowrap">
          {session && (
            <Burger
              opened={drawerOpened}
              onClick={drawer.toggle}
              hiddenFrom="xs"
              size="sm"
              aria-label="Open navigation"
            />
          )}
          <Link to="/" style={{ textDecoration: "none", lineHeight: 0 }}>
            <Wordmark />
          </Link>
        </Group>

        <Group gap="xs" wrap="nowrap">
          {session && (
            <Group gap={4} visibleFrom="xs" wrap="nowrap">
              <Button
                renderRoot={(props) => (
                  <Link
                    to="/user/$userId/wishlist"
                    params={{ userId: session.id }}
                    {...props}
                  />
                )}
                size="sm"
                radius="sm"
                color="amber"
                variant={myWishlistActive ? "light" : "subtle"}
                c={myWishlistActive ? undefined : "var(--text-secondary)"}
                leftSection={<IconListCheck size={17} />}
              >
                My wishlist
              </Button>
              <Button
                component={Link}
                to="/reserved"
                size="sm"
                radius="sm"
                color="amber"
                variant={reservedActive ? "light" : "subtle"}
                c={reservedActive ? undefined : "var(--text-secondary)"}
                leftSection={<IconBookmark size={17} />}
              >
                Reserved
              </Button>
            </Group>
          )}

          <ActionIcon
            variant="subtle"
            color="gray"
            radius="md"
            size="lg"
            aria-label="Toggle color scheme"
            onClick={() => toggleColorScheme()}
            display="none"
          >
            {colorScheme === "dark" ? (
              <IconSun size={18} />
            ) : (
              <IconMoon size={18} />
            )}
          </ActionIcon>

          {isLoading ? null : session ? (
            <Menu
              position="bottom-end"
              withArrow
              shadow="md"
              width={220}
              radius="md"
            >
              <Menu.Target>
                <ActionIcon
                  variant="default"
                  radius="xl"
                  size="lg"
                  aria-label="Account menu"
                >
                  <Avatar
                    size="sm"
                    radius="xl"
                    color="amber"
                    src={session.avatarUrl ?? undefined}
                  >
                    {initial}
                  </Avatar>
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>
                  {session.name && (
                    <Text size="sm" fw={600} c="var(--text-primary)" truncate>
                      {session.name}
                    </Text>
                  )}
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
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={16} />}
                  onClick={onLogout}
                >
                  Log out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Button size="sm" onClick={() => router.navigate({ to: "/login", search: loginSearch(here) })}>
              Log in
            </Button>
          )}
        </Group>
      </Group>

      {session && (
        <Drawer
          opened={drawerOpened}
          onClose={drawer.close}
          size="xs"
          padding="md"
          title={<Wordmark />}
          hiddenFrom="xs"
        >
          <Stack gap={4}>
            <NavLink
              label="My wishlist"
              leftSection={<IconListCheck size={18} />}
              active={myWishlistActive}
              renderRoot={(props) => (
                <Link
                  to="/user/$userId/wishlist"
                  params={{ userId: session.id }}
                  {...props}
                />
              )}
              onClick={drawer.close}
            />
            <NavLink
              component={Link}
              to="/reserved"
              label="Reserved"
              leftSection={<IconBookmark size={18} />}
              active={reservedActive}
              onClick={drawer.close}
            />
          </Stack>
        </Drawer>
      )}
    </Box>
  );
}
