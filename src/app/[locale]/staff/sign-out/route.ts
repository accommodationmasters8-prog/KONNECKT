import { NextResponse, type NextRequest } from 'next/server';
import { getServerClient } from '@/lib/supabase/server';

/**
 * Sign out.
 *
 * POST only, and reached from a real form in the console rail. A sign-out on
 * GET is a link any prefetcher, scanner or chat client can follow, and a user
 * who is silently signed out by a link preview has no idea what happened.
 *
 * The server client writes the cleared cookies through the route handler's
 * response, which is one of the few places cookies can be set at all.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ locale: string }> },
) {
  const { locale } = await ctx.params;
  const supabase = await getServerClient();

  if (supabase) await supabase.auth.signOut();

  return NextResponse.redirect(new URL(`/${locale}/staff/sign-in`, request.url), {
    // 303: turn the POST into a GET for the redirect, so the browser does not
    // try to re-post to the sign-in page.
    status: 303,
  });
}
