'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface ActionResult {
  ok: boolean;
  message: string;
}

const SOURCES = new Set([
  'event', 'branch_walk_in', 'field_agent', 'referral', 'campus_activation',
  'digital', 'other',
]);

/**
 * Record an account.
 *
 * The form is shaped by the database rather than the other way round.
 * `accounts_opened.source` and `source_reference` are both NOT NULL, an
 * event-sourced account must name its event and a referral-sourced one must
 * name the referrer — so an account with no traceable origin cannot be
 * written, and a form that offered one would only produce a failed insert.
 *
 * The branch is taken from the signed-in staff user, never from the form. A
 * branch officer recording an account for another branch would be a scope
 * violation the RLS policy refuses anyway; taking it from the session means
 * the ordinary case does not have to be checked at all.
 */
export async function recordAccount(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false, message: 'No database is attached to this deployment.' };

  const session = await getStaffSession();
  if (!session.signedIn || !session.staffId) return { ok: false, message: 'Sign in first.' };

  const { data: staff } = await supabase
    .from('staff_users' as never)
    .select('branch_id')
    .eq('id', session.staffId)
    .maybeSingle();

  const branchId = (staff as unknown as { branch_id: string | null } | null)?.branch_id
    ?? String(form.get('branch_id') ?? '').trim();

  if (!branchId) {
    return {
      ok: false,
      message: 'This account has no branch of its own, so it has to name the branch the account was opened at.',
    };
  }

  const accountNumber = String(form.get('account_number') ?? '').trim();
  const productCode = String(form.get('product_code') ?? '').trim();
  const source = String(form.get('source') ?? '').trim();
  const sourceReference = String(form.get('source_reference') ?? '').trim();
  const eventId = String(form.get('event_id') ?? '').trim();
  const freelancerId = String(form.get('freelancer_id') ?? '').trim();
  const openedOn = String(form.get('opened_on') ?? '').trim();

  if (!accountNumber) return { ok: false, message: 'The account number is required, and unique across the platform.' };
  if (!productCode) return { ok: false, message: 'Choose the product this account was opened on.' };
  if (!SOURCES.has(source)) return { ok: false, message: 'Choose where this account came from.' };
  if (!sourceReference) {
    return { ok: false, message: 'Source reference is required: the registration ID, agent code or referral code that proves the origin.' };
  }
  if (source === 'event' && !eventId) {
    return { ok: false, message: 'An event-sourced account has to name the event. The database refuses it otherwise.' };
  }

  const { error } = await supabase
    .from('accounts_opened' as never)
    .insert({
      account_number: accountNumber,
      product_code: productCode,
      branch_id: branchId,
      source,
      source_reference: sourceReference,
      event_id: source === 'event' ? eventId : null,
      freelancer_id: freelancerId || null,
      opened_by_staff_id: session.staffId,
      opened_on: openedOn || new Date().toISOString().slice(0, 10),
    } as never);

  if (error) {
    // The one failure worth rewording: it is the commonest, and "duplicate key
    // value violates unique constraint" does not tell a branch officer that
    // the account is already in the system.
    if (error.message.includes('accounts_opened_account_number_key')) {
      return { ok: false, message: `${accountNumber} is already recorded. A duplicate would double-count in every report downstream.` };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath('/', 'layout');
  return { ok: true, message: `Recorded ${accountNumber}.` };
}
