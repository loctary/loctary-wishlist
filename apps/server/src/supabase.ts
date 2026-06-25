import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

/**
 * Two server-side clients (mirrors loctary-auth):
 *
 * - `anon()`  : public anon key. Used to verify a user's access token
 *               (`auth.getUser`) and to refresh an expired session
 *               (`auth.refreshSession`) — exactly what auth's `/me` does.
 *
 * - `admin()` : service-role key. All wishlist data access goes through this
 *               (it bypasses RLS) plus the `profiles` role lookup. The
 *               service-role key MUST never reach the client bundle.
 *
 * `persistSession: false` — the server is stateless; the session lives in the
 * HttpOnly cookies loctary-auth sets.
 */
const noPersist = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
} as const;

let anonClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

export function anon(): SupabaseClient {
  anonClient ??= createClient(env.supabaseUrl, env.supabaseAnonKey, noPersist);
  return anonClient;
}

export function admin(): SupabaseClient {
  adminClient ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, noPersist);
  return adminClient;
}
