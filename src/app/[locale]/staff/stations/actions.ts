'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface ActionResult {
  ok: boolean;
  message: string;
  id?: string;
}

type Gate =
  | { ok: true; supabase: NonNullable<Awaited<ReturnType<typeof getServerClient>>>;
      session: Awaited<ReturnType<typeof getStaffSession>> }
  | { ok: false; message: string };

async function requireStaff(): Promise<Gate> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false, message: 'No database is attached to this deployment.' };
  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false, message: 'Sign in first.' };
  return { ok: true, supabase, session };
}

/** A non-negative whole number from a form field; anything else is zero. */
function num(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * Which branch a new record belongs to.
 *
 * A branch officer has one and it is theirs — taking it from the session means
 * they cannot file against another branch even by editing the form. A zone
 * manager or HQ has to say which, because they legitimately act for several.
 */
async function resolveBranch(gate: Gate & { ok: true }, form: FormData) {
  const { data } = await gate.supabase
    .from('staff_users' as never)
    .select('branch_id')
    .eq('id', gate.session.staffId ?? '')
    .maybeSingle();

  const own = (data as unknown as { branch_id: string | null } | null)?.branch_id;
  if (own) return own;

  const chosen = String(form.get('branch_id') ?? '').trim();
  return chosen || null;
}

/** Add a station: an institution, organisation, school or group to track. */
export async function createStation(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const name = String(form.get('name') ?? '').trim();
  const categoryId = String(form.get('category_id') ?? '').trim();
  const branchId = await resolveBranch(gate, form);
  const portfolioRaw = String(form.get('portfolio') ?? '').trim();

  if (!name) return { ok: false, message: 'Give the station a name.' };
  if (!categoryId) return { ok: false, message: 'Choose the category it belongs to.' };
  if (!branchId) {
    return { ok: false, message: 'Choose the branch that will report on this station.' };
  }

  const portfolio = portfolioRaw === '' ? null : Number(portfolioRaw);
  if (portfolio !== null && (!Number.isInteger(portfolio) || portfolio < 0)) {
    return { ok: false, message: 'The number of people has to be a whole number.' };
  }

  const { data, error } = await gate.supabase
    .from('stations' as never)
    .insert({
      name,
      short_name: String(form.get('short_name') ?? '').trim() || null,
      category_id: categoryId,
      branch_id: branchId,
      address: String(form.get('address') ?? '').trim() || null,
      district_name: String(form.get('district_name') ?? '').trim() || null,
      contact_name: String(form.get('contact_name') ?? '').trim() || null,
      contact_role: String(form.get('contact_role') ?? '').trim() || null,
      contact_phone: String(form.get('contact_phone') ?? '').replace(/[\s-]/g, '') || null,
      contact_email: String(form.get('contact_email') ?? '').trim() || null,
      status: String(form.get('status') ?? 'active'),
      notes: String(form.get('notes') ?? '').trim() || null,
      portfolio,
      created_by: gate.session.staffId,
    } as never)
    .select('id')
    .single();

  if (error) {
    if (error.message.includes('stations_category_id_branch_id_name_key')) {
      return { ok: false, message: `${name} is already tracked by this branch in that category.` };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: `${name} added. Record its first month below.`,
    id: (data as unknown as { id: string } | null)?.id,
  };
}

/** Edit the station itself — who it is, where it is, who to call. */
export async function updateStation(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = String(form.get('id') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  if (!id) return { ok: false, message: 'Which station?' };
  if (!name) return { ok: false, message: 'A station needs a name.' };

  const { error } = await gate.supabase
    .from('stations' as never)
    .update({
      name,
      short_name: String(form.get('short_name') ?? '').trim() || null,
      category_id: String(form.get('category_id') ?? '').trim() || undefined,
      address: String(form.get('address') ?? '').trim() || null,
      district_name: String(form.get('district_name') ?? '').trim() || null,
      contact_name: String(form.get('contact_name') ?? '').trim() || null,
      contact_role: String(form.get('contact_role') ?? '').trim() || null,
      contact_phone: String(form.get('contact_phone') ?? '').replace(/[\s-]/g, '') || null,
      contact_email: String(form.get('contact_email') ?? '').trim() || null,
      status: String(form.get('status') ?? 'active'),
      notes: String(form.get('notes') ?? '').trim() || null,
    } as never)
    .eq('id', id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved.' };
}

/**
 * File — or correct — one month.
 *
 * An upsert on (station, month), which is what makes this both the data-entry
 * form and the edit form. A branch that reported 400 accounts and meant 4,000
 * fixes the month rather than filing a second one, and the audit log keeps
 * what it said before.
 */
export async function saveReport(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const stationId = String(form.get('station_id') ?? '').trim();
  const month = String(form.get('period_month') ?? '').trim();
  if (!stationId) return { ok: false, message: 'Which station?' };
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { ok: false, message: 'Choose the month this covers.' };
  }

  const num = (key: string) => {
    const raw = String(form.get(key) ?? '').trim();
    if (raw === '') return 0;
    const value = Number(raw.replace(/,/g, ''));
    return Number.isFinite(value) ? value : NaN;
  };

  const portfolio = num('portfolio');
  const opened = num('accounts_opened');
  const active = num('active_accounts');
  const dormant = num('dormant_accounts');
  const deposits = num('deposits_tzs');
  const loansCount = num('loans_count');
  const loansValue = num('loans_value_tzs');

  if ([portfolio, opened, active, dormant, deposits, loansCount, loansValue].some(Number.isNaN)) {
    return { ok: false, message: 'Every figure has to be a number.' };
  }
  if (portfolio < 0) return { ok: false, message: 'The number of people cannot be negative.' };
  if (active + dormant > opened) {
    return {
      ok: false,
      message: `Active (${active}) plus dormant (${dormant}) is more than the ${opened} accounts opened. The database refuses that, and it is usually a typo in one of the three.`,
    };
  }

  const { data, error } = await gate.supabase
    .from('station_reports' as never)
    .upsert({
      station_id: stationId,
      period_month: `${month}-01`,
      portfolio: Math.round(portfolio),
      accounts_opened: Math.round(opened),
      active_accounts: Math.round(active),
      dormant_accounts: Math.round(dormant),
      deposits_tzs: deposits,
      loans_count: Math.round(loansCount),
      loans_value_tzs: loansValue,
      note: String(form.get('note') ?? '').trim() || null,
      submitted_by: gate.session.staffId,
      submitted_at: new Date().toISOString(),
    } as never, { onConflict: 'station_id,period_month' })
    .select('id')
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: `${month} saved.`,
    id: (data as unknown as { id: string } | null)?.id,
  };
}

/** Remove a month that should never have been filed. */
export async function deleteReport(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = String(form.get('report_id') ?? '').trim();
  if (!id) return { ok: false, message: 'Which month?' };

  const { error } = await gate.supabase
    .from('station_reports' as never)
    .delete()
    .eq('id', id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Removed. The audit log keeps what it said.' };
}

/**
 * The account-type breakdown for a month.
 *
 * Written as one form rather than a row at a time, because a breakdown is a
 * single statement about a month — filing "Scholar Account: 420" and then
 * discovering there is no way to say the other six is worse than not offering
 * the breakdown at all.
 *
 * Rows that are entirely zero are deleted rather than stored. A stored zero
 * says "we opened none of these"; a missing row says "we did not break this
 * down". Those are different claims, and the analytics read them differently.
 */
export async function saveAccountBreakdown(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const reportId = String(form.get('report_id') ?? '').trim();
  const stationId = String(form.get('station_id') ?? '').trim();
  if (!reportId) return { ok: false, message: 'Which month?' };

  const codes = form.getAll('product_code').map(String);
  const rows: {
    report_id: string; product_code: string;
    opened: number; active: number; dormant: number; deposits_tzs: number;
  }[] = [];
  const empty: string[] = [];

  for (const code of codes) {
    const opened = num(form.get(`opened__${code}`));
    const active = num(form.get(`active__${code}`));
    const dormant = num(form.get(`dormant__${code}`));
    const deposits = num(form.get(`deposits__${code}`));

    if (active + dormant > opened) {
      return {
        ok: false,
        message: `${code}: active plus dormant cannot be more than opened.`,
      };
    }

    if (opened || active || dormant || deposits) {
      rows.push({
        report_id: reportId, product_code: code,
        opened, active, dormant, deposits_tzs: deposits,
      });
    } else {
      empty.push(code);
    }
  }

  if (rows.length) {
    const { error } = await gate.supabase
      .from('station_report_accounts' as never)
      .upsert(rows as never, { onConflict: 'report_id,product_code' });
    if (error) return { ok: false, message: error.message };
  }

  if (empty.length) {
    const { error } = await gate.supabase
      .from('station_report_accounts' as never)
      .delete()
      .eq('report_id', reportId)
      .in('product_code', empty);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath(`/[locale]/staff/stations/${stationId}`, 'page');
  return {
    ok: true,
    message: rows.length
      ? `Saved the split across ${rows.length} account ${rows.length === 1 ? 'type' : 'types'}.`
      : 'Cleared the account breakdown for this month.',
  };
}

/** The same, for loans. One row per loan type: how many, and how much. */
export async function saveLoanBreakdown(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const reportId = String(form.get('report_id') ?? '').trim();
  const stationId = String(form.get('station_id') ?? '').trim();
  if (!reportId) return { ok: false, message: 'Which month?' };

  const codes = form.getAll('loan_code').map(String);
  const rows: { report_id: string; loan_code: string; count: number; value_tzs: number }[] = [];
  const empty: string[] = [];

  for (const code of codes) {
    const count = num(form.get(`count__${code}`));
    const value = num(form.get(`value__${code}`));
    if (count || value) rows.push({ report_id: reportId, loan_code: code, count, value_tzs: value });
    else empty.push(code);
  }

  if (rows.length) {
    const { error } = await gate.supabase
      .from('station_report_loans' as never)
      .upsert(rows as never, { onConflict: 'report_id,loan_code' });
    if (error) return { ok: false, message: error.message };
  }

  if (empty.length) {
    const { error } = await gate.supabase
      .from('station_report_loans' as never)
      .delete()
      .eq('report_id', reportId)
      .in('loan_code', empty);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath(`/[locale]/staff/stations/${stationId}`, 'page');
  return {
    ok: true,
    message: rows.length
      ? `Saved the split across ${rows.length} loan ${rows.length === 1 ? 'type' : 'types'}.`
      : 'Cleared the loan breakdown for this month.',
  };
}
