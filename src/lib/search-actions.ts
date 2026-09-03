'use server';

import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface FoundStation {
  id: string;
  name: string;
  district_name: string | null;
  region_name: string | null;
  category_id: string | null;
  branch_id: string | null;
  zone_code: string | null;
  last_report_month: string | null;
  portfolio: number | null;
}

/**
 * Find an institution by keyword.
 *
 * The register holds twenty-one thousand of them, which is a number you
 * cannot put on a page. Everywhere the console needs one — the list, a visit,
 * an event, a report filter — asks this instead, and the answer comes back in
 * about forty milliseconds because the matching happens on an index in
 * Postgres rather than over a thousand rows that were shipped to the browser
 * on the off-chance.
 *
 * The search function is SECURITY INVOKER, so the row level policy on
 * `stations` is what decides the result: a branch officer typing a common
 * word gets their own institutions, not the bank's.
 */
export async function searchStations(
  query: string,
  options: { limit?: number; categoryId?: string | null; branchId?: string | null } = {},
): Promise<FoundStation[]> {
  const q = query.trim();
  const supabase = await getServerClient();
  if (!supabase) return [];

  // Signed out, there is nothing to search: the policy would return nothing
  // anyway, and asking is a round trip that tells us what we already know.
  const session = await getStaffSession();
  if (!session.signedIn) return [];

  const { data, error } = await supabase.rpc('search_stations' as never, {
    q,
    want: Math.min(Math.max(options.limit ?? 20, 1), 50),
    only_category: options.categoryId ?? null,
    only_branch: options.branchId ?? null,
  } as never);

  if (error) return [];
  return (data as unknown as FoundStation[]) ?? [];
}
