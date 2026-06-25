import { useEffect, useRef, useState } from "react";
import { Alert, Center, Loader, Stack } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { loadAuthMount } from "../lib/remoteAuth";
import { sessionQueryKey } from "../lib/session";
import type { AuthRoute } from "../lib/authTypes";

const AUTH_ROUTE_PATHS: Record<AuthRoute, string> = {
  login: "/login",
  register: "/register",
  "forgot-password": "/forgot-password",
  "reset-password": "/reset-password",
  "verify-email": "/verify-email",
};

/**
 * Mounts the loctary-auth widget (its self-routing `AuthApp`) into a div via the
 * remote's imperative `./mount` entry. Client-only: the MF runtime + the remote's
 * own React run in the browser, so nothing here executes during SSR.
 *
 * `AuthApp` handles inter-screen navigation internally (login ⇄ register ⇄ …),
 * so we deliberately omit `onNavigate` — that keeps it all in one mount and
 * avoids a host-route remount that would drop the in-progress email. On success
 * we refresh the session and send the user home.
 */
export function RemoteAuthPage({ initialRoute }: { initialRoute: AuthRoute }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unmount: (() => void) | undefined;
    let cancelled = false;

    loadAuthMount()
      .then((mount) => {
        if (cancelled || !ref.current) return;
        setReady(true);
        unmount = mount(ref.current, {
          apiUrl: import.meta.env.VITE_AUTH_API_URL,
          initialRoute,
          routes: AUTH_ROUTE_PATHS,
          onAuthenticated: () => {
            queryClient.invalidateQueries({ queryKey: sessionQueryKey });
            router.navigate({ to: "/" });
          },
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the sign-in form");
      });

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [initialRoute, router, queryClient]);

  if (error) {
    return (
      <Center mih="60vh" px="md">
        <Alert color="red" title="Sign-in unavailable" maw={420}>
          {error}. Make sure the auth app is running and reachable.
        </Alert>
      </Center>
    );
  }

  return (
    <Stack mih="60vh" justify="center">
      {!ready && (
        <Center>
          <Loader />
        </Center>
      )}
      <div ref={ref} />
    </Stack>
  );
}
