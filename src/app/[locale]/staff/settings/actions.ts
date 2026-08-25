'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** A code somebody can type: lowercase, underscores, nothing exotic. */
function slug(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

type Kind = 'account' | 'loan';

const TABLE: Record<Kind, string> = {
  account: 'account_products',
  loan: 'loan_products',
};

async function hqOnly() {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false as const, message: 'No database is attached.' };
  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false as const, message: 'Sign in first.' };
  if (session.role !== 'hq') {
    return { ok: false as const, message: 'Only HQ maintains these lists.' };
  }
  return { ok: true as const, supabase, session };
}

/**
 * Add an account type or a loan type.
 *
 * The code is derived from the name rather than asked for. It is what every
 * historic row is keyed on, so it must never change once anything references
 * it — and a field somebody can edit is a field somebody edits.
 */
export async function addProduct(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const kind = String(form.get('kind') ?? '') as Kind;
  if (kind !== 'account' && kind !== 'loan') return { ok: false, message: 'Which list?' };

  const labelEn = String(form.get('label_en') ?? '').trim();
  const labelSw = String(form.get('label_sw') ?? '').trim() || labelEn;
  if (labelEn.length < 2) return { ok: false, message: 'Give it a name.' };

  const code = slug(labelEn);
  if (!code) return { ok: false, message: 'That name has no letters or digits in it.' };

  const { error } = await gate.supabase
    .from(TABLE[kind] as never)
    .insert({
      code,
      label_en: labelEn,
      label_sw: labelSw,
      is_active: true,
      display_order: 99,
      created_by: gate.session.staffId,
    } as never);

  if (error) {
    return {
      ok: false,
      message: error.message.includes('duplicate key')
        ? `There is already a type coded "${code}".`
        : error.message,
    };
  }

  revalidatePath('/[locale]/staff/settings', 'page');
  return { ok: true, message: `Added ${labelEn}.` };
}

/**
 * Retire a type, or bring it back.
 *
 * Never a delete. Months already filed reference the code, and removing the
 * row would leave those figures labelled with a code and nothing else.
 * Retiring takes it off the entry form and leaves the history readable.
 */
export async function setProductActive(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const kind = String(form.get('kind') ?? '') as Kind;
  if (kind !== 'account' && kind !== 'loan') return { ok: false, message: 'Which list?' };

  const code = String(form.get('code') ?? '').trim();
  const active = String(form.get('active') ?? '') === 'true';
  if (!code) return { ok: false, message: 'Which type?' };

  const { error } = await gate.supabase
    .from(TABLE[kind] as never)
    .update({ is_active: active } as never)
    .eq('code', code);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/[locale]/staff/settings', 'page');
  return { ok: true, message: active ? 'Back in use.' : 'Retired.' };
}

/**
 * Put a branch in a zone.
 *
 * The CRDB register carries no zone for any branch — §3.2.6 — so this is not a
 * correction to imported data, it is the only place the fact is ever recorded.
 * Until a branch has one, a zone manager cannot reach it and neither can any
 * station reporting through it: `stations.zone_code` is copied from the branch
 * by trigger, and `staff_can_reach` compares against exactly that.
 *
 * Which makes this screen load-bearing rather than administrative. A branch
 * left unzoned is invisible to everyone except HQ and the branch itself.
 */
export async function setBranchZone(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const id = String(form.get('branch_id') ?? '').trim();
  const raw = String(form.get('zone_code') ?? '').trim();
  if (!id) return { ok: false, message: 'Which branch?' };

  const { error } = await gate.supabase
    .from('branches' as never)
    .update({ zone_code: raw === '' ? null : raw } as never)
    .eq('id', id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/[locale]/staff/settings', 'page');
  return {
    ok: true,
    message: raw === '' ? 'Zone cleared.' : 'Saved.',
  };
}
