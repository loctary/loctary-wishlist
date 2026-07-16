import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArrowRight,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  listUserWishlists,
  manageCreateWishlist,
  manageDeleteWishlist,
  manageListWishlists,
  manageSetWishlistActive,
  manageUpdateWishlist,
  WishlistApiError,
  type AdminWishlist,
  type Wishlist,
  type WishlistInput,
} from "../lib/api";
import { useSession } from "../lib/session";
import { tintFor } from "../lib/tint";
import { useWishlistUser } from "../lib/user";
import { NotFoundScreen } from "./NotFoundScreen";
import { WishlistFormModal } from "./WishlistFormModal";

/**
 * The user's public page — `/user/$userId`. Renders one of two variants:
 *
 * - **Owner mode** (viewer.id === userId): "Your page" heading, "+ Add wishlist"
 *   button, every list (including hidden ones) with per-tile edit / hide / delete
 *   menu. The Open button on a hidden list is dimmed and the tile is muted.
 * - **Visitor mode**: display name heading, only ACTIVE lists, "View wishlist"
 *   button, no menu, no add button.
 *
 * Layout mirrors the mockup: avatar + title + meta on the left, primary action
 * on the right, followed by a "WISHLISTS · N total / N live" label and a 2-col
 * card grid.
 */
export function UserPage({ userId }: { userId: string }) {
  const { user: session } = useSession();
  const isOwner = !!session && session.id === userId;

  return isOwner ? (
    <OwnerUserPage userId={userId} />
  ) : (
    <VisitorUserPage userId={userId} />
  );
}

/* ------------------------------ common bits ------------------------------- */

function joinedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Joined ${d.toLocaleString(undefined, { month: "long", year: "numeric" })}`;
}

function UserHeader({
  userId,
  title,
  subtitle,
  right,
}: {
  userId: string;
  title: string;
  subtitle: string | null;
  right?: React.ReactNode;
}) {
  const { user } = useWishlistUser(userId);
  const name = user?.name ?? title;
  const avatarUrl = user?.avatarUrl;
  const initial = (name ?? "?").slice(0, 1).toUpperCase();
  const tint = tintFor(userId);

  return (
    <Group wrap="nowrap" align="center" justify="space-between" gap="md">
      <Group wrap="nowrap" align="center" gap="lg">
        <Avatar
          src={avatarUrl ?? undefined}
          size={88}
          radius="xl"
          style={{ "--avatar-bg": tint.bg, color: tint.fg }}
        >
          <Text fw={800} size="32px" style={{ color: tint.fg }}>
            {initial}
          </Text>
        </Avatar>
        <Stack gap={4}>
          <Title order={1} style={{ letterSpacing: "-0.03em" }}>
            {title}
          </Title>
          {subtitle && (
            <Text size="sm" c="dimmed">
              {subtitle}
            </Text>
          )}
        </Stack>
      </Group>
      {right}
    </Group>
  );
}

/**
 * A shared "gift tile" for a wishlist. Titles/counts + a big CTA button. The
 * per-tile owner menu (edit/hide/delete) is passed in as `menu`; when omitted
 * we render nothing so the tile stays visitor-safe. Dimmed when `!isActive`.
 */
function WishlistTile({
  list,
  href,
  cta,
  menu,
  dim,
  hiddenBadge,
}: {
  list: Wishlist | AdminWishlist;
  href: { userId: string; wishlistId: string };
  cta: string;
  menu?: React.ReactNode;
  dim?: boolean;
  hiddenBadge?: boolean;
}) {
  const tint = tintFor(list.id);
  const wishesLabel = `${list.itemsCount} ${list.itemsCount === 1 ? "wish" : "wishes"}`;
  const reservedLabel = `${list.reservedCount} reserved`;

  return (
    <Card
      withBorder
      radius="lg"
      padding="md"
      className="wl-card"
      data-dim={dim ? "true" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--mantine-spacing-md)",
      }}
    >
      <Group wrap="nowrap" align="flex-start" justify="space-between" gap="sm">
        <Group wrap="nowrap" align="center" gap="sm" style={{ minWidth: 0 }}>
          <Box
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: tint.bg,
              color: tint.fg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Text fw={800} size="lg" style={{ color: tint.fg }}>
              {list.title.slice(0, 1).toUpperCase()}
            </Text>
          </Box>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Group gap={6} wrap="nowrap" align="center">
              <Text fw={700} lineClamp={1}>
                {list.title}
              </Text>
              {hiddenBadge && (
                <Group
                  gap={4}
                  wrap="nowrap"
                  align="center"
                  style={{
                    background: "var(--mantine-color-gray-1)",
                    color: "var(--mantine-color-gray-7)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <IconEyeOff size={12} />
                  Hidden
                </Group>
              )}
            </Group>
            <Text size="xs" c="dimmed" ff="monospace">
              {wishesLabel} · {reservedLabel}
            </Text>
          </Stack>
        </Group>
        {menu}
      </Group>

      <Button
        fullWidth
        variant={dim ? "light" : "filled"}
        color="amber"
        rightSection={<IconArrowRight size={16} />}
        renderRoot={(props) => (
          <Link
            to="/user/$userId/wishlists/$wishlistId"
            params={href}
            {...props}
          />
        )}
      >
        {cta}
      </Button>
    </Card>
  );
}

/* -------------------------------- visitor -------------------------------- */

function VisitorUserPage({ userId }: { userId: string }) {
  const {
    user,
    isLoading: userLoading,
    isError: userError,
  } = useWishlistUser(userId);
  const listsQuery = useQuery({
    queryKey: ["user-wishlists", userId],
    queryFn: () => listUserWishlists(userId),
  });

  if (userLoading || listsQuery.isLoading) {
    return (
      <Center style={{ flex: 1, width: "100%" }}>
        <Loader />
      </Center>
    );
  }
  if (userError || !user) {
    return <NotFoundScreen kind="user" />;
  }

  const name = user.name ?? "User without a name";
  const lists = listsQuery.data?.wishlists ?? [];

  return (
    <Container size="lg" py="xl" style={{ flex: 1, width: "100%" }}>
      <Stack gap="xl">
        <UserHeader
          userId={userId}
          title={name}
          subtitle={joinedLabel(user.createdAt)}
        />

        <div>
          <Text size="xs" c="dimmed" fw={700} ff="monospace" mb="md">
            WISHLISTS · {lists.length}
          </Text>
          {lists.length === 0 ? (
            <Center mih="30vh">
              <Text c="dimmed">
                This user doesn&apos;t have any public wishlists yet.
              </Text>
            </Center>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {lists.map((list) => (
                <WishlistTile
                  key={list.id}
                  list={list}
                  href={{ userId, wishlistId: list.id }}
                  cta="View wishlist"
                />
              ))}
            </SimpleGrid>
          )}
        </div>
      </Stack>
    </Container>
  );
}

/* --------------------------------- owner --------------------------------- */

function OwnerUserPage({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);

  const { user: ownerProfile } = useWishlistUser(userId);
  const listsQuery = useQuery({
    queryKey: ["manage-wishlists"],
    queryFn: () => manageListWishlists(),
  });

  const notifyError = (e: unknown, fallback: string) =>
    notifications.show({
      color: "red",
      message: e instanceof WishlistApiError ? e.message : fallback,
    });

  const createMut = useMutation({
    mutationFn: (input: WishlistInput) => manageCreateWishlist(input),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Wishlist created" });
      createHandlers.close();
      qc.invalidateQueries({ queryKey: ["manage-wishlists"] });
      qc.invalidateQueries({ queryKey: ["user-wishlists", userId] });
    },
    onError: (e) => notifyError(e, "Could not create wishlist"),
  });

  const lists = listsQuery.data?.wishlists ?? [];
  const liveCount = lists.filter((l) => l.isActive).length;
  const hasHidden = lists.length !== liveCount;

  return (
    <Container size="lg" py="xl" style={{ flex: 1, width: "100%" }}>
      <Stack gap="xl">
        <UserHeader
          userId={userId}
          title="Your page"
          subtitle={joinedLabel(ownerProfile?.createdAt)}
          right={
            <Button
              leftSection={<IconPlus size={16} />}
              size="md"
              onClick={createHandlers.open}
            >
              Add wishlist
            </Button>
          }
        />

        <div>
          <Text size="xs" c="dimmed" fw={700} ff="monospace" mb="md">
            WISHLISTS · {lists.length} total · {liveCount} live
          </Text>
          {listsQuery.isLoading ? (
            <Center mih="30vh">
              <Loader />
            </Center>
          ) : lists.length === 0 ? (
            <Center mih="30vh">
              <Stack align="center" gap="sm">
                <Text c="dimmed">You don&apos;t have any wishlists yet.</Text>
                <Button
                  size="sm"
                  leftSection={<IconPlus size={16} />}
                  onClick={createHandlers.open}
                >
                  Create your first
                </Button>
              </Stack>
            </Center>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {lists.map((list) => (
                <OwnerTile key={list.id} list={list} userId={userId} />
              ))}
            </SimpleGrid>
          )}
          {hasHidden && (
            <Group gap={6} mt="md" align="center">
              <IconEyeOff size={14} style={{ color: "var(--text-muted)" }} />
              <Text size="xs" c="dimmed">
                Hidden wishlists are only visible to you — visitors won&apos;t
                see them.
              </Text>
            </Group>
          )}
        </div>
      </Stack>

      <WishlistFormModal
        opened={createOpen}
        onClose={createHandlers.close}
        submitLabel="Create"
        submitting={createMut.isPending}
        onSubmit={(input) => createMut.mutate(input)}
      />
    </Container>
  );
}

function OwnerTile({ list, userId }: { list: AdminWishlist; userId: string }) {
  const qc = useQueryClient();
  const [editOpen, editHandlers] = useDisclosure(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["manage-wishlists"] });
    qc.invalidateQueries({ queryKey: ["user-wishlists", list.ownerId] });
    qc.invalidateQueries({ queryKey: ["wishlist", list.id] });
  };
  const notifyError = (e: unknown, fallback: string) =>
    notifications.show({
      color: "red",
      message: e instanceof WishlistApiError ? e.message : fallback,
    });

  const updateMut = useMutation({
    mutationFn: (input: WishlistInput) => manageUpdateWishlist(list.id, input),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Wishlist updated" });
      editHandlers.close();
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not update wishlist"),
  });

  const setActiveMut = useMutation({
    mutationFn: (active: boolean) => manageSetWishlistActive(list.id, active),
    onSuccess: (_r, active) => {
      notifications.show({
        color: "teal",
        message: active ? "Wishlist is now public" : "Wishlist hidden",
      });
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not update visibility"),
  });

  const deleteMut = useMutation({
    mutationFn: () => manageDeleteWishlist(list.id),
    onSuccess: () => {
      notifications.show({ color: "gray", message: "Wishlist deleted" });
      setDeleteOpen(false);
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not delete wishlist"),
  });

  const menu = (
    <Menu position="bottom-end" width={180} withArrow shadow="md" radius="md">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label="More">
          <IconDotsVertical size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconEdit size={14} />}
          onClick={editHandlers.open}
        >
          Edit
        </Menu.Item>
        <Menu.Item
          leftSection={
            list.isActive ? <IconEyeOff size={14} /> : <IconEye size={14} />
          }
          onClick={() => setActiveMut.mutate(!list.isActive)}
        >
          {list.isActive ? "Hide from visitors" : "Make public"}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconTrash size={14} />}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  return (
    <>
      <WishlistTile
        list={list}
        href={{ userId, wishlistId: list.id }}
        cta="Open"
        menu={menu}
        dim={!list.isActive}
        hiddenBadge={!list.isActive}
      />

      <WishlistFormModal
        opened={editOpen}
        onClose={editHandlers.close}
        initial={list}
        submitLabel="Save changes"
        submitting={updateMut.isPending}
        onSubmit={(input) => updateMut.mutate(input)}
      />

      <Modal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete wishlist"
        size="sm"
        centered
      >
        <Stack>
          <Alert color="red" variant="light">
            Deleting <strong>{list.title}</strong> also removes every item on
            it. This can&apos;t be undone.
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
