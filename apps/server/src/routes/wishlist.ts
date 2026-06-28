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
 * Wishlist API. All data access uses the service-role client (`admin()`); the
 * `requireUser` middleware plus per-item ownership checks do the authorization.
 * Every user owns a wishlist: they manage their own items under `/manage/*` and
 * may reserve from anyone else's. Public responses go through `publicItem()`,
 * which strips who reserved an item — browsers learn an item is `reserved` (so
 * nobody double-buys) but never by whom.
 *
 * Images: each item owns up to 3 URLs in the inline `images` array column. The
 * client uploads each cropped image to R2 first (see `/manage/images/upload`)
 * and submits the resulting URLs with the item — so create/update is atomic
 * on the array. Images uploaded but never attached are removed by the nightly
 * orphan-cleanup cron.
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

/** All columns we ever read back. */
const ITEM_COLUMNS =
  "id, owner_id, title, description, price, currency, position, status, is_active, images, reserved_by, reserved_at, created_at, updated_at";

interface ItemRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
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

/**
 * Public projection — never leaks the reserver's identity. It does include a
 * `viewer` block of capability flags computed against the current session: these
 * are true only for the asker (a third party sees all-false), so the frontend can
 * render the right button state up-front without revealing *who* reserved an item.
 *
 * - `isOwner`     — the viewer owns this item (can't reserve their own).
 * - `isReserver`  — the viewer is the one who reserved it.
 * - `canReserve`  — available, signed in, and not the owner.
 * - `canCancel`   — reserved, and the viewer is the reserver OR the list owner.
 */
function publicItem(row: ItemRow, viewer?: SessionUser | null) {
  const isOwner = !!viewer && row.owner_id === viewer.id;
  const isReserver = !!viewer && row.reserved_by === viewer.id;
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
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

/**
 * Owner projection — includes the reservation, resolved to the reserver. Only
 * the reserver's id + display name are exposed; their email is never leaked to
 * the client, even to the list owner.
 */
function adminItem(row: ItemRow, reserver: { id: string; name: string | null } | null) {
  return {
    ...publicItem(row),
    reservedBy: row.reserved_by,
    reservedAt: row.reserved_at,
    reserver: reserver ? { id: reserver.id, name: reserver.name } : null,
    updatedAt: row.updated_at,
  };
}

/** Opaque keyset cursor over (position, created_at, id) in descending order. */
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

/**
 * Resolve a set of user ids to name/avatar (deduped). The display name is the
 * app's own `profiles.display_name` (one batched query), never the auth
 * `user_metadata`. The avatar still comes from auth metadata (Google etc.).
 */
async function resolveUsers(ids: string[]) {
  const unique = [...new Set(ids)];
  const map = new Map<
    string,
    { id: string; name: string | null; avatarUrl: string | null }
  >();
  if (unique.length === 0) return map;

  const { data: profiles } = await admin()
    .from("profiles")
    .select("id, display_name")
    .in("id", unique);
  const names = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]),
  );

  await Promise.all(
    unique.map(async (id) => {
      const { data } = await admin().auth.admin.getUserById(id);
      const meta = data?.user?.user_metadata as Record<string, unknown> | undefined;
      const avatar = meta?.avatar_url ?? meta?.picture;
      map.set(id, {
        id,
        name: names.get(id) ?? null,
        avatarUrl: typeof avatar === "string" ? avatar : null,
      });
    }),
  );
  return map;
}

/* -------------------------------------------------------------------------- */
/* validation schemas                                                          */
/* -------------------------------------------------------------------------- */

/**
 * An image URL must be one of ours — i.e. live under R2_PUBLIC_BASE_URL.
 * Otherwise a client could attach arbitrary external URLs and bypass our
 * own moderation/cleanup. When R2 is not configured the check is relaxed so
 * dev still works without images.
 */
const imageUrl = z.string().refine(
  (u) => {
    if (!u || typeof u !== "string") return false;
    const base = env.r2PublicBaseUrl;
    if (!base) return true; // dev without R2 configured: accept anything
    return u.startsWith(base + "/");
  },
  { message: "Image URL must be one served from our bucket" },
);

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().nonnegative("Price can't be negative").optional().nullable(),
  currency: z.string().length(3, "Use a 3-letter currency code").optional(),
  position: z.number().int().optional(),
  isActive: z.boolean().optional(),
  /** Ordered 0..2; cover at index 0. Cap is also enforced by a CHECK constraint. */
  images: z.array(imageUrl).max(3, "You can attach up to 3 images").optional(),
});

/** Body for the dedicated visibility toggle. */
const activeSchema = z.object({ active: z.boolean() });

// Edit: every field optional; at least one present.
const editSchema = createSchema.partial().refine((o) => Object.keys(o).length > 0, {
  message: "Nothing to update",
});

/** Map camelCase API fields → snake_case columns. */
function toColumns(input: Partial<z.infer<typeof createSchema>>) {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.description !== undefined) out.description = input.description;
  if (input.price !== undefined) out.price = input.price;
  if (input.currency !== undefined) out.currency = input.currency;
  if (input.position !== undefined) out.position = input.position;
  if (input.isActive !== undefined) out.is_active = input.isActive;
  if (input.images !== undefined) out.images = input.images;
  return out;
}

/* -------------------------------------------------------------------------- */
/* session on every route                                                      */
/* -------------------------------------------------------------------------- */

wishlist.use("*", loadSession);

/* -------------------------------------------------------------------------- */
/* GET /me  -> the caller's session (id, email, role) or null                  */
/* -------------------------------------------------------------------------- */
wishlist.get("/me", (c) => c.json({ user: c.get("user") }));

/* -------------------------------------------------------------------------- */
/* GET /items  -> public paginated list (infinite, keyset cursor)              */
/* -------------------------------------------------------------------------- */
wishlist.get("/items", async (c) => {
  const owner = c.req.query("owner") || env.wishlistOwnerId;
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 12), 1), 50);
  const cursorRaw = c.req.query("cursor");

  let query = admin()
    .from("wishlist_items")
    .select(ITEM_COLUMNS)
    .eq("owner_id", owner)
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

  const viewer = c.get("user");
  return c.json({
    items: page.map((r) => publicItem(r, viewer)),
    nextCursor,
  });
});

/* -------------------------------------------------------------------------- */
/* GET /items/:id  -> single public item                                       */
/* -------------------------------------------------------------------------- */
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
  if (!row.is_active && row.owner_id !== viewer?.id) return fail(c, 404, "Item not found");
  return c.json({ item: publicItem(row, viewer) });
});

/* -------------------------------------------------------------------------- */
/* GET /me/reservations  -> the caller's own reservations (full)               */
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

/* -------------------------------------------------------------------------- */
/* POST /items/:id/reserve  -> reserve an available item                       */
/* -------------------------------------------------------------------------- */
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
    if (row.reserved_by === user.id) return c.json({ item: publicItem(row, user) }); // idempotent
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

/* -------------------------------------------------------------------------- */
/* DELETE /items/:id/reserve  -> cancel the caller's own reservation           */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/* GET /users/:id  -> a user's public profile (display name only, no email)    */
/* -------------------------------------------------------------------------- */
wishlist.get("/users/:id", async (c) => {
  const id = c.req.param("id");
  const resolved = (await resolveUsers([id])).get(id);
  return c.json({
    user: { id, name: resolved?.name ?? null, avatarUrl: resolved?.avatarUrl ?? null },
  });
});

/* ========================================================================== */
/* Manage — the caller's OWN wishlist                                          */
/* ========================================================================== */

/* GET /manage/items  -> the caller's own list incl. reserver identity         */
wishlist.get("/manage/items", requireUser, async (c) => {
  const user = c.get("user")!;
  const { data, error } = await admin()
    .from("wishlist_items")
    .select(ITEM_COLUMNS)
    .eq("owner_id", user.id)
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

/* POST /manage/items  -> create on the caller's own list                      */
wishlist.post("/manage/items", requireUser, async (c) => {
  const user = c.get("user")!;
  const parsed = await parseBody(c, createSchema);
  if (!parsed.ok) return fail(c, 400, parsed.error, parsed.fields);

  const { data, error } = await admin()
    .from("wishlist_items")
    .insert({ ...toColumns(parsed.data), owner_id: user.id })
    .select(ITEM_COLUMNS)
    .single();

  if (error) return fail(c, 500, "Could not create the item");
  return c.json({ item: adminItem(data as ItemRow, null) }, 201);
});

/* PATCH /manage/items/:id  -> edit (only your own item)                       */
/* Reserved items are mid-gift and gifted items are a closed record — both are */
/* locked from editing. The status filter is in the UPDATE so the gating is    */
/* atomic with the write.                                                      */
wishlist.patch("/manage/items/:id", requireUser, async (c) => {
  const user = c.get("user")!;
  const parsed = await parseBody(c, editSchema);
  if (!parsed.ok) return fail(c, 400, parsed.error, parsed.fields);

  const id = c.req.param("id");

  const { data, error } = await admin()
    .from("wishlist_items")
    .update(toColumns(parsed.data))
    .eq("id", id)
    .eq("owner_id", user.id)
    .not("status", "in", "(reserved,confirmed)")
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not update the item");
  if (!data) {
    // Disambiguate: was it "not your item" vs "locked by status"?
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
  const reserver = row.reserved_by ? (await resolveUsers([row.reserved_by])).get(row.reserved_by) ?? null : null;
  return c.json({ item: adminItem(row, reserver) });
});

/* DELETE /manage/items/:id  -> delete (only your own item)                    */
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

  // Image objects in R2 are cleaned up by the nightly orphan-cleanup cron — a
  // best-effort sync delete here would slow the request and isn't necessary.
  const { error } = await admin().from("wishlist_items").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return fail(c, 500, "Could not delete the item");
  return c.json({ ok: true });
});

/* POST /manage/items/:id/active  -> show/hide an item on your own list         */
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

/* POST /manage/items/:id/confirm  -> reserved -> confirmed (gift presented)   */
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
  const reserver = row.reserved_by ? (await resolveUsers([row.reserved_by])).get(row.reserved_by) ?? null : null;
  return c.json({ item: adminItem(row, reserver) });
});

/* POST /manage/items/:id/decline  -> reserved -> available (release)          */
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
/* Image staging upload                                                        */
/*                                                                             */
/* The form uploads each cropped image (≤300KB WebP/JPEG/PNG) here *before*    */
/* submitting the item. The response carries the public URL the client then    */
/* puts into the item's `images` array. The object isn't yet associated with   */
/* any row — if the user closes the form, the nightly cron sweeps it up after  */
/* the 24h grace window.                                                      */
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

  // Random UUID filename, not under a user-specific path — bucket can't be
  // enumerated by user and there's no item id yet.
  const key = `wishlist/${crypto.randomUUID()}.${ext}`;
  try {
    await putObject(key, body, contentType);
  } catch {
    return fail(c, 502, "Could not store the image. Please try again.");
  }

  return c.json({ url: publicUrl(key) }, 201);
});

/* -------------------------------------------------------------------------- */
/* Orphan-image cleanup (admin/cron)                                           */
/*                                                                             */
/* Lists every object under `wishlist/` in R2 and deletes those NOT referenced */
/* by any row's `images` array. A 24h grace window protects staged uploads     */
/* (form open, item not yet submitted) and uploads in flight during the run.   */
/* -------------------------------------------------------------------------- */

const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export async function cleanupOrphanImages(): Promise<{
  scanned: number;
  deleted: number;
  skipped: number;
}> {
  if (!r2Configured()) throw new Error("R2 not configured");

  const [objects, { data: rows }] = await Promise.all([
    listObjects("wishlist/"),
    admin().from("wishlist_items").select("images"),
  ]);

  // Collect every referenced key from the `images` arrays (urls → keys).
  const referenced = new Set<string>();
  for (const row of (rows ?? []) as { images: string[] | null }[]) {
    for (const url of row.images ?? []) {
      const key = keyFromPublicUrl(url);
      if (key) referenced.add(key);
    }
  }

  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  let deleted = 0;
  let skipped = 0;
  for (const obj of objects) {
    if (referenced.has(obj.key)) continue;
    const age = Date.parse(obj.lastModified);
    if (Number.isFinite(age) && age > cutoff) {
      skipped++; // within grace window
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

/* POST /admin/cleanup-orphan-images  -> manual trigger (shared secret header) */
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
