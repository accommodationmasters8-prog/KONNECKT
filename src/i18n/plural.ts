import type { Locale } from './config';
import type { PluralUnit } from './types';

/**
 * Picks the right form of a counted noun.
 *
 * English and Swahili both have a two-form one/other system, so Intl's plural
 * rules resolve both correctly. Swahili is not in every ICU build though, and
 * an unknown locale silently falls back to `other` in Intl — which would print
 * "vyuo 1". The explicit n === 1 check makes the fallback correct rather than
 * merely quiet.
 */
export function plural(locale: Locale, count: number, unit: PluralUnit): string {
  try {
    const rule = new Intl.PluralRules(locale === 'sw' ? 'sw-TZ' : 'en-TZ').select(count);
    return rule === 'one' ? unit.one : unit.other;
  } catch {
    return count === 1 ? unit.one : unit.other;
  }
}
