import { useEffect } from "react";
import {
  Button,
  Center,
  Container,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useInViewport } from "@mantine/hooks";
import { listItems } from "../lib/api";
import { WishlistCard } from "../components/WishlistCard";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  // owner omitted → the backend uses WISHLIST_OWNER_ID (the admin's list).
  const query = useInfiniteQuery({
    queryKey: ["items"],
    queryFn: ({ pageParam }) => listItems({ cursor: pageParam, limit: 12 }),
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

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>My Wishlist</Title>
          <Text c="dimmed">Browse the list and reserve a gift. Reserved items stay anonymous.</Text>
        </div>

        {query.isLoading ? (
          <Center mih="40vh">
            <Loader />
          </Center>
        ) : query.isError ? (
          <Center mih="40vh">
            <Stack align="center">
              <Text c="red">Could not load the wishlist.</Text>
              <Button variant="light" onClick={() => query.refetch()}>
                Retry
              </Button>
            </Stack>
          </Center>
        ) : items.length === 0 ? (
          <Center mih="40vh">
            <Text c="dimmed">Nothing here yet — check back soon.</Text>
          </Center>
        ) : (
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
                <Text size="sm" c="dimmed">
                  That's everything.
                </Text>
              )}
            </Center>
          </>
        )}
      </Stack>
    </Container>
  );
}
