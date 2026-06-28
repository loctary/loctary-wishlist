import {
  Button,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  manageCreateItem,
  manageListItems,
  WishlistApiError,
  type ItemInput,
} from "../lib/api";
import { ItemForm } from "./ItemForm";
import { OwnerItemActions } from "./OwnerItemActions";
import { WishlistCard } from "./WishlistCard";

/**
 * The owner-mode view of `/user/$userId/wishlist`, rendered when the viewer is
 * the list owner. Same card grid as the public list, but each card's footer
 * is the shared `OwnerItemActions` toolset (also used on the item detail page).
 * This component only owns the "Add item" flow; everything per-item lives in
 * `OwnerItemActions`.
 */
export function OwnerWishlist() {
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);

  const itemsQuery = useQuery({
    queryKey: ["manage-items"],
    queryFn: () => manageListItems(),
  });

  const createMut = useMutation({
    mutationFn: (input: ItemInput) => manageCreateItem(input),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Item created" });
      formHandlers.close();
      queryClient.invalidateQueries({ queryKey: ["manage-items"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (e) =>
      notifications.show({
        color: "red",
        message: e instanceof WishlistApiError ? e.message : "Could not create item",
      }),
  });

  const items = itemsQuery.data?.items ?? [];

  return (
    <Container size="lg" py="xl" w="100%">
      <Group justify="space-between" mb="xl" wrap="nowrap">
        <Group gap="md" align="center" wrap="nowrap">
          <div>
            <Title order={1} style={{ letterSpacing: "-0.03em" }}>
              Your wishlist
            </Title>
            <Text c="dimmed" mt={4}>
              Add what you'd love to receive. Others can reserve from it.
            </Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={formHandlers.open}>
          Add item
        </Button>
      </Group>

      {itemsQuery.isLoading ? (
        <Center mih="30vh">
          <Loader />
        </Center>
      ) : items.length === 0 ? (
        <Text c="dimmed">No items yet. Add your first wish.</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {items.map((item) => (
            <WishlistCard key={item.id} item={item} footer={<OwnerItemActions item={item} />} />
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
