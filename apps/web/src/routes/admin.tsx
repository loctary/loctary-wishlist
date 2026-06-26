import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconEdit,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  adminConfirmItem,
  adminCreateItem,
  adminDeclineItem,
  adminDeleteItem,
  adminListItems,
  adminUpdateItem,
  WishlistApiError,
  type AdminWishItem,
  type ItemInput,
  type ItemStatus,
} from "../lib/api";
import { useSession } from "../lib/session";
import { ItemForm } from "../components/ItemForm";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const STATUS_COLOR: Record<ItemStatus, string> = {
  available: "moss",
  reserved: "amber",
  confirmed: "moss",
  declined: "gray",
};

function notifyError(e: unknown, fallback: string) {
  notifications.show({
    color: "red",
    message: e instanceof WishlistApiError ? e.message : fallback,
  });
}

function AdminPage() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminWishItem | null>(null);
  const [formOpen, formHandlers] = useDisclosure(false);

  const itemsQuery = useQuery({
    queryKey: ["admin-items"],
    queryFn: () => adminListItems(),
    enabled: session?.role === "admin",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-items"] });
    queryClient.invalidateQueries({ queryKey: ["items"] });
  };

  const createMut = useMutation({
    mutationFn: (input: ItemInput) => adminCreateItem(input),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Item created" });
      formHandlers.close();
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not create item"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ItemInput> }) => adminUpdateItem(id, input),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Item updated" });
      formHandlers.close();
      setEditing(null);
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not update item"),
  });

  const actionMut = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "confirm" | "decline" | "delete" }) => {
      if (action === "confirm") await adminConfirmItem(id);
      else if (action === "decline") await adminDeclineItem(id);
      else await adminDeleteItem(id);
    },
    onSuccess: () => invalidate(),
    onError: (e) => notifyError(e, "Action failed"),
  });

  if (sessionLoading) {
    return (
      <Center mih="50vh">
        <Loader />
      </Center>
    );
  }

  if (!session || session.role !== "admin") {
    return (
      <Container size="sm" py="xl">
        <Alert color="red" title="Admins only">
          You need an admin account to manage the wishlist.
        </Alert>
      </Container>
    );
  }

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
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={1}>Manage wishlist</Title>
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
        <Stack>
          {items.map((item) => (
            <Card key={item.id} withBorder padding="md" radius="lg">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={4} style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Text fw={600}>{item.title}</Text>
                    <Badge color={STATUS_COLOR[item.status]} variant="light">
                      {item.status}
                    </Badge>
                  </Group>
                  {item.reserver && (
                    <Text size="sm" c="dimmed">
                      Reserved by {item.reserver.name ?? item.reserver.email ?? item.reserver.id}
                    </Text>
                  )}
                </Stack>

                <Group gap="xs" wrap="nowrap">
                  {item.status === "reserved" && (
                    <>
                      <Tooltip label="Confirm gift presented" withArrow>
                        <ActionIcon
                          color="teal"
                          variant="light"
                          loading={actionMut.isPending}
                          onClick={() => actionMut.mutate({ id: item.id, action: "confirm" })}
                        >
                          <IconCheck size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Decline / release reservation" withArrow>
                        <ActionIcon
                          color="orange"
                          variant="light"
                          loading={actionMut.isPending}
                          onClick={() => actionMut.mutate({ id: item.id, action: "decline" })}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip label="Edit" withArrow>
                    <ActionIcon variant="default" onClick={() => openEdit(item)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete" withArrow>
                    <ActionIcon
                      color="red"
                      variant="light"
                      loading={actionMut.isPending}
                      onClick={() => actionMut.mutate({ id: item.id, action: "delete" })}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
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
