import {
  Alert,
  Anchor,
  Badge,
  Card,
  Center,
  Container,
  Group,
  Image,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconExternalLink, IconGift } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getItem, getUser, type ItemStatus } from "../lib/api";
import { useSession } from "../lib/session";
import { tintFor } from "../lib/tint";
import { ReserveButton } from "../components/ReserveButton";
import { UserLink } from "../components/UserLink";

export const Route = createFileRoute("/user/$userId/wishlist/$itemId")({
  component: ItemPage,
});

const STATUS: Record<ItemStatus, { color: string; label: string } | null> = {
  available: null,
  reserved: { color: "gray", label: "Reserved" },
  confirmed: { color: "moss", label: "Gifted" },
  declined: null,
};

function ItemPage() {
  const { userId, itemId } = Route.useParams();
  const { data: session } = useSession();
  const query = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => getItem(itemId),
  });
  const ownerQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
  });
  const ownerName = ownerQuery.data?.user.name;

  return (
    <Container size="sm" py="xl" w="100%">
      <Anchor
        renderRoot={(props) => (
          <Link to="/user/$userId/wishlist" params={{ userId }} {...props} />
        )}
        mb="md"
        display="inline-block"
      >
        <Group gap={4}>
          <IconArrowLeft size={16} /> Back to{" "}
          {ownerName ? `${ownerName}'s wishlist` : "wishlist"}
        </Group>
      </Anchor>

      {query.isLoading ? (
        <Center mih="40vh">
          <Loader />
        </Center>
      ) : query.isError || !query.data ? (
        <Center mih="40vh">
          <Stack align="center">
            <Text c="dimmed">This item couldn't be found.</Text>
            <Anchor component={Link} to="/">
              Go home
            </Anchor>
          </Stack>
        </Center>
      ) : (
        (() => {
          const item = query.data.item;
          const badge = STATUS[item.status];
          const isOwner = session?.id === item.ownerId;
          const tint = tintFor(item.id);
          const price =
            item.price == null
              ? null
              : new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: item.currency,
                }).format(item.price);
          return (
            <Card withBorder radius="lg" padding="lg" shadow="sm" pt={0}>
              <Stack>
                {item.imageUrl ? (
                  <Card.Section>
                    <Image
                      className="wl-cover"
                      src={item.imageUrl}
                      alt={item.title}
                      fit="cover"
                    />
                  </Card.Section>
                ) : (
                  <Card.Section
                    style={{
                      background: tint.bg,
                      display: "grid",
                      placeItems: "center",
                      aspectRatio: "4 / 3",
                    }}
                  >
                    <IconGift size={72} style={{ color: tint.fg }} />
                  </Card.Section>
                )}
                <Group justify="space-between" align="flex-start">
                  <Title order={2}>{item.title}</Title>
                  {badge && (
                    <Badge color={badge.color} variant="light">
                      {badge.label}
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">
                  From{" "}
                  <UserLink id={item.ownerId} name={ownerName ?? "this user"} />
                  {"'s wishlist"}
                </Text>
                {item.description && <Text>{item.description}</Text>}
                {price && (
                  <Text fw={700} size="lg">
                    {price}
                  </Text>
                )}
                {item.url && (
                  <Anchor
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Group gap={4}>
                      View product <IconExternalLink size={16} />
                    </Group>
                  </Anchor>
                )}
                {isOwner ? (
                  <Alert color="gray" variant="light">
                    This item is on your own wishlist — manage it from your
                    wishlist page.
                  </Alert>
                ) : (
                  <ReserveButton item={item} />
                )}
              </Stack>
            </Card>
          );
        })()
      )}
    </Container>
  );
}
