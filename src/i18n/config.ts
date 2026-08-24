export const locales = ['en', 'sw'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  sw: 'Kiswahili',
};

/** BCP-47 tags for <html lang> and hreflang. */
export const localeTags: Record<Locale, string> = {
  en: 'en-TZ',
  sw: 'sw-TZ',
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
