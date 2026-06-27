import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

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
  });
}
