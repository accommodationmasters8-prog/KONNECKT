'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Register a freelancer, or change one.
 *
 * A freelancer belongs to a branch — not because of a screen, but because
 * `konekt.freelancers.branch_id` is NOT NULL and row level security scopes
 * every read and write through it. A branch officer can only ever see, create
 * or change their own branch's; a zone manager sees the zone; HQ sees all.
 * The zone column follows the branch by trigger, so it cannot drift.
 *
 * They are not staff. There is no console role here, no scope over anyone
 * else's data, and no access to member records — only their own production.
 */
export async function saveFreelancer(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false, message: 'No database is attached to this deployment.' };

  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false, message: 'Sign in first.' };

  const id = String(form.get('id') ?? '').trim();
  const fullName = String(form.get('full_name') ?? '').trim();
  const phone = String(form.get('phone_e164') ?? '').trim().replace(/\s+/g, '');
  const branchId = String(form.get('branch_id') ?? '').trim();
  const status = String(form.get('status') ?? 'pending');
  const commission = String(form.get('commission_tzs_per_account') ?? '').trim();

  if (!fullName) return { ok: false, message: 'A freelancer needs a name.' };
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
    return { ok: false, message: 'The phone must be in international form, like +255712345678. It is how they are identified, and the database checks it.' };
  }
  if (!id && !branchId) {
    return { ok: false, message: 'Choose the branch that will answer for this freelancer.' };
  }
  if (!['pending', 'active', 'suspended', 'ended'].includes(status)) {
    return { ok: false, message: 'Unknown status.' };
  }

  const row: Record<string, unknown> = {
    full_name: fullName,
    phone_e164: phone,
    email: String(form.get('email') ?? '').trim() || null,
    status,
    commission_tzs_per_account: commission === '' ? null : Number(commission),
    notes: String(form.get('notes') ?? '').trim() || null,
  };

  // `active_freelancer_has_been_activated` requires the timestamp, and the
  // date someone started earning commission is a fact worth keeping.
  if (status === 'active') row.activated_at = new Date().toISOString();
  if (status === 'suspended') row.suspended_at = new Date().toISOString();

  if (id) {
    const { error } = await supabase
      .from('freelancers' as never)
      .update(row as never)
      .eq('id', id);
    if (error) return { ok: false, message: error.message };
    revalidatePath('/', 'layout');
    return { ok: true, message: `Updated ${fullName}.` };
  }

  const { error } = await supabase
    .from('freelancers' as never)
    .insert({
      ...row,
      branch_id: branchId,
      registered_by: session.staffId,
    } as never);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: `Registered ${fullName}. They start as pending until the branch activates them.` };
}
