import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import type { AppVariables } from "./auth.js";
import wishlistRoutes from "./routes/wishlist.js";

const app = new Hono<{ Variables: AppVariables }>();

app.use("*", logger());

// Credentialed CORS: the frontend sends the session cookie, so the origin must
// be reflected exactly (no "*") and credentials enabled.
app.use(
  "*",
  cors({
    origin: (origin) => (env.corsAllowedOrigins.includes(origin) ? origin : ""),
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) => c.json({ ok: true, service: "loctary-wishlist-server" }));

app.route("/wishlist", wishlistRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error("[server error]", err);
  return c.json({ error: "Internal server error" }, 500);
});

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`🎁 loctary-wishlist server listening on http://localhost:${info.port}`);
  console.log(`   CORS origins: ${env.corsAllowedOrigins.join(", ")}`);
  console.log(`   Cookie domain: ${env.cookieDomain}`);
  console.log(`   Wishlist owner: ${env.wishlistOwnerId}`);
});
