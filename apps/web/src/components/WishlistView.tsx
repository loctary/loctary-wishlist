import {
  Anchor,
  Box,
  Center,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { IconArrowLeft } from "@tabler/icons-react";
import { getWishlist } from "../lib/api";
import { useSession } from "../lib/session";
import { useWishlistUser } from "../lib/user";
import { NotFoundScreen } from "./NotFoundScreen";
import { OwnerWishlist } from "./OwnerWishlist";
import { ShareButton } from "./ShareButton";
import { WishlistGrid } from "./WishlistGrid";

/**
 * One wishlist's page, scoped to `wishlistId`. Public — anyone can view and
 * reserve. When the viewer owns the parent user's account we render the
 * management view (`OwnerWishlist`); otherwise the read-only reservable grid.
 * Shared by `/user/$userId/wishlists/$wishlistId`.
 */
export function WishlistView({
  userId,
  wishlistId,
}: {
  userId: string;
  wishlistId: string;
}) {
  const { user: session } = useSession();

  if (session?.id === userId) return <OwnerWishlist wishlistId={wishlistId} />;
  return <VisitorWishlist userId={userId} wishlistId={wishlistId} />;
}

function VisitorWishlist({
  userId,
  wishlistId,
}: {
  userId: string;
  wishlistId: string;
}) {
  const listQuery = useQuery({
    queryKey: ["wishlist", wishlistId],
    queryFn: () => getWishlist(wishlistId),
  });
  const { user, isLoading: userLoading } = useWishlistUser(userId);

  if (listQuery.isLoading || userLoading) {
    return (
      <Center style={{ flex: 1, width: "100%" }}>
        <Loader />
      </Center>
    );
  }
  if (listQuery.isError || !listQuery.data) {
    return <NotFoundScreen kind="wishlist" />;
  }

  const list = listQuery.data.wishlist;
  const name = user?.name ?? "Someone";

  return (
    <Container size="lg" py="xl" style={{ flex: 1, width: "100%" }}>
      <Stack gap="xl">
        <Stack gap="md">
          {list.coverImageUrl && (
            <Box
              style={{
                aspectRatio: "12 / 4",
                borderRadius: "var(--mantine-radius-lg)",
                background: `center / cover no-repeat url(${list.coverImageUrl})`,
              }}
            />
          )}
          <div>
            <Anchor
              renderRoot={(props) => (
                <Link to="/user/$userId" params={{ userId }} {...props} />
              )}
              // mb="sm"
              display="inline-block"
            >
              <Group gap={4}>
                <IconArrowLeft size={16} /> Back to {name}&apos;s page
              </Group>
            </Anchor>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Title order={1} style={{ letterSpacing: "-0.03em" }}>
                {list.title}
              </Title>
              <ShareButton path={`/user/${userId}/wishlists/${wishlistId}`} />
            </Group>
            {list.description && (
              <Text c="dimmed" mt={6}>
                {list.description}
              </Text>
            )}
          </div>
        </Stack>

        <WishlistGrid wishlistId={wishlistId} />
      </Stack>
    </Container>
  );
}
