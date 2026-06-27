import { useEffect } from "react";
import { Center, Loader } from "@mantine/core";
import { useRouter, useSearch } from "@tanstack/react-router";
import { useSession } from "../lib/session";
import { RemoteAuthPage } from "./RemoteAuthPage";
import { redirectTarget } from "../lib/authNav";
import type { AuthRoute } from "../lib/authTypes";

/**
 * Wraps an embedded auth page with the "only when logged out" guard. Logged-in
 * users are bounced home. The check is client-side (the session cookie isn't
 * available to SSR fetches here); the embedded page only mounts in the browser
 * anyway.
 */
export function AuthScreen({ page }: { page: AuthRoute }) {
  const { data: session, isLoading } = useSession();
  const router = useRouter();
  const { redirect } = useSearch({ strict: false });

  useEffect(() => {
    if (!isLoading && session) router.navigate({ to: redirectTarget(redirect) });
  }, [isLoading, session, router, redirect]);

  if (isLoading || session) {
    return (
      <Center style={{ flex: 1 }}>
        <Loader />
      </Center>
    );
  }

  return <RemoteAuthPage page={page} redirect={redirect} />;
}
