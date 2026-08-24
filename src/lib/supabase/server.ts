import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './types';
import { SCHEMA, isConfigured, supabaseAnonKey, supabaseUrl } from './config';

/**
 * Server-side Supabase client, scoped to the signed-in user's session.
 *
 * This is the client every server component and route handler uses. It carries
 * the user's JWT, so every query runs under the row level security policies in
 * migration 0006 — authorisation is enforced by the database on every request,
 * not by whichever component happened to remember to check a role.
 *
 * Returns null when no project is configured, so callers fall back rather than
 * throw. That fallback is deliberate: a landing page must not 500 because an
 * environment variable is missing.
 */
export async function getServerClient() {
  if (!isConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient<Database, typeof SCHEMA>(supabaseUrl, supabaseAnonKey, {
    db: { schema: SCHEMA },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a server component, where cookies are read-only.
          // Session refresh happens in middleware instead.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses row level security entirely.
 *
 * Only ever for work that has no user to act as: the reconciliation feed from
 * core banking, scheduled certificate generation, the geocoding pipeline.
 * Never import this into anything that handles a browser request — if a request
 * needs elevated access, the answer is a policy, not this client.
 */
export function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isConfigured || !key) return null;

  // Imported lazily so the service key never ends up in a bundle that also
  // contains browser code.
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');

  return createClient<Database, typeof SCHEMA>(supabaseUrl, key, {
    db: { schema: SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
