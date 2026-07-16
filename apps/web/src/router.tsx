import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { Center, Loader } from "@mantine/core";
import { routeTree } from "./routeTree.gen";
import { NotFoundScreen } from "./components/NotFoundScreen";

/**
 * TanStack Start discovers the router via this `getRouter` export. We create a
 * per-request QueryClient and pass it through the router context so routes and
 * the root document share one cache.
 */
export function getRouter() {
  const queryClient = new QueryClient({
    // staleTime 0 → lists refetch on mount/navigation so you always see current
    // data when you come back. The session query opts into its own 30s staleTime.
    defaultOptions: { queries: { staleTime: 0, retry: 1 } },
  });

  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    scrollRestoration: true,
    // Any URL that doesn't match a route renders the brand 404 inside the
    // app shell (data-level misses render the same screen from their views).
    defaultNotFoundComponent: () => <NotFoundScreen />,
    // Routes are code-split; while a route chunk loads the router keeps the
    // PREVIOUS page on screen for `pendingMs` before swapping to the pending
    // component. The default (1s) reads as "the old wishlist flashes with the
    // wrong data" — swap to a loader almost immediately instead.
    defaultPendingMs: 100,
    defaultPendingMinMs: 200,
    defaultPendingComponent: () => (
      <Center style={{ flex: 1 }}>
        <Loader />
      </Center>
    ),
  });
}
