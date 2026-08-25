import { getServerClient } from '@/lib/supabase/server';
import type { AccessGrant, BranchOption } from '@/lib/access-scope';

/**
 * The access register's read layer.
 *
 * Every query runs under the signed-in user's session, and the policies on
 * `konekt.access_grants` are HQ-only. Someone at a zone calling this gets an
 * empty list, not an error — which is the right answer: a code is a
 * credential, and a zone manager has no business reading the branch codes
 * underneath them.
 */

export * from '@/lib/access-scope';

export async function getAccessGrants(): Promise<AccessGrant[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from('access_grants' as never)
    .select('id, code, label, holder_name, holder_phone, note, role, zone_code, branch_id, expires_at, issued_at, redeemed_at, staff_user_id, revoked_at, revoked_reason')
    .order('issued_at', { ascending: false })
    .limit(500);

  return (data as unknown as AccessGrant[]) ?? [];
}

/** Branches, for the picker. Scoped by RLS like everything else. */
export async function getBranchOptions(): Promise<BranchOption[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from('branches' as never)
    .select('id, name, zone_code')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(1000);

  return (data as unknown as BranchOption[]) ?? [];
}
