import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { getEnv } from "./env.js";
import type { AppVariables } from "./auth.js";
import wishlistRoutes, { cleanupOrphanImages } from "./routes/wishlist.js";

/**
 * Cloudflare Workers entry. Same Hono app as the Node server (`index.ts`), but:
 *  - no `@hono/node-server` (Workers provide `fetch` directly);
 *  - Worker bindings (vars + secrets) are bridged into `process.env` so the
 *    shared, process.env-based config in `env.ts` works unchanged.
 */
const app = new Hono<{ Variables: AppVariables }>();

// Bridge bindings → process.env once per isolate (idempotent).
app.use("*", async (c, next) => {
  const bindings = c.env as Record<string, unknown> | undefined;
  if (bindings) {
    for (const [key, value] of Object.entries(bindings)) {
      if (typeof value === "string" && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
  await next();
});

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: (origin) => (getEnv().corsAllowedOrigins.includes(origin) ? origin : ""),
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) => c.json({ ok: true, service: "loctary-wishlist-server" }));
app.route("/wishlist", wishlistRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error("[worker error]", err);
  return c.json({ error: "Internal server error" }, 500);
});

/**
 * Default export wraps the Hono app so we can also expose `scheduled()` —
 * Cloudflare's cron entry point. The trigger (`crons = [...]` in wrangler.toml)
 * invokes this without an HTTP request, so we must first bridge the Worker
 * bindings into `process.env` ourselves (the request middleware above doesn't
 * fire here).
 */
export default {
  fetch: app.fetch,
  async scheduled(_event: unknown, bindings: Record<string, unknown>, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    for (const [key, value] of Object.entries(bindings ?? {})) {
      if (typeof value === "string" && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
    ctx.waitUntil(
      cleanupOrphanImages()
        .then((r) => console.log("[cron] orphan-images cleanup", r))
        .catch((e) => console.error("[cron] orphan-images cleanup failed", e)),
    );
  },
};
