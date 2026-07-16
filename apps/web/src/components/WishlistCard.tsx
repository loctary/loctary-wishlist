import type { ReactNode } from "react";
import { Box, Card, Stack, Text, Title } from "@mantine/core";
import { IconEyeOff } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ItemStatus, WishItem } from "../lib/api";
import { tintFor } from "../lib/tint";
import { ImageCarousel } from "./ImageCarousel";
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
 *
 * `linked={false}` renders the same card without the detail-page links —
 * for cards backed by mock data (the landing-page demo) where the routes
 * don't exist.
 */
export function WishlistCard({
  item,
  onChange,
  footer,
  linked = true,
  coverIcon,
}: {
  item: WishItem;
  onChange?: (next: WishItem) => void;
  footer?: ReactNode;
  linked?: boolean;
  /** Empty-state cover glyph override (defaults to the gift icon). */
  coverIcon?: ReactNode;
}) {
  const badge = STATUS_BADGE[item.status];
  const price = formatPrice(item.price, item.currency);
  const tint = tintFor(item.id);
  const dim = item.status === "reserved" || item.status === "confirmed" || !item.isActive;

  const cover = (
    <>
      <ImageCarousel images={item.images} alt={item.title} bg={tint.bg} fg={tint.fg} icon={coverIcon} />
      {price && <span className="wl-pricetag">{price}</span>}
      {badge && (
        <span className="wl-statebadge" style={{ background: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      )}
      {/* Owner-only — inactive items never reach the public list. */}
      {!item.isActive && (
        <span
          className="wl-statebadge"
          style={{ left: 12, right: "auto", background: "var(--text-muted)", color: "#fff" }}
        >
          <IconEyeOff size={13} /> Hidden
        </span>
      )}
    </>
  );
  const coverStyle = { display: "block", position: "relative", color: tint.fg, textDecoration: "none" } as const;

  const title = (
    <Title order={5} fw={700} lineClamp={2} style={{ letterSpacing: "-0.01em" }}>
      {item.title}
    </Title>
  );

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
      {linked ? (
        <Link
          to="/user/$userId/wishlists/$wishlistId/$itemId"
          params={{ userId: item.ownerId, wishlistId: item.wishlistId, itemId: item.id }}
          style={coverStyle}
          aria-label={item.title}
        >
          {cover}
        </Link>
      ) : (
        <div style={coverStyle}>{cover}</div>
      )}

      <Stack gap={6} p="md" style={{ flex: 1 }}>
        {linked ? (
          <Link
            to="/user/$userId/wishlists/$wishlistId/$itemId"
            params={{ userId: item.ownerId, wishlistId: item.wishlistId, itemId: item.id }}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            {title}
          </Link>
        ) : (
          title
        )}

        {item.description && (
          <Text size="sm" c="dimmed" lineClamp={3} style={{ flex: 1 }}>
            {item.description}
          </Text>
        )}

        <Box mt="auto" pt={6}>
          {footer ?? <ReserveButton item={item} onChange={onChange} />}
        </Box>
      </Stack>
    </Card>
  );
}
