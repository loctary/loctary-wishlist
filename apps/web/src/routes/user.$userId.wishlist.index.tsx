import { Center, Container, Loader, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getUser } from "../lib/api";
import { useSession } from "../lib/session";
import { OwnerWishlist } from "../components/OwnerWishlist";
import { UserLink } from "../components/UserLink";
import { WishlistGrid } from "../components/WishlistGrid";

export const Route = createFileRoute("/user/$userId/wishlist/")({
  component: UserWishlistPage,
});

/**
 * A user's wishlist. Public — anyone can view and reserve. When the viewer is
 * the owner we render the management view (`OwnerWishlist`); otherwise the
 * public, reservable grid scoped to this owner.
 */
function UserWishlistPage() {
  const { userId } = Route.useParams();
  const { data: session } = useSession();

  if (session?.id === userId) return <OwnerWishlist />;

  return <VisitorWishlist userId={userId} />;
}

function VisitorWishlist({ userId }: { userId: string }) {
  const userQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
  });

  // Don't render a half-built page with a placeholder name — show a full-page
  // loader until the owner is resolved.
  if (userQuery.isLoading) {
    return (
      <Center style={{ flex: 1, width: "100%" }}>
        <Loader />
      </Center>
    );
  }
  if (userQuery.isError) {
    return (
      <Center style={{ flex: 1, width: "100%" }}>
        <Text c="dimmed">This wishlist couldn't be found.</Text>
      </Center>
    );
  }

  const name = userQuery.data?.user.name ?? "Someone";

  return (
    <Container size="lg" py="xl" style={{ flex: 1, width: "100%" }}>
      <Stack gap="xl">
        <div>
          <Title order={1} style={{ letterSpacing: "-0.03em" }}>
            <UserLink id={userId} name={name} inherit />
            {"'s wishlist"}
          </Title>
          <Text c="dimmed" mt={4}>
            Browse the list and reserve a gift. Only the wishlist owner can see
            who reserved each item.
          </Text>
        </div>

        <WishlistGrid owner={userId} />
      </Stack>
    </Container>
  );
}
