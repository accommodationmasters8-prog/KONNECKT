'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Add or update an account type.
 *
 * These were an enum until migration 0009, which meant adding a product was a
 * migration, a deploy, and a gap in between where a branch could not record
 * what it had actually opened. HQ maintains them here instead.
 *
 * There is no delete. An account opened last year still names the product it
 * was opened on, and deleting the row would either fail on the foreign key or
 * rewrite history — so a product that is no longer sold is deactivated, and
 * stops appearing at the counter while its records keep their meaning.
 */
export async function saveProduct(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false, message: 'No database is attached to this deployment.' };

  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false, message: 'Sign in first.' };
  if (session.role !== 'hq') {
    return { ok: false, message: 'Account types are national. Only an HQ administrator can change them.' };
  }

  const code = String(form.get('code') ?? '').trim().toLowerCase();
  const labelEn = String(form.get('label_en') ?? '').trim();
  const labelSw = String(form.get('label_sw') ?? '').trim();
  const minAge = String(form.get('min_age') ?? '').trim();
  const maxAge = String(form.get('max_age') ?? '').trim();

  if (!/^[a-z][a-z0-9_]*$/.test(code)) {
    return { ok: false, message: 'The code is what every account record stores. Lower case, letters, digits and underscores, starting with a letter.' };
  }
  if (!labelEn || !labelSw) {
    return { ok: false, message: 'A product needs a name in both languages — it is shown at the counter and on the membership page.' };
  }

  const { error } = await supabase
    .from('account_products' as never)
    .upsert({
      code,
      label_en: labelEn,
      label_sw: labelSw,
      description_en: String(form.get('description_en') ?? '').trim() || null,
      description_sw: String(form.get('description_sw') ?? '').trim() || null,
      min_age: minAge === '' ? null : Number(minAge),
      max_age: maxAge === '' ? null : Number(maxAge),
      requires_guardian: form.get('requires_guardian') === 'on',
      is_active: form.get('is_active') === 'on',
      display_order: Number(form.get('display_order') ?? 0) || 0,
      created_by: session.staffId,
    } as never, { onConflict: 'code' });

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: `Saved ${labelEn}.` };
}
