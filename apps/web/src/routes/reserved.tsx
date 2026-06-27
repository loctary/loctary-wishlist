import { useEffect } from "react";
import {
  Button,
  Center,
  Container,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconBookmark } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { myReservations, type ReservedWishItem } from "../lib/api";
import { useSession } from "../lib/session";
import { UserLink } from "../components/UserLink";
import { WishlistCard } from "../components/WishlistCard";

export const Route = createFileRoute("/reserved")({
  component: ReservedPage,
});

interface OwnerGroup {
  id: string;
  name: string;
  items: ReservedWishItem[];
}

/** Group reservations by the list-owner they belong to, preserving order. */
function groupByOwner(items: ReservedWishItem[]): OwnerGroup[] {
  const map = new Map<string, OwnerGroup>();
  for (const item of items) {
    const existing = map.get(item.owner.id);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(item.owner.id, {
        id: item.owner.id,
        name: item.owner.name ?? "Someone",
        items: [item],
      });
    }
  }
  return [...map.values()];
}

function ReservedPage() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const router = useRouter();

  // Logged-in only — mirror the ProfileScreen guard.
  useEffect(() => {
    if (!sessionLoading && !session) router.navigate({ to: "/login" });
  }, [sessionLoading, session, router]);

  const query = useQuery({
    queryKey: ["my-reservations"],
    queryFn: () => myReservations(),
    enabled: !!session,
  });

  if (sessionLoading || !session) {
    return (
      <Center style={{ flex: 1, width: "100%" }}>
        <Loader />
      </Center>
    );
  }

  const items = query.data?.items ?? [];
  const groups = groupByOwner(items);
  const total = items.length;

  return (
    <Container size="lg" py="xl" w="100%">
      <Stack gap="xl">
        <div>
          <Group gap="sm" align="center" wrap="nowrap">
            <Title order={1} style={{ letterSpacing: "-0.03em" }}>
              Reserved by you
            </Title>
          </Group>
          <Text c="dimmed" mt={6}>
            {total > 0
              ? `${total} ${total === 1 ? "gift" : "gifts"} across ${groups.length} ${
                  groups.length === 1 ? "list" : "lists"
                }. Only you can release these.`
              : "Nothing reserved yet."}
          </Text>
        </div>

        {query.isLoading ? (
          <Center mih="40vh">
            <Loader />
          </Center>
        ) : query.isError ? (
          <Center mih="40vh">
            <Stack align="center">
              <Text c="red">Could not load your reservations.</Text>
              <Button variant="light" onClick={() => query.refetch()}>
                Retry
              </Button>
            </Stack>
          </Center>
        ) : total === 0 ? (
          <Center mih="40vh">
            <Stack align="center" gap="md" maw={360} ta="center">
              <ThemeIcon size={64} radius="xl" variant="light" color="gray">
                <IconBookmark size={32} />
              </ThemeIcon>
              <Text fw={600} size="lg">
                No reservations yet
              </Text>
              <Text c="dimmed" size="sm">
                When you reserve a gift on someone's wishlist, it shows up here
                so you can keep track.
              </Text>
              <Button
                component={Link}
                to="/"
                variant="filled"
                leftSection={<IconArrowLeft size={16} />}
              >
                Browse a wishlist
              </Button>
            </Stack>
          </Center>
        ) : (
          <Stack gap={40}>
            {groups.map((group) => {
              return (
                <section key={group.id}>
                  <Group gap="sm" align="center" mb="md" wrap="nowrap">
                    <Title
                      order={3}
                      fw={700}
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      <UserLink id={group.id} name={group.name} inherit />
                      {"'s wishlist"}
                    </Title>
                    <Text size="sm" c="dimmed" ff="monospace">
                      {group.items.length}
                    </Text>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                    {group.items.map((item) => (
                      <WishlistCard key={item.id} item={item} />
                    ))}
                  </SimpleGrid>
                </section>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
