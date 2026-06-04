import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextApiRequest, NextApiResponse } from 'next';

function buildSetCookieHeader(name: string, value: string, options: CookieOptions): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure || process.env.NODE_ENV === 'production') parts.push('Secure');
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  parts.push(`Path=${options.path ?? '/'}`);
  parts.push(`SameSite=${(options.sameSite as string | undefined) ?? 'Lax'}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join('; ');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = req.query.code as string | undefined;

  if (!code) {
    return res.redirect(302, '/auth/login');
  }

  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies).map(([name, value]) => ({
            name,
            value: value ?? '',
          }));
        },
        setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.push(...cookies);
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('OAuth callback error:', error.message);
    return res.redirect(302, `/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  if (cookiesToSet.length > 0) {
    res.setHeader(
      'Set-Cookie',
      cookiesToSet.map(({ name, value, options }) => buildSetCookieHeader(name, value, options))
    );
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
    return res.redirect(302, '/auth/2fa');
  }

  const next = (req.query.next as string | undefined) ?? '/';
  return res.redirect(302, next);
}
