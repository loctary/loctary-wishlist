import { useEffect, useRef, useState } from "react";
import { Alert, Box, Center, Loader } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { loadAuthPageMount, loadAuthStore } from "../lib/remoteAuth";
import { sessionQueryKey } from "../lib/session";
import { AUTH_PATHS, redirectTarget } from "../lib/authNav";
import type { AuthMountKey, AuthUser } from "../lib/authTypes";

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
export function RemoteAuthPage({ page, redirect }: { page: AuthMountKey; redirect?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
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
            // The session changed → every cached response was computed for the
            // previous (anonymous) user, incl. per-item `viewer` flags. Invalidate
            // the whole cache so everything refetches for the new user.
            queryClient.invalidateQueries();
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
  }, [page, redirect, router, queryClient]);

  // Reflect edits made inside the embedded widget (e.g. the profile page changing
  // name/avatar): the auth remote's authStore is the same singleton the widget
  // updates, so when the user actually changes we refetch the host session
  // (/wishlist/me) and the header etc. update live — no manual wiring per action.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    // Key on the user's identity + the fields the host shows, so we ignore the
    // store's transient "loading" emits and no-op refetches (only invalidate on a
    // real change). Baseline is the snapshot at subscribe time → no missed edits
    // regardless of whether the initial /auth/me load has resolved yet.
    const keyOf = (s: { user: AuthUser | null }) =>
      s.user ? `${s.user.id}|${s.user.name ?? ""}|${s.user.avatarUrl ?? ""}` : "anon";
    loadAuthStore()
      .then((store) => {
        if (cancelled) return;
        let last = keyOf(store.getSnapshot());
        unsub = store.subscribe(() => {
          const key = keyOf(store.getSnapshot());
          if (key === last) return;
          last = key;
          void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
        });
      })
      .catch(() => {
        /* auth remote unreachable — the mount above already surfaces that */
      });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [queryClient]);

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
