import { useEffect } from "react";
import { Center, Loader } from "@mantine/core";
import { useRouter } from "@tanstack/react-router";
import { useSession } from "../lib/session";
import { RemoteAuthPage } from "./RemoteAuthPage";

/**
 * The profile route, guarded as "only when logged in" — the mirror of
 * `AuthScreen`. Anonymous visitors are bounced to /login. The check is
 * client-side (the session cookie isn't available to SSR fetches here).
 */
export function ProfileScreen() {
  const { data: session, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) router.navigate({ to: "/login" });
  }, [isLoading, session, router]);

  if (isLoading || !session) {
    return (
      <Center style={{ flex: 1 }}>
        <Loader />
      </Center>
    );
  }

  return <RemoteAuthPage page="profile" />;
}
