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
/**
 * How long is left on the access token in the cookie, in seconds.
 *
 * Null when there is no token, or when anything about it cannot be read — in
 * which case the caller does the full check rather than guessing.
 *
 * This only ever decides whether to *refresh*. It is not a permission check
 * and cannot be used as one: every query still carries the token to the
 * database, which verifies its signature before returning a single row.
 */
function secondsLeftOnToken(request: NextRequest): number | null {
  try {
    const cookie = request.cookies
      .getAll()
      .find((c) => /^sb-.*-auth-token(\.0)?$/.test(c.name));
    if (!cookie?.value) return null;

    // Newer clients store the session as base64-<json>; older ones as JSON.
    const raw = cookie.value.startsWith('base64-')
      ? Buffer.from(cookie.value.slice(7), 'base64').toString('utf8')
      : cookie.value;

    const session = JSON.parse(raw) as { access_token?: string };
    const token = session.access_token;
    if (!token) return null;

    const payload = token.split('.')[1];
    if (!payload) return null;

    const claims = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { exp?: number };

    if (typeof claims.exp !== 'number') return null;
    return claims.exp - Math.floor(Date.now() / 1000);
  } catch {
    // A cookie shape this does not recognise. Fall back to asking properly.
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // No project attached: nothing to refresh, and the whole site is designed to
  // render without one.
  if (!isConfigured) return response;

  /* A token with time left on it has nothing to refresh, and asking the auth
     server to confirm that costs a network round trip in front of every single
     navigation — before the page has started fetching anything it is for.
     Under the old code that was the first of four hops in series.
     Five minutes of headroom, so a refresh always happens well before a token
     can expire mid-render. */
  const left = secondsLeftOnToken(request);
  if (left !== null && left > 300) return response;

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
