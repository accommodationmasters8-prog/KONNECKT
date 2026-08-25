'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';
import { locales } from '@/i18n';
import type { SettingKind } from '@/lib/admin/settings';

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Parse one submitted field into the jsonb the column holds.
 *
 * Booleans come back from a checkbox as present-or-absent, numbers as strings,
 * and a localised value as one field per locale. Anything that does not parse
 * is rejected rather than coerced — a number field that silently stores NaN is
 * a figure on the live site that nobody can explain later.
 */
function parseValue(
  form: FormData,
  key: string,
  kind: SettingKind,
  localised: boolean,
): { value: unknown } | { error: string } {
  if (kind === 'boolean') return { value: form.get(key) === 'on' };

  if (localised) {
    const value: Record<string, string> = {};
    for (const locale of locales) {
      const raw = form.get(`${key}:${locale}`);
      value[locale] = typeof raw === 'string' ? raw.trim() : '';
    }
    return { value };
  }

  const raw = form.get(key);
  const text = typeof raw === 'string' ? raw.trim() : '';

  if (kind === 'number') {
    if (text === '') return { value: null };
    const n = Number(text);
    if (!Number.isFinite(n)) return { error: `${key} is not a number.` };
    return { value: n };
  }

  if (kind === 'url' && text !== '' && !/^https?:\/\//i.test(text)) {
    return { error: `${key} must start with http:// or https://` };
  }

  if (kind === 'email' && text !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) {
    return { error: `${key} is not an email address.` };
  }

  return { value: text };
}

/**
 * Save the settings screen.
 *
 * Authorisation is the database's: the upsert runs under the signed-in user's
 * session and `settings_hq_write` rejects anyone who is not HQ. The check here
 * is so a zone manager gets a sentence instead of a Postgres error, not so
 * that the write is safe — it would be safe without it.
 */
export async function saveSettings(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const supabase = await getServerClient();
  if (!supabase) {
    return { ok: false, message: 'No database is attached to this deployment.' };
  }

  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false, message: 'Sign in first.' };
  if (session.role !== 'hq') {
    return { ok: false, message: 'Only an HQ administrator can change site settings.' };
  }

  // The catalogue decides what may be written. A field posted that is not in
  // it is ignored, so an extra input in the page's HTML cannot create a row.
  const { data: catalogue } = await supabase
    .from('site_setting_keys' as never)
    .select('key, kind, is_localised');

  const keys = (catalogue as unknown as
    { key: string; kind: SettingKind; is_localised: boolean }[]) ?? [];

  const rows: { key: string; value: unknown; updated_by: string | null }[] = [];

  for (const entry of keys) {
    // Only the fields that were actually submitted. The screen posts one group
    // at a time, and a missing field must not blank a value in another group.
    const present = entry.kind === 'boolean'
      ? form.has(`${entry.key}:submitted`)
      : entry.is_localised
        ? locales.some((l) => form.has(`${entry.key}:${l}`))
        : form.has(entry.key);

    if (!present) continue;

    const parsed = parseValue(form, entry.key, entry.kind, entry.is_localised);
    if ('error' in parsed) return { ok: false, message: parsed.error };

    rows.push({ key: entry.key, value: parsed.value, updated_by: session.staffId });
  }

  if (rows.length === 0) return { ok: false, message: 'Nothing to save.' };

  const { error } = await supabase
    .from('site_settings' as never)
    .upsert(rows as never, { onConflict: 'key' });

  if (error) return { ok: false, message: error.message };

  // The public pages read these, so their cached renders are now stale.
  revalidatePath('/', 'layout');

  return { ok: true, message: `Saved ${rows.length} setting${rows.length === 1 ? '' : 's'}.` };
}
