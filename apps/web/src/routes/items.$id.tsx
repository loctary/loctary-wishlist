import {
  Anchor,
  Badge,
  Card,
  Center,
  Container,
  Group,
  Image,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getItem, type ItemStatus } from "../lib/api";
import { ReserveButton } from "../components/ReserveButton";

export const Route = createFileRoute("/items/$id")({
  component: ItemPage,
});

const STATUS: Record<ItemStatus, { color: string; label: string } | null> = {
  available: null,
  reserved: { color: "gray", label: "Reserved" },
  confirmed: { color: "teal", label: "Gifted" },
  declined: null,
};

function ItemPage() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ["item", id], queryFn: () => getItem(id) });

  return (
    <Container size="sm" py="xl">
      <Anchor component={Link} to="/" mb="md" display="inline-block">
        <Group gap={4}>
          <IconArrowLeft size={16} /> Back to wishlist
        </Group>
      </Anchor>

      {query.isLoading ? (
        <Center mih="40vh">
          <Loader />
        </Center>
      ) : query.isError || !query.data ? (
        <Center mih="40vh">
          <Stack align="center">
            <Text c="dimmed">This item couldn't be found.</Text>
            <Anchor component={Link} to="/">
              Go home
            </Anchor>
          </Stack>
        </Center>
      ) : (
        (() => {
          const item = query.data.item;
          const badge = STATUS[item.status];
          const price =
            item.price == null
              ? null
              : new Intl.NumberFormat(undefined, { style: "currency", currency: item.currency }).format(item.price);
          return (
            <Card withBorder radius="md" padding="lg">
              <Stack>
                {item.imageUrl && (
                  <Card.Section>
                    <Image src={item.imageUrl} alt={item.title} mah={360} fit="contain" />
                  </Card.Section>
                )}
                <Group justify="space-between" align="flex-start">
                  <Title order={2}>{item.title}</Title>
                  {badge && (
                    <Badge color={badge.color} variant="light">
                      {badge.label}
                    </Badge>
                  )}
                </Group>
                {item.description && <Text>{item.description}</Text>}
                {price && <Text fw={700} size="lg">{price}</Text>}
                {item.url && (
                  <Anchor href={item.url} target="_blank" rel="noopener noreferrer">
                    <Group gap={4}>
                      View product <IconExternalLink size={16} />
                    </Group>
                  </Anchor>
                )}
                <ReserveButton item={item} />
              </Stack>
            </Card>
          );
        })()
      )}
    </Container>
  );
}
