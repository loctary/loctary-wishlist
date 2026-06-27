import { Container, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconListCheck } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "../lib/session";
import { OwnerWishlist } from "../components/OwnerWishlist";
import { WishlistGrid } from "../components/WishlistGrid";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/**
 * The index always renders the admin's wishlist (`WISHLIST_OWNER_ID`): the grid
 * omits `owner`, so the backend falls back to that default owner. When the admin
 * themselves is viewing, that list is *their own*, so we render the exact same
 * management view as their "My wishlist" page (`OwnerWishlist`) instead of the
 * public reserve view.
 */
function HomePage() {
  const { data: session } = useSession();

  if (session?.role === "admin") return <OwnerWishlist />;

  return (
    <Container size="lg" py="xl" w="100%">
      <Stack gap="xl">
        <Group gap="md" align="center" wrap="nowrap">
          <ThemeIcon size={60} radius="xl" variant="light" color="moss">
            <IconListCheck size={30} />
          </ThemeIcon>
          <div>
            <Title order={1} style={{ letterSpacing: "-0.03em" }}>
              Loctary's wishlist
            </Title>
            <Text c="dimmed" mt={4}>
              Browse the list and reserve a gift. Only the wishlist owner can
              see who reserved each item.
            </Text>
          </div>
        </Group>

        <WishlistGrid />
      </Stack>
    </Container>
  );
}
