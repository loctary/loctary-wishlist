/**
 * Centralised, validated environment access. Import `env` everywhere instead of
 * reading `process.env` directly so a missing var fails fast.
 *
 * Resolution is **lazy**: the first time any `env.x` is read, the config is
 * built from `process.env` and memoised. This matters on Cloudflare Workers —
 * there is no env file; the bindings (vars + secrets) are bridged into
 * `process.env` per request (see `worker.ts`), so config must not be read at
 * module-eval time. On Node, `.env.local` is loaded first.
 *
 * Mirrors loctary-auth's env module; the wishlist-specific addition is
 * `WISHLIST_OWNER_ID` (the default owner whose list the index renders).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFiles(): void {
  // Node only. On Workers there is no loadEnvFile / filesystem — bail out and
  // rely on process.env (populated from bindings).
  try {
    if (typeof process.loadEnvFile !== "function") return;
    const cwd = process.cwd();
    for (const dir of [cwd, resolve(cwd, "../.."), resolve(cwd, "..")]) {
      for (const file of [".env.local", ".env"]) {
        const path = resolve(dir, file);
        if (existsSync(path)) process.loadEnvFile(path);
      }
    }
  } catch {
    /* not a Node FS environment — ignore */
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export interface Env {
  nodeEnv: string;
  isProd: boolean;
  port: number;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  cookieDomain: string;
  corsAllowedOrigins: string[];
  /** Default wishlist owner shown on the index page (the admin's auth uuid). */
  wishlistOwnerId: string;
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  loadEnvFiles();
  const nodeEnv = optional("NODE_ENV", "development");
  cached = {
    nodeEnv,
    isProd: nodeEnv === "production",
    port: Number(optional("PORT", "3003")),
    supabaseUrl: required("SUPABASE_URL"),
    supabaseAnonKey: required("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    cookieDomain: optional("COOKIE_DOMAIN", "localhost"),
    corsAllowedOrigins: optional("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    wishlistOwnerId: required("WISHLIST_OWNER_ID"),
  };
  return cached;
}

/**
 * Lazy proxy: existing `env.x` reads resolve through `getEnv()` at access time,
 * so nothing is read until the first request (when Worker bindings are ready).
 */
export const env: Env = new Proxy({} as Env, {
  get: (_target, prop: string) => getEnv()[prop as keyof Env],
});
