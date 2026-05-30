import { createClient } from '@supabase/supabase-js';

// Public client — used only in the OAuth callback page to exchange
// the authorization code for a session (PKCE code verifier lives in sessionStorage).
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
