import {
  Anchor,
  Badge,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  getItem,
  getUser,
  manageListItems,
  type AdminWishItem,
  type ItemStatus,
} from "../lib/api";
import { useSession } from "../lib/session";
import { tintFor } from "../lib/tint";
import { ImageCarousel } from "../components/ImageCarousel";
import { OwnerItemActions } from "../components/OwnerItemActions";
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
  const { user: session } = useSession();
  const router = useRouter();

  const query = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => getItem(itemId),
  });
  const ownerQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
    // Owner name/avatar is stable for this session — don't refetch on focus.
    staleTime: Infinity,
  });
  const ownerName = ownerQuery.data?.user.name;

  // When the viewer owns the item we need the admin projection (reserver info,
  // updatedAt) for `OwnerItemActions`. Pulled from the `manage-items` query so
  // it's the exact same cache the owner grid uses — instant if the user came
  // from their wishlist, one fetch otherwise. Disabled when not the owner.
  const isOwner = !!session && session.id === userId;
  const manageQuery = useQuery({
    queryKey: ["manage-items"],
    queryFn: () => manageListItems(),
    enabled: isOwner,
  });
  const adminItem: AdminWishItem | undefined = manageQuery.data?.items.find((i) => i.id === itemId);

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
                <Card.Section>
                  <ImageCarousel
                    images={item.images}
                    alt={item.title}
                    bg={tint.bg}
                    fg={tint.fg}
                  />
                </Card.Section>
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
                {isOwner ? (
                  adminItem ? (
                    <OwnerItemActions
                      item={adminItem}
                      onDeleted={() =>
                        router.navigate({
                          to: "/user/$userId/wishlist",
                          params: { userId },
                        })
                      }
                    />
                  ) : (
                    // Brief flicker while `manage-items` loads on a cold visit;
                    // public projection is already showing, just no action row.
                    <Center>
                      <Loader size="sm" />
                    </Center>
                  )
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
