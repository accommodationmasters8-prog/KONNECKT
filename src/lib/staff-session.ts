import { getServerClient } from '@/lib/supabase/server';
import type { StaffUser } from '@/components/staff/StaffShell';
import type { StaffRole } from '@/lib/supabase/types';

export interface StaffSession {
  /** Role the console renders for. Defaults to `hq` when nobody is signed in,
   *  because with no session there is nothing scoped to hide — every figure
   *  shown in that state comes from the committed public register. */
  role: StaffRole;
  user: StaffUser | null;
  /** What the top bar says the figures are scoped to. */
  scopeLabel: string;
  signedIn: boolean;
  /** konekt.staff_users.id, for writes that record an actor. */
  staffId: string | null;
}

const NOT_SIGNED_IN: StaffSession = {
  role: 'hq',
  user: null,
  scopeLabel: 'Not signed in — showing register figures only',
  signedIn: false,
  staffId: null,
};

/**
 * Who is using the console, resolved once per request.
 *
 * The role comes from `konekt.staff_users`, read under the user's own session,
 * so a forged cookie cannot promote anyone: the row is only visible if RLS
 * says it is. What this returns decides what the console *shows*; what it can
 * *read* is decided in the database, on every query, by the policies in
 * migration 0006.
 *
 * With no project configured or nobody signed in it returns the not-signed-in
 * session rather than throwing, so the console still renders the public
 * register instead of a 500.
 */
export async function getStaffSession(): Promise<StaffSession> {
  const supabase = await getServerClient();
  if (!supabase) return NOT_SIGNED_IN;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NOT_SIGNED_IN;

  // Filtered on the auth id, not just limited to one row. `staff_self_read`
  // lets an HQ user see every staff row, so an unfiltered `limit(1)` would
  // hand them whichever row the planner returned first — someone else's role,
  // someone else's scope. The policy is not the filter here; this is.
  const { data } = await supabase
    .from('staff_users' as never)
    .select('id, role, full_name, email, zone_code, branch_id')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();

  const staff = data as {
    id: string;
    role: StaffRole;
    full_name: string | null;
    email: string | null;
    zone_code: string | null;
  } | null;

  if (!staff) {
    // Authenticated, but not a staff user. That is not an error and must not
    // read as one: they simply see what any visitor sees.
    return {
      ...NOT_SIGNED_IN,
      scopeLabel: 'Signed in, but this account is not a staff user',
    };
  }

  return {
    role: staff.role,
    staffId: staff.id,
    signedIn: true,
    user: {
      name: staff.full_name || staff.email || auth.user.email || 'Staff user',
      email: staff.email ?? auth.user.email ?? undefined,
    },
    scopeLabel:
      staff.role === 'hq'
        ? 'National — every zone'
        : staff.zone_code
          ? `${staff.zone_code.replace(/_/g, ' ')} zone`
          : 'Branch scope',
  };
}
