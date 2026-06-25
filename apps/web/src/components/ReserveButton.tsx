import { Button, Tooltip } from "@mantine/core";
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

  const reserve = useMutation({
    mutationFn: () => reserveItem(item.id),
    onSuccess: (res) => {
      notifications.show({ color: "teal", message: "Reserved — thank you!" });
      onChange?.(res.item);
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof WishlistApiError ? e.message : "Could not reserve";
      notifications.show({ color: "red", message: msg });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelReservation(item.id),
    onSuccess: (res) => {
      notifications.show({ color: "gray", message: "Reservation cancelled" });
      onChange?.(res.item);
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof WishlistApiError ? e.message : "Could not cancel";
      notifications.show({ color: "red", message: msg });
    },
  });

  if (item.status === "confirmed") {
    return (
      <Button color="teal" variant="light" disabled fullWidth>
        Gifted 🎉
      </Button>
    );
  }

  if (item.status === "reserved") {
    if (!session) {
      return (
        <Button variant="light" color="gray" disabled fullWidth>
          Reserved
        </Button>
      );
    }
    // Logged-in: offer cancel; the backend allows it only for the owner of the
    // reservation and otherwise returns a clear error.
    return (
      <Tooltip label="Cancel if this is your reservation" withArrow>
        <Button
          variant="light"
          color="gray"
          fullWidth
          loading={cancel.isPending}
          onClick={() => cancel.mutate()}
        >
          Reserved · cancel
        </Button>
      </Tooltip>
    );
  }

  if (!session) {
    return (
      <Button fullWidth onClick={() => router.navigate({ to: "/login" })}>
        Log in to reserve
      </Button>
    );
  }

  return (
    <Button fullWidth loading={reserve.isPending} onClick={() => reserve.mutate()}>
      Reserve
    </Button>
  );
}
