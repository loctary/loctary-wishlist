import { Anchor, Box, Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconExternalLink, IconGift } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ItemStatus, WishItem } from "../lib/api";
import { tintFor } from "../lib/tint";
import { ReserveButton } from "./ReserveButton";

const STATUS_BADGE: Record<
  ItemStatus,
  { bg: string; color: string; label: string } | null
> = {
  available: null,
  reserved: { bg: "var(--clay-8)", color: "#fff", label: "Reserved" },
  confirmed: { bg: "var(--color-secondary)", color: "#fff", label: "Gifted" },
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
  const tint = tintFor(item.id);
  const dim = item.status === "reserved" || item.status === "confirmed";

  return (
    <Card
      withBorder
      radius="lg"
      padding={0}
      h="100%"
      className="wl-card"
      data-dim={dim ? "true" : undefined}
      style={{ display: "flex", flexDirection: "column" }}
    >
      <Box className="wl-cover" style={{ background: tint.bg }}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} />
        ) : (
          <IconGift size={54} style={{ color: tint.fg }} />
        )}
        {price && <span className="wl-pricetag">{price}</span>}
        {badge && (
          <span className="wl-statebadge" style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        )}
      </Box>

      <Stack gap={6} p="md" style={{ flex: 1 }}>
        <Link
          to="/items/$id"
          params={{ id: item.id }}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <Title order={5} fw={700} lineClamp={2} style={{ letterSpacing: "-0.01em" }}>
            {item.title}
          </Title>
        </Link>

        {item.description && (
          <Text size="sm" c="dimmed" lineClamp={3} style={{ flex: 1 }}>
            {item.description}
          </Text>
        )}

        {item.url && (
          <Anchor href={item.url} target="_blank" rel="noopener noreferrer" size="sm">
            <Group gap={4}>
              View <IconExternalLink size={14} />
            </Group>
          </Anchor>
        )}

        <Box mt="auto" pt={6}>
          <ReserveButton item={item} onChange={onChange} />
        </Box>
      </Stack>
    </Card>
  );
}
