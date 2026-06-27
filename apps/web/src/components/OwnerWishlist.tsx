import { useState } from "react";
import {
  ActionIcon,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconEdit,
  IconListCheck,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  manageConfirmItem,
  manageCreateItem,
  manageDeclineItem,
  manageDeleteItem,
  manageListItems,
  manageUpdateItem,
  WishlistApiError,
  type AdminWishItem,
  type ItemInput,
} from "../lib/api";
import { ItemForm } from "./ItemForm";
import { UserLink } from "./UserLink";
import { WishlistCard } from "./WishlistCard";

/**
 * The owner-mode view of `/user/$userId/wishlist`, rendered when the viewer is
 * the list owner. Same card grid as the public list, but each card's footer
 * carries owner actions (edit / delete, and approve / cancel a reservation) and
 * reveals who reserved the item so the owner can act. Plus an Add button.
 */

function notifyError(e: unknown, fallback: string) {
  notifications.show({
    color: "red",
    message: e instanceof WishlistApiError ? e.message : fallback,
  });
}

export function OwnerWishlist() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminWishItem | null>(null);
  const [formOpen, formHandlers] = useDisclosure(false);

  const itemsQuery = useQuery({
    queryKey: ["manage-items"],
    queryFn: () => manageListItems(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["manage-items"] });
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
    queryClient.invalidateQueries({ queryKey: ["item"] });
  };

  const createMut = useMutation({
    mutationFn: (input: ItemInput) => manageCreateItem(input),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Item created" });
      formHandlers.close();
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not create item"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ItemInput> }) =>
      manageUpdateItem(id, input),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Item updated" });
      formHandlers.close();
      setEditing(null);
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not update item"),
  });

  const actionMut = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: "confirm" | "decline" | "delete";
    }) => {
      if (action === "confirm") await manageConfirmItem(id);
      else if (action === "decline") await manageDeclineItem(id);
      else await manageDeleteItem(id);
    },
    onSuccess: () => invalidate(),
    onError: (e) => notifyError(e, "Action failed"),
  });

  const openCreate = () => {
    setEditing(null);
    formHandlers.open();
  };
  const openEdit = (item: AdminWishItem) => {
    setEditing(item);
    formHandlers.open();
  };

  const items = itemsQuery.data?.items ?? [];

  return (
    <Container size="lg" py="xl" w="100%">
      <Group justify="space-between" mb="xl" wrap="nowrap">
        <Group gap="md" align="center" wrap="nowrap">
          <ThemeIcon size={60} radius="xl" variant="light" color="moss">
            <IconListCheck size={30} />
          </ThemeIcon>
          <div>
            <Title order={1} style={{ letterSpacing: "-0.03em" }}>
              Your wishlist
            </Title>
            <Text c="dimmed" mt={4}>
              Add what you'd love to receive. Others can reserve from it.
            </Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
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
            <WishlistCard
              key={item.id}
              item={item}
              footer={
                <Stack gap={6}>
                  {item.reserver && (
                    <Text size="xs" c="dimmed">
                      Reserved by{" "}
                      <UserLink
                        id={item.reserver.id}
                        name={item.reserver.name ?? "Someone"}
                        size="xs"
                      />
                    </Text>
                  )}
                  <Group gap="xs" justify="flex-end" wrap="nowrap">
                    {item.status === "reserved" && (
                      <>
                        <Tooltip label="Approve reservation (gift received)">
                          <ActionIcon
                            color="teal"
                            variant="light"
                            loading={actionMut.isPending}
                            onClick={() =>
                              actionMut.mutate({
                                id: item.id,
                                action: "confirm",
                              })
                            }
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Cancel reservation (release it)">
                          <ActionIcon
                            color="orange"
                            variant="light"
                            loading={actionMut.isPending}
                            onClick={() =>
                              actionMut.mutate({
                                id: item.id,
                                action: "decline",
                              })
                            }
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip label="Edit">
                      <ActionIcon
                        variant="default"
                        onClick={() => openEdit(item)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete">
                      <ActionIcon
                        color="red"
                        variant="light"
                        loading={actionMut.isPending}
                        onClick={() =>
                          actionMut.mutate({ id: item.id, action: "delete" })
                        }
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Stack>
              }
            />
          ))}
        </SimpleGrid>
      )}

      <Modal
        opened={formOpen}
        onClose={() => {
          formHandlers.close();
          setEditing(null);
        }}
        title={editing ? "Edit item" : "Add item"}
        size="lg"
      >
        <ItemForm
          initial={editing ?? undefined}
          submitLabel={editing ? "Save changes" : "Create"}
          submitting={createMut.isPending || updateMut.isPending}
          onCancel={() => {
            formHandlers.close();
            setEditing(null);
          }}
          onSubmit={(input) =>
            editing
              ? updateMut.mutate({ id: editing.id, input })
              : createMut.mutate(input)
          }
        />
      </Modal>
    </Container>
  );
}
