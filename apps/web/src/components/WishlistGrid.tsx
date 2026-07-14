import { useEffect } from "react";
import { Button, Center, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconConfetti } from "@tabler/icons-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInViewport } from "@mantine/hooks";
import { listItems } from "../lib/api";
import { WishlistCard } from "./WishlistCard";

/**
 * Public, infinite-scrolling grid of ONE wishlist. Rendered inside the visitor
 * view of `/user/$userId/wishlists/$wishlistId`. Query key is list-scoped so
 * different lists don't share a cache; `ReserveButton`'s broad `["items"]`
 * invalidation still matches via prefix.
 */
export function WishlistGrid({ wishlistId }: { wishlistId: string }) {
  const query = useInfiniteQuery({
    queryKey: ["items", wishlistId],
    queryFn: ({ pageParam }) => listItems({ wishlist: wishlistId, cursor: pageParam, limit: 12 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const { ref, inViewport } = useInViewport();
  useEffect(() => {
    if (inViewport && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [inViewport, query]);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (query.isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  if (query.isError) {
    return (
      <Center mih="40vh">
        <Stack align="center">
          <Text c="red">Could not load the wishlist.</Text>
          <Button variant="light" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Stack>
      </Center>
    );
  }

  if (items.length === 0) {
    return (
      <Center mih="40vh">
        <Text c="dimmed">Nothing here yet — check back soon.</Text>
      </Center>
    );
  }

  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
        {items.map((item) => (
          <WishlistCard key={item.id} item={item} />
        ))}
      </SimpleGrid>

      <Center ref={ref} mih={48}>
        {query.isFetchingNextPage ? (
          <Loader size="sm" />
        ) : query.hasNextPage ? (
          <Button variant="subtle" onClick={() => query.fetchNextPage()}>
            Load more
          </Button>
        ) : (
          <Stack align="center" gap={6}>
            <IconConfetti size={22} style={{ color: "var(--text-muted)", opacity: 0.6 }} />
            <Text size="sm" c="dimmed">
              That's the whole list — {items.length} items.
            </Text>
          </Stack>
        )}
      </Center>
    </>
  );
}
