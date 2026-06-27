import type { MouseEvent } from "react";
import { Button, Tooltip } from "@mantine/core";
import { IconBookmarkPlus, IconCheck, IconGift, IconLock } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { cancelReservation, reserveItem, WishlistApiError, type WishItem } from "../lib/api";
import { useSession } from "../lib/session";

/**
 * The public reserve control. Logged-out users are sent to /login. The button
 * never reveals who reserved an item — it only reflects status. A user can
 * cancel only their *own* active reservation, but since the public projection
 * hides the reserver, we offer cancel only when the action succeeds/fails
 * (the backend enforces ownership).
 */
export function ReserveButton({ item, onChange }: { item: WishItem; onChange?: (next: WishItem) => void }) {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Reserving/cancelling touches every view of this item: the public lists
  // (`items`), the reserver's `/reserved` page (`my-reservations`), the owner's
  // management view (`manage-items`), and the item detail (`item`).
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
    queryClient.invalidateQueries({ queryKey: ["manage-items"] });
    queryClient.invalidateQueries({ queryKey: ["item", item.id] });
  };

  const reserve = useMutation({
    mutationFn: () => reserveItem(item.id),
    onSuccess: (res) => {
      notifications.show({ color: "teal", message: "Reserved — thank you!" });
      onChange?.(res.item);
      refresh();
    },
    onError: (e: unknown) => {
      const msg = e instanceof WishlistApiError ? e.message : "Could not reserve";
      notifications.show({ color: "red", message: msg });
      refresh();
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelReservation(item.id),
    onSuccess: (res) => {
      notifications.show({ color: "gray", message: "Reservation cancelled" });
      onChange?.(res.item);
      refresh();
    },
    onError: (e: unknown) => {
      const msg = e instanceof WishlistApiError ? e.message : "Could not cancel";
      notifications.show({ color: "red", message: msg });
    },
  });

  // Capability flags from the backend — true only for this viewer, so we can
  // render the right state (and tooltips) without revealing who reserved an item.
  const v = item.viewer;
  // A disabled-looking button that still shows its tooltip on hover (a truly
  // `disabled` button swallows pointer events, so Tooltip wouldn't fire).
  const blockClick = (e: MouseEvent<HTMLButtonElement>) => e.preventDefault();

  if (item.status === "confirmed") {
    return (
      <Button color="moss" variant="light" disabled fullWidth leftSection={<IconGift size={18} />}>
        Gifted
      </Button>
    );
  }

  if (item.status === "reserved") {
    if (v.canCancel) {
      return (
        <Tooltip label={v.isOwner ? "Release this reservation" : "Cancel your reservation"}>
          <Button
            variant="default"
            fullWidth
            loading={cancel.isPending}
            onClick={() => cancel.mutate()}
            leftSection={<IconCheck size={18} />}
          >
            Reserved · cancel
          </Button>
        </Tooltip>
      );
    }
    return (
      <Tooltip label="Only the person who reserved it or the wishlist owner can cancel.">
        <Button variant="default" fullWidth data-disabled onClick={blockClick} leftSection={<IconLock size={18} />}>
          Reserved
        </Button>
      </Tooltip>
    );
  }

  // Not reserved / confirmed → it's available (or otherwise not reservable).
  if (v.isOwner) {
    return (
      <Tooltip label="You can't reserve from your own wishlist.">
        <Button variant="default" fullWidth data-disabled onClick={blockClick} leftSection={<IconLock size={18} />}>
          Your item
        </Button>
      </Tooltip>
    );
  }

  if (!session) {
    return (
      <Button fullWidth onClick={() => router.navigate({ to: "/login" })} leftSection={<IconBookmarkPlus size={18} />}>
        Log in to reserve
      </Button>
    );
  }

  if (v.canReserve) {
    return (
      <Button fullWidth loading={reserve.isPending} onClick={() => reserve.mutate()} leftSection={<IconBookmarkPlus size={18} />}>
        Reserve
      </Button>
    );
  }

  return (
    <Button variant="default" disabled fullWidth>
      Unavailable
    </Button>
  );
}
