import { useEffect, useRef } from "react";
import { Center, Loader } from "@mantine/core";
import { useRouter, useSearch } from "@tanstack/react-router";
import { useSession } from "../lib/session";
import { RemoteAuthPage } from "./RemoteAuthPage";
import { redirectTarget } from "../lib/authNav";
import type { AuthRoute } from "../lib/authTypes";

/**
 * Wraps an embedded auth page with the "only when logged out" guard. Logged-in
 * users are bounced home (or to `redirect`). Client-side check — the embedded
 * page only mounts in the browser anyway.
 *
 * Once the initial bootstrap has resolved we never go back to the loader: a
 * background `authStore.invalidate()` would otherwise tear down `RemoteAuthPage`
 * and re-mount it, which can trigger the loop ProfileScreen hits.
 */
export function AuthScreen({ page }: { page: AuthRoute }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const { redirect } = useSearch({ strict: false });

  useEffect(() => {
    if (user) router.navigate({ to: redirectTarget(redirect) });
  }, [user, router, redirect]);

  const bootstrapped = useRef(false);
  if (!loading) bootstrapped.current = true;

  if (user || (!bootstrapped.current && loading)) {
    return (
      <Center style={{ flex: 1 }}>
        <Loader />
      </Center>
    );
  }

  return <RemoteAuthPage page={page} redirect={redirect} />;
}
