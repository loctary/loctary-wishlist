import { useEffect } from "react";
import { Center, Loader } from "@mantine/core";
import { useRouter } from "@tanstack/react-router";
import { useSession } from "../lib/session";
import { RemoteAuthPage } from "./RemoteAuthPage";

/**
 * The profile route, guarded as "only when logged in" — the mirror of
 * `AuthScreen`. Anonymous visitors are bounced to /login. Profile edits made
 * inside the embedded widget propagate to the rest of the host automatically:
 * the widget and `useSession` subscribe to the same federated `authStore`.
 *
 * Loader is shown ONLY on the initial bootstrap (no user yet). Once a user is
 * seen we keep `RemoteAuthPage` mounted across background `authStore.invalidate()`
 * refreshes — otherwise the remote ProfilePage's mount-time `invalidate()` flips
 * the store's `loading` back to `true`, we'd unmount the remote, then mount it
 * again on resolution → it calls `invalidate()` again → infinite loop.
 */
export function ProfileScreen() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login", search: { redirect: "/profile" } });
  }, [loading, user, router]);

  if (!user) {
    return (
      <Center style={{ flex: 1 }}>
        <Loader />
      </Center>
    );
  }

  return <RemoteAuthPage page="profile" />;
}
