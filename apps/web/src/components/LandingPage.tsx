import { useState } from "react";
import {
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import {
  IconAdjustments,
  IconBookmark,
  IconBookmarkPlus,
  IconCheck,
  IconCopy,
  IconDisc,
  IconEyeOff,
  IconGift,
  IconHandClick,
  IconLink,
  IconListCheck,
  IconLock,
  IconPalette,
  IconPlus,
  IconRoute,
  IconShare,
  IconToggleRight,
  IconToolsKitchen2,
  IconWorld,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { notifications } from "@mantine/notifications";
import type { WishItem } from "../lib/api";
import { tintFor } from "../lib/tint";
import { useSession } from "../lib/session";
import { WishlistCard } from "./WishlistCard";

/* ------------------------------- mock data ------------------------------- */

/**
 * The hero demo runs the real `WishlistCard` on local mock items so visitors
 * can try the reserve interaction without an account (and without hitting the
 * API). `linked=false` keeps the cards from navigating to routes that don't
 * exist for these ids.
 */
type DemoItem = WishItem & { mine: boolean };

function demoItem(input: {
  id: string;
  title: string;
  description: string;
  price: number | null;
  url: string | null;
  images: string[];
  status: WishItem["status"];
}): DemoItem {
  return {
    id: input.id,
    ownerId: "demo",
    wishlistId: "demo",
    title: input.title,
    description: input.description,
    url: input.url,
    price: input.price,
    currency: "EUR",
    position: 0,
    status: input.status,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    images: input.images,
    viewer: { isOwner: false, isReserver: false, canReserve: true, canCancel: false },
    mine: false,
  };
}

const HERO_ITEMS: DemoItem[] = [
  demoItem({
    id: "demo-airpods",
    title: "AirPods Pro",
    description: "Active noise-cancelling earbuds — the everyday pair.",
    price: 249,
    url: "https://www.apple.com/ua/airpods-pro/",
    images: ["https://images.loctary.com/wishlist/c2e238a6-2be9-42cc-806d-9c569637128e.webp"],
    status: "available",
  }),
  demoItem({
    id: "demo-camera",
    title: "Olympus 35 DC rangefinder",
    description: "A vintage 35mm rangefinder for slow, considered photos.",
    price: 250,
    url: "https://ohsocult.com/products/olympus-35-dc-rangefinder-vintage-35mm-film-camera",
    images: ["https://images.loctary.com/wishlist/67683b86-f19d-49b7-bc6b-c28f02b61b4e.webp"],
    status: "reserved",
  }),
  demoItem({
    id: "demo-mugs",
    title: "\"Winter Is Coming\" mug",
    description: "A stainless-steel Game of Thrones mug — for the coldest mornings.",
    price: 25,
    url: "https://www.amazon.de/-/en/Nemesis-Now-Thrones-Stainless-B3697J7/dp/B075GS9YS8",
    images: ["https://images.loctary.com/wishlist/b39e1721-a407-4c37-9da5-9dadad7f9f86.webp"],
    status: "available",
  }),
];

const STEPS = [
  {
    n: 1,
    icon: IconListCheck,
    title: "Create a wishlist",
    body: "Start a list for your birthday, the holidays, a wedding — anything. Add as many lists as you like.",
  },
  {
    n: 2,
    icon: IconGift,
    title: "Add your wishes",
    body: "Each wish gets a photo, price, link and priority. Change your mind? Hide a wish and it quietly disappears from everyone.",
  },
  {
    n: 3,
    icon: IconBookmark,
    title: "Friends reserve",
    body: "Logged-in friends claim a gift with one tap. A reserved wish is locked for everyone else — only they (or you) can release it.",
  },
];

const SHARE_POINTS: Array<[typeof IconLink, string]> = [
  [IconLink, "Share with one link — no accounts needed to view"],
  [IconEyeOff, "Private mode deactivates the whole list instantly"],
  [IconToggleRight, "Show or hide individual wishes any time"],
];

const DEMO_WISHES = [
  { id: "w1", title: "Record player", icon: IconDisc, price: 299, active: true },
  { id: "w2", title: "Watercolor set", icon: IconPalette, price: 52, active: true },
  { id: "w3", title: "Cast-iron pan", icon: IconToolsKitchen2, price: 75, active: false },
];

function demoPrice(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

/* ----------------------------- demo controls ----------------------------- */

/** Local-state stand-in for `ReserveButton` — same visuals, no API. */
function DemoReserveButton({
  item,
  onReserve,
  onCancel,
}: {
  item: DemoItem;
  onReserve: (item: DemoItem) => void;
  onCancel: (item: DemoItem) => void;
}) {
  if (item.status === "reserved" && !item.mine) {
    return (
      <Button variant="default" fullWidth disabled leftSection={<IconLock size={18} />}>
        Reserved
      </Button>
    );
  }
  if (item.mine) {
    return (
      <Button variant="default" fullWidth onClick={() => onCancel(item)} leftSection={<IconCheck size={18} />}>
        Reserved · cancel
      </Button>
    );
  }
  return (
    <Button fullWidth onClick={() => onReserve(item)} leftSection={<IconBookmarkPlus size={18} />}>
      Reserve
    </Button>
  );
}

/* -------------------------------- sections ------------------------------- */

/** Session-aware primary CTA: sign-up for visitors, "my page" once logged in. */
function PrimaryCta({ label, size = "md" }: { label: string; size?: "md" | "lg" }) {
  const { user: session } = useSession();
  const height = size === "lg" ? 48 : undefined;

  if (session) {
    return (
      <Button
        size={size}
        h={height}
        leftSection={<IconListCheck size={18} />}
        renderRoot={(props) => <Link to="/user/$userId" params={{ userId: session.id }} {...props} />}
      >
        Go to my page
      </Button>
    );
  }
  return (
    <Button
      size={size}
      h={height}
      leftSection={<IconPlus size={18} />}
      renderRoot={(props) => <Link to="/register" {...props} />}
    >
      {label}
    </Button>
  );
}

function Hero() {
  const [items, setItems] = useState(HERO_ITEMS);

  const onReserve = (item: DemoItem) => {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: "reserved" as const, mine: true } : it)),
    );
    notifications.show({ color: "teal", message: "Reserved — it's yours to gift" });
  };
  const onCancel = (item: DemoItem) => {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: "available" as const, mine: false } : it)),
    );
    notifications.show({ color: "gray", message: "Reservation cancelled" });
  };

  return (
    <Box component="section" className="ld-section" pt={72} pb={40} ta="center">
      <span className="ld-eyebrow">
        <IconGift size={14} />
        Gifting, without the doubles
      </span>
      <h1 className="ld-h1">
        Wish for it.
        <br />
        Friends handle the rest.
      </h1>
      <p className="ld-lead" style={{ margin: "0 auto 30px", textAlign: "center" }}>
        Make a wishlist, share one link, and let friends quietly reserve gifts — so nobody shows up
        with the same thing twice. You never see who claimed what.
      </p>
      <Group justify="center" gap={12} mb={56}>
        <PrimaryCta label="Create your wishlist" size="lg" />
        <Button
          component="a"
          href="#features"
          variant="default"
          size="lg"
          h={48}
          c="var(--text-secondary)"
        >
          See how it works
        </Button>
      </Group>

      <div className="ld-demo">
        <span className="ld-demo-pill">
          <IconHandClick size={15} />
          Try it — reserve one
        </span>
        <SimpleGrid className="ld-demo-panel" cols={{ base: 1, sm: 3 }} spacing="lg" ta="left">
          {items.map((it) => (
            <WishlistCard
              key={it.id}
              item={it}
              linked={false}
              footer={<DemoReserveButton item={it} onReserve={onReserve} onCancel={onCancel} />}
            />
          ))}
        </SimpleGrid>
      </div>
    </Box>
  );
}

function HowItWorks() {
  return (
    <Box component="section" id="features" className="ld-section" pt={64} pb={24}>
      <Box ta="center" mb={40}>
        <span className="ld-eyebrow">
          <IconRoute size={14} />
          How it works
        </span>
        <h2 className="ld-h2">Three steps, zero spoilers</h2>
      </Box>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        {STEPS.map((s) => (
          <Card key={s.n} withBorder radius="lg" p="lg" className="wl-card">
            <Group gap={12} mb={12}>
              <span className="ld-icon-chip">
                <s.icon size={20} />
              </span>
              <span className="ld-step-num">Step {s.n}</span>
            </Group>
            <Text fw={700} fz={18} mb={6}>
              {s.title}
            </Text>
            <Text fz={14} lh={1.6} c="var(--text-secondary)">
              {s.body}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
    </Box>
  );
}

function Sharing() {
  const [isPrivate, setIsPrivate] = useState(false);
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    setCopied(true);
    notifications.show({ color: "teal", message: "Link copied" });
    setTimeout(() => setCopied(false), 1800);
  };
  const onToggle = () => {
    setIsPrivate((p) => !p);
    notifications.show({
      color: isPrivate ? "teal" : "gray",
      message: isPrivate ? "Wishlist is live again" : "Wishlist set to private",
    });
  };

  return (
    <Box component="section" id="sharing" className="ld-section" pt={64} pb={24}>
      <div className="ld-split">
        <div>
          <span className="ld-eyebrow">
            <IconShare size={14} />
            Sharing &amp; privacy
          </span>
          <h2 className="ld-h2">One link. Yours to switch off.</h2>
          <p className="ld-lead">
            Every wishlist has a single shareable link — send it to the group chat and you're done.
            Need a pause? Hide the list and the link stops working until you flip it back.
          </p>
          <Stack gap={12} mt={22}>
            {SHARE_POINTS.map(([Icon, text]) => (
              <Group key={text} gap={11} wrap="nowrap">
                <Icon size={19} style={{ color: "var(--color-secondary)", flex: "none" }} />
                <Text fz={14.5} c="var(--text-secondary)">
                  {text}
                </Text>
              </Group>
            ))}
          </Stack>
        </div>

        {/* Interactive share/privacy demo card */}
        <Card withBorder radius="lg" p="lg" className="wl-card">
          <Group gap={12} mb={16} wrap="nowrap">
            <span
              className="wl-owner-avatar"
              style={{ width: 44, height: 44, background: "var(--moss-1)", color: "var(--moss-8)", fontSize: 18 }}
            >
              S
            </span>
            <Box flex={1} miw={0}>
              <Text fw={700} fz={15.5} truncate>
                Sam's birthday list
              </Text>
              <Text fz={12.5} c="var(--text-muted)">
                12 wishes · 4 reserved
              </Text>
            </Box>
            <span
              className="wl-statebadge"
              style={{
                position: "static",
                background: isPrivate ? "var(--clay-8)" : "var(--color-secondary)",
                color: "#fff",
              }}
            >
              {isPrivate ? <IconEyeOff size={13} /> : <IconWorld size={13} />}
              {isPrivate ? "Private" : "Live"}
            </span>
          </Group>

          <div className="ld-linkbox" style={{ opacity: isPrivate ? 0.5 : 1, marginBottom: 14 }}>
            <IconLink size={16} style={{ color: "var(--text-muted)", flex: "none" }} />
            <span className="url" style={{ textDecoration: isPrivate ? "line-through" : "none" }}>
              loctary.com/w/sam-birthday
            </span>
            <Button
              variant="default"
              size="compact-sm"
              disabled={isPrivate}
              onClick={onCopy}
              leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <Button
            fullWidth
            variant={isPrivate ? "filled" : "default"}
            onClick={onToggle}
            leftSection={isPrivate ? <IconWorld size={17} /> : <IconEyeOff size={17} />}
          >
            {isPrivate ? "Set live" : "Set to private"}
          </Button>
        </Card>
      </div>
    </Box>
  );
}

function WishControl() {
  const [wishes, setWishes] = useState(DEMO_WISHES);
  const toggleWish = (id: string) =>
    setWishes((prev) => prev.map((w) => (w.id === id ? { ...w, active: !w.active } : w)));

  return (
    <Box component="section" className="ld-section" pt={64} pb={40}>
      <div className="ld-split">
        {/* Interactive wish toggle demo */}
        <Card withBorder radius="lg" p="md" className="wl-card">
          <Text
            fz={12}
            fw={700}
            tt="uppercase"
            c="var(--text-muted)"
            style={{ letterSpacing: "0.07em" }}
            px={6}
            pb={12}
            pt={4}
          >
            Your wishes
          </Text>
          <Stack gap={8}>
            {wishes.map((w) => {
              const tint = tintFor(w.id);
              return (
                <div
                  key={w.id}
                  className="ld-wishrow"
                  style={{
                    background: w.active ? "var(--color-surface)" : "var(--color-bg-sunken)",
                    opacity: w.active ? 1 : 0.65,
                  }}
                >
                  <span
                    className="ld-icon-chip"
                    style={{ width: 38, height: 38, background: tint.bg, color: tint.fg, borderRadius: "var(--radius-sm)" }}
                  >
                    <w.icon size={18} />
                  </span>
                  <Box flex={1} miw={0}>
                    <Text fw={600} fz={14} td={w.active ? undefined : "line-through"}>
                      {w.title}
                    </Text>
                    <Text fz={12} c="var(--text-muted)" ff="var(--font-mono)">
                      {demoPrice(w.price)}
                    </Text>
                  </Box>
                  <Text fz={11.5} fw={700} c={w.active ? "var(--moss-8)" : "var(--text-muted)"}>
                    {w.active ? "Active" : "Hidden"}
                  </Text>
                  <Switch
                    checked={w.active}
                    onChange={() => toggleWish(w.id)}
                    aria-label={`Toggle ${w.title}`}
                    color="amber"
                    size="md"
                  />
                </div>
              );
            })}
          </Stack>
        </Card>

        <div>
          <span className="ld-eyebrow">
            <IconAdjustments size={14} />
            Wish control
          </span>
          <h2 className="ld-h2">Every wish has an off switch</h2>
          <p className="ld-lead">
            Already got the pan? Second-guessing the record player? Hide a wish and it disappears
            from your public list — without deleting it or losing who reserved it. Flip it back on
            whenever.
          </p>
        </div>
      </div>
    </Box>
  );
}

function FinalCta() {
  const { user: session } = useSession();
  return (
    <Box component="section" className="ld-section" pt={40} pb={80}>
      <div className="ld-cta-panel">
        <h2 className="ld-h2" style={{ color: "inherit", margin: "0 0 10px" }}>
          Your next gift, already sorted
        </h2>
        <p
          style={{
            margin: "0 auto 26px",
            fontSize: 16,
            lineHeight: 1.6,
            maxWidth: "44ch",
            color: "color-mix(in srgb, var(--text-on-primary) 82%, transparent)",
          }}
        >
          Free to use. One link to share. No duplicate gifts, no spoiled surprises.
        </p>
        <Button
          size="lg"
          h={50}
          variant="white"
          color="dark"
          leftSection={session ? <IconListCheck size={18} /> : <IconPlus size={18} />}
          renderRoot={(props) =>
            session ? (
              <Link to="/user/$userId" params={{ userId: session.id }} {...props} />
            ) : (
              <Link to="/register" {...props} />
            )
          }
        >
          {session ? "Go to my page" : "Create your wishlist"}
        </Button>
      </div>
    </Box>
  );
}

/* --------------------------------- page ---------------------------------- */

/**
 * Marketing landing page for `/`. Every "product shot" is the real component
 * (WishlistCard + reserve flow, share + hide toggles) running on mock data,
 * so the hero demo behaves exactly like a live wishlist.
 */
export function LandingPage() {
  return (
    <Box style={{ flex: 1 }}>
      <Hero />
      <HowItWorks />
      <Sharing />
      <WishControl />
      <FinalCta />
    </Box>
  );
}
