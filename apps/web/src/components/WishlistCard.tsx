import { Badge, Card, Group, Image, Stack, Text, Anchor, Title } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ItemStatus, WishItem } from "../lib/api";
import { ReserveButton } from "./ReserveButton";

const STATUS_BADGE: Record<ItemStatus, { color: string; label: string } | null> = {
  available: null,
  reserved: { color: "gray", label: "Reserved" },
  confirmed: { color: "teal", label: "Gifted" },
  declined: null,
};

function formatPrice(price: number | null, currency: string) {
  if (price == null) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

export function WishlistCard({ item, onChange }: { item: WishItem; onChange?: (next: WishItem) => void }) {
  const badge = STATUS_BADGE[item.status];
  const price = formatPrice(item.price, item.currency);

  return (
    <Card withBorder radius="md" padding="md" h="100%">
      <Stack gap="sm" h="100%">
        {item.imageUrl && (
          <Card.Section>
            <Image src={item.imageUrl} alt={item.title} height={180} fit="cover" />
          </Card.Section>
        )}

        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Link
            to="/items/$id"
            params={{ id: item.id }}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Title order={5} fw={600} lineClamp={2}>
              {item.title}
            </Title>
          </Link>
          {badge && (
            <Badge color={badge.color} variant="light" style={{ flexShrink: 0 }}>
              {badge.label}
            </Badge>
          )}
        </Group>

        {item.description && (
          <Text size="sm" c="dimmed" lineClamp={3}>
            {item.description}
          </Text>
        )}

        <Group gap="xs" mt="auto" justify="space-between">
          {price && <Text fw={600}>{price}</Text>}
          {item.url && (
            <Anchor href={item.url} target="_blank" rel="noopener noreferrer" size="sm">
              <Group gap={4}>
                View <IconExternalLink size={14} />
              </Group>
            </Anchor>
          )}
        </Group>

        <ReserveButton item={item} onChange={onChange} />
      </Stack>
    </Card>
  );
}
