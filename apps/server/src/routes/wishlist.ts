import { Hono, type Context } from "hono";
import { z } from "zod";
import { admin } from "../supabase.js";
import { env } from "../env.js";
import {
  loadSession,
  requireUser,
  type AppVariables,
  type SessionUser,
} from "../auth.js";
import {
  deleteObject,
  keyFromPublicUrl,
  listObjects,
  publicUrl,
  putObject,
  r2Configured,
} from "../r2.js";

/**
 * Wishlist API.
 *
 * Data model: users own `wishlists`, wishlists own `wishlist_items`. Items also
 * carry a redundant `owner_id` (cheap authorization key); a DB trigger keeps
 * it in sync with the parent list's owner so it can never drift.
 *
 * Access: all queries use the service-role client (`admin()`); `requireUser`
 * + per-row ownership filters do the authorization. Public projections strip
 * the reserver so browsers can see an item is `reserved` (no double-buying)
 * without learning who took it.
 */

const wishlist = new Hono<{ Variables: AppVariables }>();

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

type FieldErrors = Record<string, string>;

function fail(c: Context, status: number, error: string, fields?: FieldErrors) {
  return c.json(fields ? { error, fields } : { error }, status as never);
}

async function parseBody<T>(c: Context, schema: z.ZodSchema<T>) {
  const body = await c.req.json().catch(() => ({}));
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fields[key]) fields[key] = issue.message;
    }
    const first = result.error.issues[0]?.message ?? "Invalid request";
    return { ok: false as const, error: first, fields };
  }
  return { ok: true as const, data: result.data };
}

/* --- items ---------------------------------------------------------------- */

const ITEM_COLUMNS =
  "id, owner_id, wishlist_id, title, description, url, price, currency, position, status, is_active, images, reserved_by, reserved_at, created_at, updated_at";

interface ItemRow {
  id: string;
  owner_id: string;
  wishlist_id: string;
  title: string;
  description: string | null;
  url: string | null;
  price: number | null;
  currency: string;
  position: number;
  status: "available" | "reserved" | "confirmed" | "declined";
  is_active: boolean;
  images: string[];
  reserved_by: string | null;
  reserved_at: string | null;
  created_at: string;
  updated_at: string;
}

function publicItem(row: ItemRow, viewer?: SessionUser | null) {
  const isOwner = !!viewer && row.owner_id === viewer.id;
  const isReserver = !!viewer && row.reserved_by === viewer.id;
  return {
    id: row.id,
    ownerId: row.owner_id,
    wishlistId: row.wishlist_id,
    title: row.title,
    description: row.description,
    url: row.url,
    price: row.price,
    currency: row.currency,
    position: row.position,
    status: row.status,
    isActive: row.is_active,
    createdAt: row.created_at,
    images: row.images ?? [],
    viewer: {
      isOwner,
      isReserver,
      canReserve: !!viewer && row.status === "available" && !isOwner,
      canCancel: !!viewer && row.status === "reserved" && (isReserver || isOwner),
    },
  };
}

function adminItem(row: ItemRow, reserver: { id: string; name: string | null } | null) {
  return {
    ...publicItem(row),
    reservedBy: row.reserved_by,
    reservedAt: row.reserved_at,
    reserver: reserver ? { id: reserver.id, name: reserver.name } : null,
    updatedAt: row.updated_at,
  };
}

/* --- wishlists ------------------------------------------------------------ */

const LIST_COLUMNS =
  "id, owner_id, title, description, cover_image_url, is_active, position, created_at, updated_at";

interface ListRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

function publicList(row: ListRow, counts?: { items: number; reserved: number }) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    position: row.position,
    createdAt: row.created_at,
    itemsCount: counts?.items ?? 0,
    reservedCount: counts?.reserved ?? 0,
  };
}

function adminList(row: ListRow, counts?: { items: number; reserved: number }) {
  return {
    ...publicList(row, counts),
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

/* --- cursor --------------------------------------------------------------- */

interface Cursor {
  p: number;
  t: string;
  i: string;
}
function encodeCursor(row: ItemRow): string {
  const c: Cursor = { p: row.position, t: row.created_at, i: row.id };
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}
function decodeCursor(raw: string): Cursor | null {
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof c?.p === "number" && typeof c?.t === "string" && typeof c?.i === "string") return c;
  } catch {
    /* malformed cursor — treat as no cursor */
  }
  return null;
}

/* --- user resolution ------------------------------------------------------ */

async function resolveUsers(ids: string[]) {
  const unique = [...new Set(ids)];
  const map = new Map<
    string,
    {
      id: string;
      name: string | null;
      avatarUrl: string | null;
      providers: string[];
      createdAt: string | null;
    }
  >();
  if (unique.length === 0) return map;

  const { data: profiles } = await admin()
    .from("profiles")
    .select("id, display_name, created_at")
    .in("id", unique);
  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        name: (p.display_name as string | null) ?? null,
        createdAt: (p.created_at as string | null) ?? null,
      },
    ]),
  );

  await Promise.all(
    unique.map(async (id) => {
      const { data } = await admin().auth.admin.getUserById(id);
      const meta = data?.user?.user_metadata as Record<string, unknown> | undefined;
      const avatar = meta?.avatar_url ?? meta?.picture;
      const identities = data?.user?.identities as { provider: string }[] | undefined;
      const providers = Array.isArray(identities) ? identities.map((i) => i.provider) : [];
      const profile = profileMap.get(id);
      map.set(id, {
        id,
        name: profile?.name ?? null,
        avatarUrl: typeof avatar === "string" ? avatar : null,
        providers,
        createdAt: profile?.createdAt ?? null,
      });
    }),
  );
  return map;
}

/**
 * Given a set of wishlist ids, return per-list totals: `items` counts active
 * items (what the public sees), `reserved` counts anything that's been claimed
 * (`reserved` or `confirmed` — from the owner's POV they're both "spoken for").
 * One query, aggregated in-process; there are typically < 20 lists per user.
 */
async function resolveListCounts(listIds: string[]) {
  const map = new Map<string, { items: number; reserved: number }>();
  if (listIds.length === 0) return map;
  const { data } = await admin()
    .from("wishlist_items")
    .select("wishlist_id, is_active, status")
    .in("wishlist_id", listIds);
  for (const id of listIds) map.set(id, { items: 0, reserved: 0 });
  for (const row of (data ?? []) as { wishlist_id: string; is_active: boolean; status: string }[]) {
    const c = map.get(row.wishlist_id);
    if (!c) continue;
    if (row.is_active) c.items++;
    if (row.status === "reserved" || row.status === "confirmed") c.reserved++;
  }
  return map;
}

/* -------------------------------------------------------------------------- */
/* validation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * An image URL must be one of ours (lives under R2_PUBLIC_BASE_URL) so we can
 * clean it up in the nightly cron and can't be tricked into rendering arbitrary
 * external images. When R2 isn't configured (local dev) we relax this.
 */
const imageUrl = z.string().refine(
  (u) => {
    if (!u || typeof u !== "string") return false;
    const base = env.r2PublicBaseUrl;
    if (!base) return true;
    return u.startsWith(base + "/");
  },
  { message: "Image URL must be one served from our bucket" },
);

const createListSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().max(2000).optional().nullable(),
  coverImageUrl: imageUrl.optional().nullable(),
  isActive: z.boolean().optional(),
  position: z.number().int().optional(),
});
const editListSchema = createListSchema.partial().refine((o) => Object.keys(o).length > 0, {
  message: "Nothing to update",
});

const createItemSchema = z.object({
  wishlistId: z.string().uuid("Wishlist is required"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  url: z
    .string()
    .trim()
    .max(2048, "URL is too long")
    .url("Enter a valid URL (starting with http:// or https://)")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  price: z.number().nonnegative("Price can't be negative").optional().nullable(),
  currency: z.string().length(3, "Use a 3-letter currency code").optional(),
  position: z.number().int().optional(),
  isActive: z.boolean().optional(),
  images: z.array(imageUrl).max(3, "You can attach up to 3 images").optional(),
});
const editItemSchema = createItemSchema
  .partial()
  // Moving items between wishlists isn't supported in v1 — strip it if sent.
  .omit({ wishlistId: true })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });

const activeSchema = z.object({ active: z.boolean() });

function listToColumns(input: Partial<z.infer<typeof createListSchema>>) {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.description !== undefined) out.description = input.description;
  if (input.coverImageUrl !== undefined) out.cover_image_url = input.coverImageUrl;
  if (input.isActive !== undefined) out.is_active = input.isActive;
  if (input.position !== undefined) out.position = input.position;
  return out;
}

function itemToColumns(input: Partial<z.infer<typeof createItemSchema>>) {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.description !== undefined) out.description = input.description;
  if (input.url !== undefined) out.url = input.url;
  if (input.price !== undefined) out.price = input.price;
  if (input.currency !== undefined) out.currency = input.currency;
  if (input.position !== undefined) out.position = input.position;
  if (input.isActive !== undefined) out.is_active = input.isActive;
  if (input.images !== undefined) out.images = input.images;
  return out;
}

/* -------------------------------------------------------------------------- */
/* session                                                                     */
/* -------------------------------------------------------------------------- */

wishlist.use("*", loadSession);

wishlist.get("/me", (c) => c.json({ user: c.get("user") }));

/* -------------------------------------------------------------------------- */
/* wishlists — public                                                          */
/* -------------------------------------------------------------------------- */

/** GET /wishlists?owner=  → a user's ACTIVE lists (public). */
wishlist.get("/wishlists", async (c) => {
  const owner = c.req.query("owner");
  if (!owner) return fail(c, 400, "owner is required");

  const { data, error } = await admin()
    .from("wishlists")
    .select(LIST_COLUMNS)
    .eq("owner_id", owner)
    .eq("is_active", true)
    .order("position", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return fail(c, 500, "Could not load wishlists");
  const rows = data as ListRow[];
  const counts = await resolveListCounts(rows.map((r) => r.id));
  return c.json({ wishlists: rows.map((r) => publicList(r, counts.get(r.id))) });
});

/** GET /wishlists/:id → a single wishlist (404 if inactive to a non-owner). */
wishlist.get("/wishlists/:id", async (c) => {
  const { data, error } = await admin()
    .from("wishlists")
    .select(LIST_COLUMNS)
    .eq("id", c.req.param("id"))
    .maybeSingle();

  if (error) return fail(c, 500, "Could not load the wishlist");
  if (!data) return fail(c, 404, "Wishlist not found");
  const row = data as ListRow;
  const viewer = c.get("user");
  const isOwner = viewer?.id === row.owner_id;
  if (!row.is_active && !isOwner) return fail(c, 404, "Wishlist not found");
  return c.json({ wishlist: isOwner ? adminList(row) : publicList(row) });
});

/* -------------------------------------------------------------------------- */
/* items — public                                                              */
/* -------------------------------------------------------------------------- */

/**
 * GET /items?wishlist=&cursor=&limit=  → items on a public list.
 * The parent list must be active OR the caller must be its owner; otherwise
 * we return 404 to hide even the list's existence from strangers.
 */
wishlist.get("/items", async (c) => {
  const wishlistId = c.req.query("wishlist");
  if (!wishlistId) return fail(c, 400, "wishlist is required");
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 12), 1), 50);
  const cursorRaw = c.req.query("cursor");

  const { data: parent, error: parentErr } = await admin()
    .from("wishlists")
    .select("id, owner_id, is_active")
    .eq("id", wishlistId)
    .maybeSingle();
  if (parentErr) return fail(c, 500, "Could not load the wishlist");
  if (!parent) return fail(c, 404, "Wishlist not found");
  const viewer = c.get("user");
  const isOwner = viewer?.id === (parent as { owner_id: string }).owner_id;
  if (!(parent as { is_active: boolean }).is_active && !isOwner) {
    return fail(c, 404, "Wishlist not found");
  }

  let query = admin()
    .from("wishlist_items")
    .select(ITEM_COLUMNS)
    .eq("wishlist_id", wishlistId)
    .eq("is_active", true)
    .order("position", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursorRaw) {
    const cursor = decodeCursor(cursorRaw);
    if (cursor) {
      query = query.or(
        `position.lt.${cursor.p},` +
          `and(position.eq.${cursor.p},created_at.lt.${cursor.t}),` +
          `and(position.eq.${cursor.p},created_at.eq.${cursor.t},id.lt.${cursor.i})`,
      );
    }
  }

  const { data, error } = await query;
  if (error) return fail(c, 500, "Could not load the wishlist");
  const rows = (data ?? []) as ItemRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1]!) : null;
  return c.json({
    items: page.map((r) => publicItem(r, viewer)),
    nextCursor,
  });
});

/** GET /items/:id → a single item (404 if its list is inactive to non-owner). */
wishlist.get("/items/:id", async (c) => {
  const { data, error } = await admin()
    .from("wishlist_items")
    .select(ITEM_COLUMNS)
    .eq("id", c.req.param("id"))
    .maybeSingle();

  if (error) return fail(c, 500, "Could not load the item");
  if (!data) return fail(c, 404, "Item not found");
  const row = data as ItemRow;
  const viewer = c.get("user");
  const isOwner = viewer?.id === row.owner_id;

  // Hide inactive items and items whose parent list is inactive from non-owners.
  if (!row.is_active && !isOwner) return fail(c, 404, "Item not found");
  const { data: parent } = await admin()
    .from("wishlists")
    .select("is_active")
    .eq("id", row.wishlist_id)
    .maybeSingle();
  if (!parent || (!(parent as { is_active: boolean }).is_active && !isOwner)) {
    return fail(c, 404, "Item not found");
  }

  return c.json({ item: publicItem(row, viewer) });
});

/* -------------------------------------------------------------------------- */
/* reservations                                                                */
/* -------------------------------------------------------------------------- */

wishlist.get("/me/reservations", requireUser, async (c) => {
  const user = c.get("user")!;
  const { data, error } = await admin()
    .from("wishlist_items")
    .select(ITEM_COLUMNS)
    .eq("reserved_by", user.id)
    .order("reserved_at", { ascending: false });

  if (error) return fail(c, 500, "Could not load your reservations");
  const rows = data as ItemRow[];
  const owners = await resolveUsers(rows.map((r) => r.owner_id));
  const items = rows.map((row) => ({
    ...publicItem(row, user),
    reservedAt: row.reserved_at,
    owner: { id: row.owner_id, name: owners.get(row.owner_id)?.name ?? null },
  }));
  return c.json({ items });
});

wishlist.post("/items/:id/reserve", requireUser, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const { data: existing, error: readErr } = await admin()
    .from("wishlist_items")
    .select(ITEM_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (readErr) return fail(c, 500, "Could not reserve the item");
  if (!existing) return fail(c, 404, "Item not found");

  const row = existing as ItemRow;
  if (row.owner_id === user.id) return fail(c, 400, "You can't reserve from your own wishlist");
  if (!row.is_active) return fail(c, 409, "This item is not available");
  if (row.status === "reserved" || row.status === "confirmed") {
    if (row.reserved_by === user.id) return c.json({ item: publicItem(row, user) });
    return fail(c, 409, "This item is already reserved");
  }
  if (row.status === "declined") return fail(c, 409, "This item is not available");

  const { data, error } = await admin()
    .from("wishlist_items")
    .update({ status: "reserved", reserved_by: user.id, reserved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "available")
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not reserve the item");
  if (!data) return fail(c, 409, "This item is already reserved");
  return c.json({ item: publicItem(data as ItemRow, user) });
});

wishlist.delete("/items/:id/reserve", requireUser, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const { data, error } = await admin()
    .from("wishlist_items")
    .update({ status: "available", reserved_by: null, reserved_at: null })
    .eq("id", id)
    .eq("reserved_by", user.id)
    .eq("status", "reserved")
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not cancel the reservation");
  if (!data) return fail(c, 409, "You don't have an active reservation on this item");
  return c.json({ item: publicItem(data as ItemRow, user) });
});

/* ========================================================================== */
/* manage — the caller's OWN wishlists + items                                 */
/* ========================================================================== */

/* --- wishlists ------------------------------------------------------------ */

/** GET /manage/wishlists → all of the caller's lists, active + inactive. */
wishlist.get("/manage/wishlists", requireUser, async (c) => {
  const user = c.get("user")!;
  const { data, error } = await admin()
    .from("wishlists")
    .select(LIST_COLUMNS)
    .eq("owner_id", user.id)
    .order("position", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return fail(c, 500, "Could not load your wishlists");
  const rows = data as ListRow[];
  const counts = await resolveListCounts(rows.map((r) => r.id));
  return c.json({ wishlists: rows.map((r) => adminList(r, counts.get(r.id))) });
});

/** POST /manage/wishlists → create a new list on the caller's account. */
wishlist.post("/manage/wishlists", requireUser, async (c) => {
  const user = c.get("user")!;
  const parsed = await parseBody(c, createListSchema);
  if (!parsed.ok) return fail(c, 400, parsed.error, parsed.fields);

  const { data, error } = await admin()
    .from("wishlists")
    .insert({ ...listToColumns(parsed.data), owner_id: user.id })
    .select(LIST_COLUMNS)
    .single();

  if (error) return fail(c, 500, "Could not create the wishlist");
  return c.json({ wishlist: adminList(data as ListRow) }, 201);
});

/** PATCH /manage/wishlists/:id → edit one of the caller's lists. */
wishlist.patch("/manage/wishlists/:id", requireUser, async (c) => {
  const user = c.get("user")!;
  const parsed = await parseBody(c, editListSchema);
  if (!parsed.ok) return fail(c, 400, parsed.error, parsed.fields);

  const { data, error } = await admin()
    .from("wishlists")
    .update(listToColumns(parsed.data))
    .eq("id", c.req.param("id"))
    .eq("owner_id", user.id)
    .select(LIST_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not update the wishlist");
  if (!data) return fail(c, 404, "Wishlist not found");
  return c.json({ wishlist: adminList(data as ListRow) });
});

/** POST /manage/wishlists/:id/active → activate / deactivate. */
wishlist.post("/manage/wishlists/:id/active", requireUser, async (c) => {
  const user = c.get("user")!;
  const parsed = await parseBody(c, activeSchema);
  if (!parsed.ok) return fail(c, 400, parsed.error, parsed.fields);

  const { data, error } = await admin()
    .from("wishlists")
    .update({ is_active: parsed.data.active })
    .eq("id", c.req.param("id"))
    .eq("owner_id", user.id)
    .select(LIST_COLUMNS)
    .maybeSingle();

  if (error || !data) return fail(c, 404, "Wishlist not found");
  return c.json({ wishlist: adminList(data as ListRow) });
});

/**
 * DELETE /manage/wishlists/:id → delete a list (and its items via ON DELETE
 * CASCADE). Refuse if any item is mid-gift (reserved or confirmed): those are
 * commitments to other users; the owner should decline/deactivate first.
 */
wishlist.delete("/manage/wishlists/:id", requireUser, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const { data: existing, error: readErr } = await admin()
    .from("wishlists")
    .select("id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readErr) return fail(c, 500, "Could not delete the wishlist");
  if (!existing) return fail(c, 404, "Wishlist not found");

  const { count } = await admin()
    .from("wishlist_items")
    .select("id", { count: "exact", head: true })
    .eq("wishlist_id", id)
    .in("status", ["reserved", "confirmed"]);
  if ((count ?? 0) > 0) {
    return fail(
      c,
      409,
      "This wishlist has reserved or gifted items — decline the reservations first, or just deactivate it.",
    );
  }

  const { error } = await admin()
    .from("wishlists")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return fail(c, 500, "Could not delete the wishlist");
  return c.json({ ok: true });
});

/* --- items ---------------------------------------------------------------- */

/** GET /manage/items?wishlist=  → the caller's items on one of their lists. */
wishlist.get("/manage/items", requireUser, async (c) => {
  const user = c.get("user")!;
  const wishlistId = c.req.query("wishlist");
  if (!wishlistId) return fail(c, 400, "wishlist is required");

  const { data, error } = await admin()
    .from("wishlist_items")
    .select(ITEM_COLUMNS)
    .eq("owner_id", user.id)
    .eq("wishlist_id", wishlistId)
    .order("position", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return fail(c, 500, "Could not load items");
  const rows = (data ?? []) as ItemRow[];
  const reservers = await resolveUsers(rows.map((r) => r.reserved_by).filter((x): x is string => !!x));
  return c.json({
    items: rows.map((r) =>
      adminItem(r, r.reserved_by ? reservers.get(r.reserved_by) ?? null : null),
    ),
  });
});

/** POST /manage/items → create on one of the caller's lists. */
wishlist.post("/manage/items", requireUser, async (c) => {
  const user = c.get("user")!;
  const parsed = await parseBody(c, createItemSchema);
  if (!parsed.ok) return fail(c, 400, parsed.error, parsed.fields);

  // Verify the target list belongs to the caller. The DB trigger would also
  // reject on owner mismatch, but a clean 404 is friendlier than a 500.
  const { data: parent } = await admin()
    .from("wishlists")
    .select("id")
    .eq("id", parsed.data.wishlistId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!parent) return fail(c, 404, "Wishlist not found");

  const { data, error } = await admin()
    .from("wishlist_items")
    .insert({
      ...itemToColumns(parsed.data),
      owner_id: user.id,
      wishlist_id: parsed.data.wishlistId,
    })
    .select(ITEM_COLUMNS)
    .single();

  if (error) return fail(c, 500, "Could not create the item");
  return c.json({ item: adminItem(data as ItemRow, null) }, 201);
});

wishlist.patch("/manage/items/:id", requireUser, async (c) => {
  const user = c.get("user")!;
  const parsed = await parseBody(c, editItemSchema);
  if (!parsed.ok) return fail(c, 400, parsed.error, parsed.fields);

  const id = c.req.param("id");
  const { data, error } = await admin()
    .from("wishlist_items")
    .update(itemToColumns(parsed.data))
    .eq("id", id)
    .eq("owner_id", user.id)
    .not("status", "in", "(reserved,confirmed)")
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not update the item");
  if (!data) {
    const { data: existing } = await admin()
      .from("wishlist_items")
      .select("status")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!existing) return fail(c, 404, "Item not found");
    if (existing.status === "reserved") return fail(c, 409, "Can't edit a reserved item");
    if (existing.status === "confirmed") return fail(c, 409, "Gifted items can't be edited");
    return fail(c, 500, "Could not update the item");
  }
  const row = data as ItemRow;
  const reserver = row.reserved_by
    ? (await resolveUsers([row.reserved_by])).get(row.reserved_by) ?? null
    : null;
  return c.json({ item: adminItem(row, reserver) });
});

wishlist.delete("/manage/items/:id", requireUser, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const { data: existing, error: readErr } = await admin()
    .from("wishlist_items")
    .select("status")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readErr) return fail(c, 500, "Could not delete the item");
  if (!existing) return fail(c, 404, "Item not found");
  if (existing.status === "confirmed")
    return fail(c, 409, "Gifted items can't be deleted — deactivate it instead");
  if (existing.status === "reserved") return fail(c, 409, "Can't delete a reserved item");

  const { error } = await admin().from("wishlist_items").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return fail(c, 500, "Could not delete the item");
  return c.json({ ok: true });
});

wishlist.post("/manage/items/:id/active", requireUser, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const parsed = await parseBody(c, activeSchema);
  if (!parsed.ok) return fail(c, 400, parsed.error, parsed.fields);

  const { data: existing, error: readErr } = await admin()
    .from("wishlist_items")
    .select(ITEM_COLUMNS)
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readErr) return fail(c, 500, "Could not update the item");
  if (!existing) return fail(c, 404, "Item not found");
  if ((existing as ItemRow).status === "reserved")
    return fail(c, 409, "Can't change a reserved item's visibility");

  const { data, error } = await admin()
    .from("wishlist_items")
    .update({ is_active: parsed.data.active })
    .eq("id", id)
    .eq("owner_id", user.id)
    .neq("status", "reserved")
    .select(ITEM_COLUMNS)
    .maybeSingle();
  if (error || !data) return fail(c, 500, "Could not update the item");
  const row = data as ItemRow;
  const reserver = row.reserved_by
    ? (await resolveUsers([row.reserved_by])).get(row.reserved_by) ?? null
    : null;
  return c.json({ item: adminItem(row, reserver) });
});

wishlist.post("/manage/items/:id/confirm", requireUser, async (c) => {
  const user = c.get("user")!;
  const { data, error } = await admin()
    .from("wishlist_items")
    .update({ status: "confirmed" })
    .eq("id", c.req.param("id"))
    .eq("owner_id", user.id)
    .eq("status", "reserved")
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not confirm the item");
  if (!data) return fail(c, 409, "Only a reserved item on your list can be confirmed");
  const row = data as ItemRow;
  const reserver = row.reserved_by
    ? (await resolveUsers([row.reserved_by])).get(row.reserved_by) ?? null
    : null;
  return c.json({ item: adminItem(row, reserver) });
});

wishlist.post("/manage/items/:id/decline", requireUser, async (c) => {
  const user = c.get("user")!;
  const { data, error } = await admin()
    .from("wishlist_items")
    .update({ status: "available", reserved_by: null, reserved_at: null })
    .eq("id", c.req.param("id"))
    .eq("owner_id", user.id)
    .eq("status", "reserved")
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not decline the reservation");
  if (!data) return fail(c, 409, "Only a reserved item on your list can be declined");
  return c.json({ item: adminItem(data as ItemRow, null) });
});

/* -------------------------------------------------------------------------- */
/* image staging (shared by item images + wishlist covers)                     */
/*                                                                             */
/* The form uploads each cropped image (≤300KB WebP/JPEG/PNG) here *before*    */
/* submitting the parent record. The response carries the public URL; the      */
/* client puts it into `images[]` (for items) or `coverImageUrl` (for lists).  */
/* If never attached, the nightly cron reaps it after the 24h grace window.    */
/* -------------------------------------------------------------------------- */

const IMAGE_MAX_BYTES = 300 * 1024;
const IMAGE_EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

wishlist.post("/manage/images/upload", requireUser, async (c) => {
  if (!r2Configured()) return fail(c, 503, "Image uploads are not configured on the server.");

  const contentType = (c.req.header("content-type") ?? "").split(";")[0].trim();
  const ext = IMAGE_EXT[contentType];
  if (!ext) return fail(c, 400, "Upload a WebP, JPEG, or PNG image.");

  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) return fail(c, 400, "The uploaded image is empty.");
  if (body.byteLength > IMAGE_MAX_BYTES) {
    return fail(c, 413, "Image must be 300KB or smaller after cropping.");
  }

  const key = `wishlist/${crypto.randomUUID()}.${ext}`;
  try {
    await putObject(key, body, contentType);
  } catch {
    return fail(c, 502, "Could not store the image. Please try again.");
  }

  return c.json({ url: publicUrl(key) }, 201);
});

/* -------------------------------------------------------------------------- */
/* orphan-image cleanup                                                        */
/*                                                                             */
/* Lists every object under `wishlist/` and deletes the ones NOT referenced by */
/* any item row's `images` array OR any wishlist row's `cover_image_url`. A    */
/* 24h grace window protects staged uploads (form open, record not submitted). */
/* -------------------------------------------------------------------------- */

const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export async function cleanupOrphanImages(): Promise<{
  scanned: number;
  deleted: number;
  skipped: number;
}> {
  if (!r2Configured()) throw new Error("R2 not configured");

  const [objects, itemsRes, listsRes] = await Promise.all([
    listObjects("wishlist/"),
    admin().from("wishlist_items").select("images"),
    admin().from("wishlists").select("cover_image_url"),
  ]);

  const referenced = new Set<string>();
  for (const row of (itemsRes.data ?? []) as { images: string[] | null }[]) {
    for (const url of row.images ?? []) {
      const key = keyFromPublicUrl(url);
      if (key) referenced.add(key);
    }
  }
  for (const row of (listsRes.data ?? []) as { cover_image_url: string | null }[]) {
    const key = keyFromPublicUrl(row.cover_image_url);
    if (key) referenced.add(key);
  }

  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  let deleted = 0;
  let skipped = 0;
  for (const obj of objects) {
    if (referenced.has(obj.key)) continue;
    const age = Date.parse(obj.lastModified);
    if (Number.isFinite(age) && age > cutoff) {
      skipped++;
      continue;
    }
    try {
      await deleteObject(obj.key);
      deleted++;
    } catch {
      skipped++;
    }
  }

  return { scanned: objects.length, deleted, skipped };
}

wishlist.post("/admin/cleanup-orphan-images", async (c) => {
  const expected = env.imageCleanupSecret;
  if (!expected) return fail(c, 503, "Cleanup is not configured.");
  if (c.req.header("authorization") !== `Bearer ${expected}`) {
    return fail(c, 401, "Unauthorized");
  }
  try {
    const result = await cleanupOrphanImages();
    return c.json({ ok: true, ...result });
  } catch (e) {
    return fail(c, 500, e instanceof Error ? e.message : "Cleanup failed");
  }
});

export default wishlist;
