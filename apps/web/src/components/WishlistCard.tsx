import type { ReactNode } from "react";
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

/**
 * One wishlist item card. By default the footer is the public `ReserveButton`;
 * pass `footer` (e.g. owner edit/delete/approve controls) to swap it while
 * keeping the identical cover/title/price visuals.
 */
export function WishlistCard({
  item,
  onChange,
  footer,
}: {
  item: WishItem;
  onChange?: (next: WishItem) => void;
  footer?: ReactNode;
}) {
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
      <Link
        to="/user/$userId/wishlist/$itemId"
        params={{ userId: item.ownerId, itemId: item.id }}
        className="wl-cover"
        style={{ background: tint.bg, color: tint.fg, textDecoration: "none" }}
        aria-label={item.title}
      >
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
      </Link>

      <Stack gap={6} p="md" style={{ flex: 1 }}>
        <Link
          to="/user/$userId/wishlist/$itemId"
          params={{ userId: item.ownerId, itemId: item.id }}
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
          {footer ?? <ReserveButton item={item} onChange={onChange} />}
        </Box>
      </Stack>
    </Card>
  );
}
