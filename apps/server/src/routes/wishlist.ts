import { Hono, type Context } from "hono";
import { z } from "zod";
import { admin } from "../supabase.js";
import { env } from "../env.js";
import {
  loadSession,
  requireAdmin,
  requireUser,
  type AppVariables,
} from "../auth.js";

/**
 * Wishlist API. All data access uses the service-role client (`admin()`); the
 * `requireUser` / `requireAdmin` middleware do the authorization. Public
 * responses go through `publicItem()`, which strips who reserved an item —
 * browsers learn an item is `reserved` (so nobody double-buys) but never by whom.
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
  "id, owner_id, title, description, url, image_url, price, currency, priority, position, status, reserved_by, reserved_at, created_at, updated_at";

interface ItemRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  url: string | null;
  image_url: string | null;
  price: number | null;
  currency: string;
  priority: number;
  position: number;
  status: "available" | "reserved" | "confirmed" | "declined";
  reserved_by: string | null;
  reserved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Public projection — never leaks the reserver's identity. */
function publicItem(row: ItemRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    url: row.url,
    imageUrl: row.image_url,
    price: row.price,
    currency: row.currency,
    priority: row.priority,
    position: row.position,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Admin projection — includes the reservation, resolved to the reserver. */
function adminItem(row: ItemRow, reserver: { id: string; email: string | null; name: string | null } | null) {
  return {
    ...publicItem(row),
    reservedBy: row.reserved_by,
    reservedAt: row.reserved_at,
    reserver,
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

/** Resolve a set of user ids to email/name via the auth admin API (deduped). */
async function resolveUsers(ids: string[]) {
  const unique = [...new Set(ids)];
  const map = new Map<string, { id: string; email: string | null; name: string | null }>();
  await Promise.all(
    unique.map(async (id) => {
      const { data } = await admin().auth.admin.getUserById(id);
      const u = data?.user;
      map.set(id, {
        id,
        email: u?.email ?? null,
        name: (u?.user_metadata?.name as string | undefined) ?? null,
      });
    }),
  );
  return map;
}

/* -------------------------------------------------------------------------- */
/* validation schemas                                                          */
/* -------------------------------------------------------------------------- */

const httpUrl = z
  .string()
  .url("Enter a valid URL")
  .refine((u) => /^https?:\/\//i.test(u), "URL must start with http(s)://");

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  url: httpUrl.optional().nullable(),
  imageUrl: httpUrl.optional().nullable(),
  price: z.number().nonnegative("Price can't be negative").optional().nullable(),
  currency: z.string().length(3, "Use a 3-letter currency code").optional(),
  priority: z.number().int().optional(),
  position: z.number().int().optional(),
});

// Edit: every field optional; at least one present.
const editSchema = createSchema.partial().refine((o) => Object.keys(o).length > 0, {
  message: "Nothing to update",
});

/** Map camelCase API fields → snake_case columns. */
function toColumns(input: Partial<z.infer<typeof createSchema>>) {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.description !== undefined) out.description = input.description;
  if (input.url !== undefined) out.url = input.url;
  if (input.imageUrl !== undefined) out.image_url = input.imageUrl;
  if (input.price !== undefined) out.price = input.price;
  if (input.currency !== undefined) out.currency = input.currency;
  if (input.priority !== undefined) out.priority = input.priority;
  if (input.position !== undefined) out.position = input.position;
  return out;
}

/* -------------------------------------------------------------------------- */
/* session on every route                                                      */
/* -------------------------------------------------------------------------- */

wishlist.use("*", loadSession);

/* -------------------------------------------------------------------------- */
/* GET /me  -> the caller's session (id, email, role) or null                  */
/* The host uses this as its single session source — it both confirms login    */
/* (via the shared auth cookie) and reports the role for admin gating.         */
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
    .order("position", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1); // fetch one extra to detect a next page

  if (cursorRaw) {
    const cursor = decodeCursor(cursorRaw);
    if (cursor) {
      // keyset "after" in descending (position, created_at, id) order
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

  return c.json({ items: page.map(publicItem), nextCursor });
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
  return c.json({ item: publicItem(data as ItemRow) });
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
  // It's the caller's own data, so the reserver is implicitly themselves.
  const items = (data as ItemRow[]).map((row) => ({
    ...publicItem(row),
    reservedAt: row.reserved_at,
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
  if (row.status === "reserved" || row.status === "confirmed") {
    if (row.reserved_by === user.id) return c.json({ item: publicItem(row) }); // idempotent
    return fail(c, 409, "This item is already reserved");
  }
  if (row.status === "declined") return fail(c, 409, "This item is not available");

  const { data, error } = await admin()
    .from("wishlist_items")
    .update({ status: "reserved", reserved_by: user.id, reserved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "available") // guard against a race
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not reserve the item");
  if (!data) return fail(c, 409, "This item is already reserved");
  return c.json({ item: publicItem(data as ItemRow) });
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
    .eq("status", "reserved") // can't cancel once the owner confirmed
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not cancel the reservation");
  if (!data) return fail(c, 409, "You don't have an active reservation on this item");
  return c.json({ item: publicItem(data as ItemRow) });
});

/* ========================================================================== */
/* Admin                                                                       */
/* ========================================================================== */

/* GET /admin/items  -> full list incl. reserver identity                      */
wishlist.get("/admin/items", requireAdmin, async (c) => {
  const owner = c.req.query("owner") || env.wishlistOwnerId;
  const { data, error } = await admin()
    .from("wishlist_items")
    .select(ITEM_COLUMNS)
    .eq("owner_id", owner)
    .order("position", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return fail(c, 500, "Could not load items");
  const rows = (data ?? []) as ItemRow[];
  const reservers = await resolveUsers(rows.map((r) => r.reserved_by).filter((x): x is string => !!x));
  return c.json({ items: rows.map((r) => adminItem(r, r.reserved_by ? reservers.get(r.reserved_by) ?? null : null)) });
});

/* POST /admin/items  -> create                                                */
wishlist.post("/admin/items", requireAdmin, async (c) => {
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

/* PATCH /admin/items/:id  -> edit                                             */
wishlist.patch("/admin/items/:id", requireAdmin, async (c) => {
  const parsed = await parseBody(c, editSchema);
  if (!parsed.ok) return fail(c, 400, parsed.error, parsed.fields);

  const { data, error } = await admin()
    .from("wishlist_items")
    .update(toColumns(parsed.data))
    .eq("id", c.req.param("id"))
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not update the item");
  if (!data) return fail(c, 404, "Item not found");
  const row = data as ItemRow;
  const reserver = row.reserved_by ? (await resolveUsers([row.reserved_by])).get(row.reserved_by) ?? null : null;
  return c.json({ item: adminItem(row, reserver) });
});

/* DELETE /admin/items/:id  -> delete                                          */
wishlist.delete("/admin/items/:id", requireAdmin, async (c) => {
  const { error, count } = await admin()
    .from("wishlist_items")
    .delete({ count: "exact" })
    .eq("id", c.req.param("id"));

  if (error) return fail(c, 500, "Could not delete the item");
  if (!count) return fail(c, 404, "Item not found");
  return c.json({ ok: true });
});

/* POST /admin/items/:id/confirm  -> reserved -> confirmed (gift presented)    */
wishlist.post("/admin/items/:id/confirm", requireAdmin, async (c) => {
  const { data, error } = await admin()
    .from("wishlist_items")
    .update({ status: "confirmed" })
    .eq("id", c.req.param("id"))
    .eq("status", "reserved")
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not confirm the item");
  if (!data) return fail(c, 409, "Only a reserved item can be confirmed");
  const row = data as ItemRow;
  const reserver = row.reserved_by ? (await resolveUsers([row.reserved_by])).get(row.reserved_by) ?? null : null;
  return c.json({ item: adminItem(row, reserver) });
});

/* POST /admin/items/:id/decline  -> reserved -> available (release)           */
wishlist.post("/admin/items/:id/decline", requireAdmin, async (c) => {
  const { data, error } = await admin()
    .from("wishlist_items")
    .update({ status: "available", reserved_by: null, reserved_at: null })
    .eq("id", c.req.param("id"))
    .eq("status", "reserved")
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) return fail(c, 500, "Could not decline the reservation");
  if (!data) return fail(c, 409, "Only a reserved item can be declined");
  return c.json({ item: adminItem(data as ItemRow, null) });
});

export default wishlist;
