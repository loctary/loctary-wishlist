import {
  Avatar,
  Button,
  Card,
  Center,
  Container,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconListCheck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getUser } from "../lib/api";

export const Route = createFileRoute("/user/$userId/")({
  component: UserPage,
});

/**
 * A user's public page: their display name + a link to their wishlist. No email
 * is exposed (the backend's `/users/:id` returns the name only).
 */
function UserPage() {
  const { userId } = Route.useParams();
  const query = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
    // Public profile rarely changes mid-session — cache for the lifetime of the tab.
    staleTime: Infinity,
  });

  const name = query.data?.user.name;
  const display = name ?? "User without a name"; // fallback for deleted users
  const avatarUrl = query.data?.user.avatarUrl;

  return (
    <Container size="sm" py="xl">
      {query.isLoading ? (
        <Center mih="40vh">
          <Loader />
        </Center>
      ) : query.isError ? (
        <Center mih="40vh">
          <Text c="dimmed">This user couldn't be found.</Text>
        </Center>
      ) : (
        <Card withBorder radius="lg" padding="xl" shadow="sm">
          <Stack align="center" gap="md">
            <Avatar
              src={avatarUrl ?? undefined}
              size={80}
              radius="xl"
              color="amber"
            >
              {display.slice(0, 1).toUpperCase()}
            </Avatar>
            <Title order={2}>{display}</Title>
            <Button
              renderRoot={(props) => (
                <Link
                  to="/user/$userId/wishlist"
                  params={{ userId }}
                  {...props}
                />
              )}
              leftSection={<IconListCheck size={16} />}
            >
              View wishlist
            </Button>
          </Stack>
        </Card>
      )}
    </Container>
  );
}
