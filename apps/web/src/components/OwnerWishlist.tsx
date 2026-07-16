import {
  Anchor,
  Box,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  getWishlist,
  manageCreateItem,
  manageListItems,
  WishlistApiError,
  type AdminWishlist,
  type ItemInput,
} from "../lib/api";
import { ItemForm } from "./ItemForm";
import { NotFoundScreen } from "./NotFoundScreen";
import { OwnerItemActions } from "./OwnerItemActions";
import { ShareButton } from "./ShareButton";
import { WishlistCard } from "./WishlistCard";

/**
 * The owner-mode view of a single wishlist page. Same card grid as the public
 * list, but each card's footer is `OwnerItemActions`. Add-item is scoped to
 * this list (`wishlistId` baked into the create payload) — moving items
 * between lists isn't a v1 flow.
 */
export function OwnerWishlist({ wishlistId }: { wishlistId: string }) {
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);

  const listQuery = useQuery({
    queryKey: ["wishlist", wishlistId],
    queryFn: () => getWishlist(wishlistId),
  });
  const itemsQuery = useQuery({
    queryKey: ["manage-items", wishlistId],
    queryFn: () => manageListItems(wishlistId),
  });

  const createMut = useMutation({
    mutationFn: (input: ItemInput) =>
      manageCreateItem({ ...input, wishlistId }),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Item created" });
      formHandlers.close();
      queryClient.invalidateQueries({ queryKey: ["manage-items", wishlistId] });
      queryClient.invalidateQueries({ queryKey: ["items", wishlistId] });
    },
    onError: (e) =>
      notifications.show({
        color: "red",
        message:
          e instanceof WishlistApiError ? e.message : "Could not create item",
      }),
  });

  const items = itemsQuery.data?.items ?? [];

  // Full-screen loader until the list itself resolves — rendering the header
  // from partial data flashes a placeholder title before the real one.
  if (listQuery.isLoading) {
    return (
      <Center style={{ flex: 1, width: "100%" }}>
        <Loader />
      </Center>
    );
  }
  if (listQuery.isError || !listQuery.data) {
    return <NotFoundScreen kind="wishlist" />;
  }

  const list = listQuery.data.wishlist as AdminWishlist;

  return (
    <Container size="lg" py="xl" w="100%">
      <Stack gap="md" mb="xl">
        {list.coverImageUrl && (
          <Box
            style={{
              aspectRatio: "12 / 4",
              borderRadius: "var(--mantine-radius-lg)",
              background: `center / cover no-repeat url(${list.coverImageUrl})`,
            }}
          />
        )}
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <div>
            <Anchor
              renderRoot={(props) => (
                <Link
                  to="/user/$userId"
                  params={{ userId: list.ownerId }}
                  {...props}
                />
              )}
              display="inline-block"
            >
              <Group gap={4}>
                <IconArrowLeft size={16} /> Back to your page
              </Group>
            </Anchor>
            <Title order={1} style={{ letterSpacing: "-0.03em" }}>
              {list.title}
            </Title>
            {list.description && (
              <Text c="dimmed" mt={4}>
                {list.description}
              </Text>
            )}
            {!list.isActive && (
              <Text size="xs" c="orange" mt={4}>
                This wishlist is deactivated — only you can see it.
              </Text>
            )}
          </div>
          <Group gap="xs" wrap="nowrap">
            <ShareButton
              path={`/user/${list.ownerId}/wishlists/${list.id}`}
              disabled={!list.isActive}
              disabledReason="Hidden wishlists can't be shared — make it public first"
            />
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={formHandlers.open}
            >
              Add item
            </Button>
          </Group>
        </Group>
      </Stack>

      {itemsQuery.isLoading ? (
        <Center mih="30vh">
          <Loader />
        </Center>
      ) : items.length === 0 ? (
        <Text c="dimmed">No items yet. Add your first wish.</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {items.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              footer={<OwnerItemActions item={item} />}
            />
          ))}
        </SimpleGrid>
      )}

      <Modal
        opened={formOpen}
        onClose={formHandlers.close}
        title="Add item"
        size="lg"
        centered
      >
        <ItemForm
          submitLabel="Create"
          submitting={createMut.isPending}
          onCancel={formHandlers.close}
          onSubmit={(input) => createMut.mutate(input)}
        />
      </Modal>
    </Container>
  );
}
