import { useEffect, useRef, useState } from "react";
import { Alert, Box, Center, Loader } from "@mantine/core";
import { useRouter } from "@tanstack/react-router";
import { loadAuthPageMount, loadAuthStore } from "../lib/remoteAuth";
import { AUTH_PATHS, redirectTarget } from "../lib/authNav";
import type { AuthMountKey } from "../lib/authTypes";

/**
 * Mounts ONE loctary-auth page (`page`) into a div via the remote's imperative
 * `./mountPage` entry. Client-only: the MF runtime + the remote's own React run
 * in the browser, so nothing here executes during SSR.
 *
 * Inter-screen links are wired to the HOST router via `onNavigate`. On
 * successful auth we refresh the federated `authStore` — host `useSession`
 * subscribers (header, guards) re-render automatically; profile edits made
 * inside the embedded widget propagate the same way without any wiring here.
 */
export function RemoteAuthPage({ page, redirect }: { page: AuthMountKey; redirect?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unmount: (() => void) | undefined;
    let cancelled = false;

    // Where to land once authenticated: the page the user came from, else home.
    const target = redirectTarget(redirect);

    loadAuthPageMount()
      .then((mount) => {
        if (cancelled || !ref.current) return;
        setReady(true);
        unmount = mount(ref.current, {
          page,
          apiUrl: import.meta.env.VITE_AUTH_API_URL,
          routes: AUTH_PATHS,
          // Google OAuth leaves the SPA entirely, so the return target can't ride
          // a JS callback — it goes through the server as a full URL. Same origin,
          // plus the path, so the auth server (which allowlists by origin) returns
          // the user to exactly where they started.
          oauthRedirect:
            typeof window !== "undefined" ? window.location.origin + target : undefined,
          onNavigate: (_to, route, params) => {
            router.navigate({
              to: AUTH_PATHS[route],
              // Carry the in-progress email AND the redirect across auth screens
              // (e.g. login → register) so the target survives the whole flow.
              search: {
                ...(params?.email ? { email: params.email } : {}),
                ...(redirect ? { redirect } : {}),
              },
            });
          },
          onAuthenticated: () => {
            // The login/register pages don't write to the federated `authStore`
            // (only the profile page does). Refresh it so the header reflects
            // the new identity immediately, then navigate home.
            void loadAuthStore().then((s) => s.refresh());
            router.navigate({ to: target });
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
  }, [page, redirect, router]);

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
