'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface EngagementResult {
  ok: boolean;
  message: string;
}

/**
 * Recording a visit.
 *
 * A branch books a call on an institution and comes back with names. Two
 * figures carry the whole point of it: how many leads the branch expected and
 * how many it got. The rest is the ordinary KPI set, so a visit reads the same
 * way a monthly report does.
 *
 * The institution is free text on purpose. A branch can call on a school that
 * nobody has put on the register yet, and refusing the visit until the
 * paperwork exists would just mean the visit goes unrecorded.
 */
export async function recordEngagement(
  _prev: EngagementResult | null,
  form: FormData,
): Promise<EngagementResult> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false, message: 'No database is attached.' };

  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false, message: 'Sign in first.' };

  const institution = String(form.get('institution') ?? '').trim();
  const branchId = String(form.get('branch_id') ?? '').trim();
  const engagedOn = String(form.get('engaged_on') ?? '').trim();

  if (!institution) return { ok: false, message: 'Name the institution.' };
  if (!branchId) return { ok: false, message: 'Pick the branch.' };
  if (!engagedOn) return { ok: false, message: 'Give the date of the visit.' };

  const num = (key: string) => {
    const raw = String(form.get(key) ?? '').trim();
    if (raw === '') return 0;
    const value = Number(raw.replace(/,/g, ''));
    return Number.isFinite(value) && value >= 0 ? value : NaN;
  };

  const fields = {
    leads_expected: num('leads_expected'),
    leads_got: num('leads_got'),
    accounts_opened: num('accounts_opened'),
    accounts_activated: num('accounts_activated'),
    simbanking_activated: num('simbanking_activated'),
    lipa_hapa_registered: num('lipa_hapa_registered'),
    deposits_tzs: num('deposits_tzs'),
  };

  if (Object.values(fields).some((v) => Number.isNaN(v))) {
    return { ok: false, message: 'Every figure has to be a whole number, zero or more.' };
  }

  const categoryId = String(form.get('category_id') ?? '').trim();

  const { error } = await supabase.from('engagements' as never).insert({
    institution,
    branch_id: branchId,
    category_id: categoryId || null,
    engaged_on: engagedOn,
    notes: String(form.get('notes') ?? '').trim() || null,
    created_by: session.staffId,
    ...fields,
  } as never);

  if (error) {
    // The only failure a branch officer can actually cause is picking a branch
    // they cannot reach, and RLS reports that as a policy violation.
    return {
      ok: false,
      message: /row-level security|policy/i.test(error.message)
        ? 'That branch is outside what your account can reach.'
        : error.message,
    };
  }

  revalidatePath('/[locale]/staff/engagements', 'page');
  revalidatePath('/[locale]/staff', 'page');
  return { ok: true, message: `${institution} recorded.` };
}
