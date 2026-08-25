import { getServerClient } from '@/lib/supabase/server';

export interface FreelancerRecord {
  id: string;
  full_name: string;
  phone_e164: string;
  status: string;
  branch_id: string;
  zone_code: string | null;
  commission_tzs_per_account: number | null;
  registered_at: string;
  activated_at: string | null;
}

export interface FreelancerSession {
  freelancer: FreelancerRecord | null;
  /** True when a project is attached at all, so callers can tell the two apart. */
  configured: boolean;
}

/**
 * The signed-in freelancer, if there is one.
 *
 * `freelancers_self_read` is the only policy that returns this row to them:
 * it matches on auth_user_id, so a freelancer cannot read another's record
 * however they ask for it. A staff user hitting this page gets nothing, which
 * is correct — the freelancer dashboard is not a staff screen.
 */
export async function getFreelancerSession(): Promise<FreelancerSession> {
  const supabase = await getServerClient();
  if (!supabase) return { freelancer: null, configured: false };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { freelancer: null, configured: true };

  const { data } = await supabase
    .from('freelancers' as never)
    .select('id, full_name, phone_e164, status, branch_id, zone_code, commission_tzs_per_account, registered_at, activated_at')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();

  return { freelancer: (data as unknown as FreelancerRecord | null) ?? null, configured: true };
}
