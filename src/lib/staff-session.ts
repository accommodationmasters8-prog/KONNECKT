import { cache } from 'react';
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
  /** The zone this account owns, if it owns one. Never a filter — row level
   *  security already decided what can be read. It is here so a screen can
   *  put a zone manager straight into their own zone instead of asking them
   *  which one they are. */
  zone: string | null;
  /** Likewise the branch, for an account scoped to one. */
  branchId: string | null;
}

const NOT_SIGNED_IN: StaffSession = {
  role: 'hq',
  user: null,
  scopeLabel: 'Not signed in — showing register figures only',
  signedIn: false,
  staffId: null,
  zone: null,
  branchId: null,
};

/**
 * Who is using the console, resolved once per request — and now actually once.
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
export const getStaffSession = cache(async (): Promise<StaffSession> => {
  const supabase = await getServerClient();
  if (!supabase) return NOT_SIGNED_IN;

  /* One round trip, not two.
   *
   * This used to call `auth.getUser()` — a request to the auth server — and
   * then query `staff_users` with the id it came back with. Two network hops,
   * one after the other, before a page could start fetching anything it was
   * actually for.
   *
   * `my_staff_profile()` resolves the row from `auth.uid()` inside the
   * database, which reads it from the JWT the database has already verified
   * on this connection. So the identity is still checked against a signature
   * rather than trusted from a cookie — it is checked in the one place that
   * was always going to check it, instead of in two places in series. A
   * forged cookie fails the database's own verification and returns nothing.
   */
  const { data } = await supabase.rpc('my_staff_profile' as never);

  const staff = (Array.isArray(data) ? data[0] : data) as {
    id: string;
    role: StaffRole;
    full_name: string | null;
    email: string | null;
    zone_code: string | null;
    branch_id: string | null;
  } | null | undefined;

  if (!staff?.id) {
    // Either nobody is signed in, or they are but they are not staff. Both
    // see what any visitor sees, and neither is an error.
    return NOT_SIGNED_IN;
  }

  // Stamp when this account was last using the console.
  //
  // Not awaited: the answer is never read on this request, and making every
  // page render wait on a write nobody is looking at is the wrong trade. The
  // function throttles itself to one write per fifteen minutes in the
  // statement, so a burst of navigation is a single update.
  void supabase.rpc('touch_last_seen' as never).then(
    () => undefined,
    () => undefined,
  );

  return {
    role: staff.role,
    staffId: staff.id,
    signedIn: true,
    zone: staff.zone_code ?? null,
    branchId: staff.branch_id ?? null,
    user: {
      name: staff.full_name || staff.email || 'Staff user',
      email: staff.email ?? undefined,
    },
    scopeLabel:
      staff.role === 'hq'
        ? 'National — every zone'
        : staff.zone_code
          ? `${staff.zone_code.replace(/_/g, ' ')} zone`
          : 'Branch scope',
  };
});
