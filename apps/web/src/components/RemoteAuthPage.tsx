import { useEffect, useRef, useState } from "react";
import { Alert, Box, Center, Loader } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { loadAuthPageMount } from "../lib/remoteAuth";
import { sessionQueryKey } from "../lib/session";
import { AUTH_PATHS } from "../lib/authNav";
import type { AuthMountKey } from "../lib/authTypes";

/**
 * Mounts ONE loctary-auth page (`page`) into a div via the remote's imperative
 * `./mountPage` entry. Client-only: the MF runtime + the remote's own React run
 * in the browser, so nothing here executes during SSR.
 *
 * Unlike the old whole-`AuthApp` embed, links between auth screens are wired to
 * the HOST router: `onNavigate` pushes the matching host route (carrying any
 * `email` in the query), so each screen is its own URL and its own mount. On
 * success we refresh the session and send the user home.
 */
export function RemoteAuthPage({ page }: { page: AuthMountKey }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unmount: (() => void) | undefined;
    let cancelled = false;

    loadAuthPageMount()
      .then((mount) => {
        if (cancelled || !ref.current) return;
        setReady(true);
        unmount = mount(ref.current, {
          page,
          apiUrl: import.meta.env.VITE_AUTH_API_URL,
          routes: AUTH_PATHS,
          onNavigate: (_to, route, params) => {
            router.navigate({
              to: AUTH_PATHS[route],
              search: params?.email ? { email: params.email } : {},
            });
          },
          onAuthenticated: () => {
            queryClient.invalidateQueries({ queryKey: sessionQueryKey });
            router.navigate({ to: "/" });
          },
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the auth page");
      });

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [page, router, queryClient]);

  if (error) {
    return (
      <Center style={{ flex: 1 }} px="md">
        <Alert color="red" title="Auth unavailable" maw={420}>
          {error}. Make sure the auth app is running and reachable.
        </Alert>
      </Center>
    );
  }

  return (
    <Box
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
      }}
    >
      {!ready && (
        <Center>
          <Loader />
        </Center>
      )}
      <div ref={ref} style={{ width: "100%" }} />
    </Box>
  );
}
