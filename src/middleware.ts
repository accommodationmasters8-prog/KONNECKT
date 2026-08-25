import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SCHEMA, isConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/supabase/config';

/**
 * Session refresh.
 *
 * A Supabase access token lives about an hour. Server components can read
 * cookies but cannot set them, so without this the console would sign a user
 * out mid-shift the first time their token expired — refreshed on the client,
 * never written back, and the next server render sees nobody. This runs the
 * refresh where cookies can actually be written, and passes the new ones on in
 * the same response.
 *
 * It is not an authorisation check. Every table is protected by the policies in
 * migration 0006, so a request that gets past this middleware still cannot read
 * a row the database will not give it. Guarding routes here as well would be a
 * second, weaker copy of a rule that already exists in one place.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // No project attached: nothing to refresh, and the whole site is designed to
  // render without one.
  if (!isConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: SCHEMA },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser(), not getSession(): it verifies the token with the auth server
  // rather than trusting whatever the cookie claims.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the image optimiser. A refresh on a
     * request for a PNG costs a round trip and buys nothing.
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|brand/|sw.js|manifest.webmanifest).*)',
  ],
};
