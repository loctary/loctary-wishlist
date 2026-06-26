import { useEffect } from "react";
import {
  Button,
  Center,
  Container,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconConfetti, IconListCheck } from "@tabler/icons-react";
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
      <Stack gap="xl">
        <Group gap="md" align="center" wrap="nowrap">
          <ThemeIcon size={60} radius="xl" variant="light" color="moss">
            <IconListCheck size={30} />
          </ThemeIcon>
          <div>
            <Title order={1} style={{ letterSpacing: "-0.03em" }}>
              My wishlist
            </Title>
            <Text c="dimmed" mt={4}>
              Browse the list and reserve a gift. Reserved items stay anonymous.
            </Text>
          </div>
        </Group>

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
                <Stack align="center" gap={6}>
                  <IconConfetti size={22} style={{ color: "var(--text-muted)", opacity: 0.6 }} />
                  <Text size="sm" c="dimmed">
                    That's the whole list — {items.length} items.
                  </Text>
                </Stack>
              )}
            </Center>
          </>
        )}
      </Stack>
    </Container>
  );
}
