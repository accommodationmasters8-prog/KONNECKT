import { getServerClient } from '@/lib/supabase/server';
import type { Locale } from '@/i18n';

/**
 * Admin-editable settings.
 *
 * `konekt.site_setting_keys` is the catalogue — what the console offers to
 * edit, in what order, with what input. `konekt.site_settings` holds the
 * values. Both are public-read, because the values *are* the copy on the
 * page, and HQ-write, because changing them changes what every visitor sees.
 *
 * Every read here degrades to the caller's own default when there is no
 * project attached, which is what keeps the public site rendering on a fresh
 * clone: a missing settings table means the committed copy is used, not an
 * empty page.
 */

export type SettingKind =
  | 'text' | 'long_text' | 'url' | 'email' | 'phone' | 'boolean' | 'number';

export interface SettingKey {
  key: string;
  label: string;
  help: string | null;
  kind: SettingKind;
  is_localised: boolean;
  group_name: string;
  display_order: number;
}

export type SettingValue = string | number | boolean | Record<string, string> | null;

export interface SettingsSnapshot {
  /** Empty when no project is attached — callers fall back to committed copy. */
  values: Record<string, SettingValue>;
  configured: boolean;
}

export async function getSettings(): Promise<SettingsSnapshot> {
  const supabase = await getServerClient();
  if (!supabase) return { values: {}, configured: false };

  const { data, error } = await supabase
    .from('site_settings' as never)
    .select('key, value');

  if (error || !data) return { values: {}, configured: true };

  const values: Record<string, SettingValue> = {};
  for (const row of data as unknown as { key: string; value: SettingValue }[]) {
    values[row.key] = row.value;
  }
  return { values, configured: true };
}

export async function getSettingCatalogue(): Promise<SettingKey[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from('site_setting_keys' as never)
    .select('key, label, help, kind, is_localised, group_name, display_order')
    .order('group_name', { ascending: true })
    .order('display_order', { ascending: true });

  return (data as unknown as SettingKey[]) ?? [];
}

/**
 * One setting, resolved for a locale, with the committed copy as the fallback.
 *
 * The fallback is required rather than optional on purpose: a settings lookup
 * that can return undefined ends up rendering an empty heading the first time
 * someone forgets to seed a row.
 */
export function readSetting(
  snapshot: SettingsSnapshot,
  key: string,
  locale: Locale,
  fallback: string,
): string {
  const value = snapshot.values[key];
  if (value == null) return fallback;
  if (typeof value === 'string') return value || fallback;
  if (typeof value === 'object') {
    const localised = (value as Record<string, string>)[locale];
    return localised || fallback;
  }
  return String(value);
}

export function readFlag(
  snapshot: SettingsSnapshot,
  key: string,
  fallback: boolean,
): boolean {
  const value = snapshot.values[key];
  return typeof value === 'boolean' ? value : fallback;
}
