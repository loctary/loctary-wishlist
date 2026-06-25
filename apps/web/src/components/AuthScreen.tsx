import { useEffect } from "react";
import { Center, Loader } from "@mantine/core";
import { useRouter } from "@tanstack/react-router";
import { useSession } from "../lib/session";
import { RemoteAuthPage } from "./RemoteAuthPage";
import type { AuthRoute } from "../lib/authTypes";

/**
 * Wraps an embedded auth screen with the "only when logged out" guard. Logged-in
 * users are bounced home. The check is client-side (the session cookie isn't
 * available to SSR fetches here); the embedded widget only mounts in the
 * browser anyway.
 */
export function AuthScreen({ initialRoute }: { initialRoute: AuthRoute }) {
  const { data: session, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && session) router.navigate({ to: "/" });
  }, [isLoading, session, router]);

  if (isLoading || session) {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    );
  }

  return <RemoteAuthPage initialRoute={initialRoute} />;
}
