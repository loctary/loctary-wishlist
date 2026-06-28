import { useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  manageConfirmItem,
  manageDeclineItem,
  manageDeleteItem,
  manageSetActive,
  manageUpdateItem,
  WishlistApiError,
  type AdminWishItem,
  type ItemInput,
} from "../lib/api";
import { ItemForm } from "./ItemForm";
import { UserLink } from "./UserLink";

/**
 * The full owner-side toolset for a single item: reserver line, approve/cancel
 * a reservation, hide/show, edit, delete. Owns its own edit + delete modals and
 * mutations so it can drop in anywhere — used as the `WishlistCard` footer in
 * `OwnerWishlist` and on the item detail page when the viewer owns the item.
 *
 * Invalidates the same query keys the parent would: `manage-items` (the owner
 * grid), `items` (any public list of theirs), `my-reservations`, and the
 * per-item `item` cache that the detail page reads from.
 *
 * @param onDeleted Fires after a successful delete so the parent can navigate
 *   away (the detail page does — the item is gone). The owner grid doesn't
 *   need it: invalidating `manage-items` drops the card.
 */
export function OwnerItemActions({
  item,
  onDeleted,
}: {
  item: AdminWishItem;
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const [editOpen, editHandlers] = useDisclosure(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["manage-items"] });
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["my-reservations"] });
    qc.invalidateQueries({ queryKey: ["item"] });
  };

  const notifyError = (e: unknown, fallback: string) =>
    notifications.show({
      color: "red",
      message: e instanceof WishlistApiError ? e.message : fallback,
    });

  const updateMut = useMutation({
    mutationFn: (input: Partial<ItemInput>) => manageUpdateItem(item.id, input),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Item updated" });
      editHandlers.close();
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not update item"),
  });

  const setActiveMut = useMutation({
    mutationFn: (active: boolean) => manageSetActive(item.id, active),
    onSuccess: (_r, active) => {
      notifications.show({
        color: "teal",
        message: active ? "Item is now visible" : "Item hidden",
      });
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not update visibility"),
  });

  const confirmMut = useMutation({
    mutationFn: () => manageConfirmItem(item.id),
    onSuccess: invalidate,
    onError: (e) => notifyError(e, "Could not confirm reservation"),
  });

  const declineMut = useMutation({
    mutationFn: () => manageDeclineItem(item.id),
    onSuccess: invalidate,
    onError: (e) => notifyError(e, "Could not cancel reservation"),
  });

  const deleteMut = useMutation({
    mutationFn: () => manageDeleteItem(item.id),
    onSuccess: () => {
      setDeleteOpen(false);
      invalidate();
      onDeleted?.();
    },
    onError: (e) => notifyError(e, "Could not delete item"),
  });

  const locked = item.status === "reserved" || item.status === "confirmed";

  return (
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
                loading={confirmMut.isPending}
                onClick={() => confirmMut.mutate()}
              >
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Cancel reservation (release it)">
              <ActionIcon
                color="orange"
                variant="light"
                loading={declineMut.isPending}
                onClick={() => declineMut.mutate()}
              >
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        )}

        <Tooltip
          label={
            item.status === "reserved"
              ? "Can't change a reserved item"
              : item.isActive
                ? "Hide from your wishlist"
                : "Show on your wishlist"
          }
        >
          <ActionIcon
            variant="default"
            loading={setActiveMut.isPending}
            disabled={item.status === "reserved"}
            onClick={() => setActiveMut.mutate(!item.isActive)}
          >
            {item.isActive ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </ActionIcon>
        </Tooltip>

        <Tooltip
          label={
            item.status === "reserved"
              ? "Cannot edit reserved item"
              : item.status === "confirmed"
                ? "Gifted items can't be edited"
                : "Edit"
          }
        >
          <ActionIcon
            variant="default"
            onClick={editHandlers.open}
            disabled={locked}
          >
            <IconEdit size={16} />
          </ActionIcon>
        </Tooltip>

        <Tooltip
          label={
            item.status === "reserved"
              ? "Cannot delete reserved item"
              : item.status === "confirmed"
                ? "Gifted items can't be deleted — hide it instead"
                : "Delete"
          }
        >
          <ActionIcon
            color="red"
            variant="light"
            disabled={locked}
            onClick={() => setDeleteOpen(true)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Modal
        opened={editOpen}
        onClose={editHandlers.close}
        title="Edit item"
        size="lg"
        centered
      >
        <ItemForm
          initial={item}
          submitLabel="Save changes"
          submitting={updateMut.isPending}
          onCancel={editHandlers.close}
          onSubmit={(input) => updateMut.mutate(input)}
        />
      </Modal>

      <Modal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete item"
        size="sm"
        centered
      >
        <Stack>
          <Text size="sm">
            Delete <strong>{item.title}</strong>? This can&apos;t be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
