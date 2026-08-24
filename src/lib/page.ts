import { notFound } from 'next/navigation';
import { getDictionary, isLocale, locales, type Locale } from '@/i18n';

/** Every route resolves its locale the same way. */
export async function resolveLocale(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const typed: Locale = locale;
  return { locale: typed, t: getDictionary(typed) };
}

export function localeParams() {
  return locales.map((locale) => ({ locale }));
}
