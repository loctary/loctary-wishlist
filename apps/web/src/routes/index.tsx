import { Button, Center, Container, Group, Stack, Text, Title } from "@mantine/core";
import { IconGift, IconListCheck, IconUserPlus } from "@tabler/icons-react";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useSession } from "../lib/session";
import { loginSearch } from "../lib/authNav";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/**
 * Placeholder for the eventual public wishlist directory. Everything user-facing
 * lives at `/user/$userId/wishlists` now; the index will grow into a browsable
 * feed later. For now it's a small coming-soon card with sign-in CTAs.
 */
function HomePage() {
  const { user: session, loading } = useSession();
  const here = useRouterState({ select: (s) => s.location.href });

  return (
    <Center style={{ flex: 1 }} px="md">
      <Container size="sm" py="xl">
        <Stack align="center" gap="lg" ta="center">
          <IconGift size={44} style={{ color: "var(--color-primary)" }} />
          <div>
            <Title order={1} style={{ letterSpacing: "-0.03em" }}>
              A friendly wishlist for the whole crew.
            </Title>
            <Text c="dimmed" mt="sm" maw={420} mx="auto">
              A shared home for everyone's wishlists is coming soon. In the meantime,
              sign in to build and share your own.
            </Text>
          </div>

          {loading ? null : session ? (
            <Button
              size="md"
              leftSection={<IconListCheck size={18} />}
              renderRoot={(props) => (
                <Link to="/user/$userId" params={{ userId: session.id }} {...props} />
              )}
            >
              Go to my page
            </Button>
          ) : (
            <Group gap="sm">
              <Button
                size="md"
                leftSection={<IconListCheck size={18} />}
                renderRoot={(props) => (
                  <Link to="/login" search={loginSearch(here)} {...props} />
                )}
              >
                Log in
              </Button>
              <Button
                size="md"
                variant="light"
                leftSection={<IconUserPlus size={18} />}
                renderRoot={(props) => <Link to="/register" {...props} />}
              >
                Create an account
              </Button>
            </Group>
          )}
        </Stack>
      </Container>
    </Center>
  );
}
