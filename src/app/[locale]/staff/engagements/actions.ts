'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface EngagementResult {
  ok: boolean;
  message: string;
  /** The row that was written, so the form can go straight on editing it. */
  id?: string;
}

/**
 * Everything a visit is, read off the form once.
 *
 * Recording and correcting a visit ask for exactly the same things, so they
 * validate in one place. When they were separate the two drifted, which is how
 * a screen ends up accepting a figure on the way in and rejecting it on the
 * way back.
 */
function read(form: FormData):
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; message: string } {
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

  const figures = {
    leads_expected: num('leads_expected'),
    leads_got: num('leads_got'),
    accounts_opened: num('accounts_opened'),
    accounts_activated: num('accounts_activated'),
    simbanking_activated: num('simbanking_activated'),
    lipa_hapa_registered: num('lipa_hapa_registered'),
    deposits_tzs: num('deposits_tzs'),
  };

  if (Object.values(figures).some((v) => Number.isNaN(v))) {
    return { ok: false, message: 'Every figure has to be a whole number, zero or more.' };
  }

  /* Empty when the visit was to somewhere not on the register — which is
     allowed, and is why the institution is still stored as text. When it is
     set, the visit hangs off the institution and rolls up with it instead of
     being a name that happens to look like one. */
  const stationId = String(form.get('station_id') ?? '').trim();
  const categoryId = String(form.get('category_id') ?? '').trim();

  /* The event this visit came out of, when it came out of one. A branch runs
     an activation and books the calls it generated; linking them is what lets
     the event page say what the event actually produced instead of leaving
     the leads to be counted twice by whoever reads both screens. */
  const eventId = String(form.get('event_id') ?? '').trim();

  return {
    ok: true,
    values: {
      institution,
      station_id: stationId || null,
      branch_id: branchId,
      category_id: categoryId || null,
      event_id: eventId || null,
      engaged_on: engagedOn,
      notes: String(form.get('notes') ?? '').trim() || null,
      ...figures,
    },
  };
}

/**
 * Everything a written visit changes.
 *
 * A visit is counted on three screens — its own list, the event it belongs to,
 * and the overview — so writing one has to refresh all three or two of them go
 * stale and the console starts disagreeing with itself. `layout` rather than
 * `page` because the figures also appear in the shell's own panels.
 */
function refreshEverythingThatCounts(eventId?: string | null) {
  revalidatePath('/[locale]/staff/engagements', 'page');
  revalidatePath('/[locale]/staff/events', 'page');
  revalidatePath('/[locale]/staff', 'page');
  if (eventId) revalidatePath(`/[locale]/staff/events/${eventId}`, 'page');
}

/** Turn a database failure into something a branch officer can act on. */
function explain(message: string) {
  return /row-level security|policy/i.test(message)
    ? 'That branch is outside what your account can reach.'
    : message;
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

  const parsed = read(form);
  if (!parsed.ok) return parsed;

  const { data, error } = await supabase
    .from('engagements' as never)
    .insert({ ...parsed.values, created_by: session.staffId } as never)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, message: explain(error.message) };

  refreshEverythingThatCounts(parsed.values.event_id as string | null);
  return {
    ok: true,
    message: `${parsed.values.institution} recorded.`,
    id: (data as unknown as { id: string } | null)?.id,
  };
}

/**
 * Correcting one.
 *
 * The figures on a visit are what somebody wrote down in a notebook and typed
 * in afterwards, so they are wrong sometimes — and until this existed the only
 * way to fix one was to record it again, which left the wrong figures in place
 * and counted the visit twice.
 *
 * The update is filtered on the id alone. The row policy decides whether that
 * id is reachable; adding a branch check here as well would be a second,
 * weaker copy of a rule the database already enforces, and it would disagree
 * with it the first time somebody's scope changed.
 */
export async function updateEngagement(
  _prev: EngagementResult | null,
  form: FormData,
): Promise<EngagementResult> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false, message: 'No database is attached.' };

  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false, message: 'Sign in first.' };

  const id = String(form.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Which visit?' };

  const parsed = read(form);
  if (!parsed.ok) return parsed;

  /* `select` after the update, so a write that matched nothing is reported as
     such. Without it PostgREST returns success for an update that changed no
     rows, and a visit outside this account's scope would silently appear to
     save — the screen saying "saved" while the database ignored it. */
  const { data, error } = await supabase
    .from('engagements' as never)
    .update({ ...parsed.values, updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, message: explain(error.message) };
  if (!data) {
    return {
      ok: false,
      message: 'That visit was not updated — it may have been removed, or it is outside what your account can reach.',
    };
  }

  refreshEverythingThatCounts(parsed.values.event_id as string | null);
  return { ok: true, message: `${parsed.values.institution} updated.`, id };
}

/** Remove a visit that should never have been recorded. */
export async function deleteEngagement(
  _prev: EngagementResult | null,
  form: FormData,
): Promise<EngagementResult> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false, message: 'No database is attached.' };

  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false, message: 'Sign in first.' };

  const id = String(form.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Which visit?' };

  const { data, error } = await supabase
    .from('engagements' as never)
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, message: explain(error.message) };
  if (!data) {
    return { ok: false, message: 'Nothing was removed — that visit is outside what your account can reach.' };
  }

  refreshEverythingThatCounts(null);
  return { ok: true, message: 'Visit removed.' };
}
