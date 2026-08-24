import en from './en';
import sw from './sw';
import type { Locale } from './config';
import type { Dictionary } from './types';

const dictionaries: Record<Locale, Dictionary> = { en, sw };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary, TierKey, TierCopy, PluralUnit } from './types';
export { plural } from './plural';
export * from './config';
