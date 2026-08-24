import { notFound } from 'next/navigation';
import { StubPage } from '@/components/StubPage';
import { isLocale, locales } from '@/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata = { title: 'Accessibility — CRDB Konekt' };

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <StubPage
      locale={locale}
      title={{ en: 'Accessibility', sw: 'Ufikivu' }}
      body={{
        en: 'Konekt is built to WCAG 2.1 AA and tested on mid-range Android phones on slow connections. If something here does not work for you, we want to hear about it — the contact route opens with the next release.',
        sw: 'Konekt imejengwa kwa kiwango cha WCAG 2.1 AA na inajaribiwa kwenye simu za Android za bei ya kati zenye mtandao wa polepole. Kama kuna kisichokufanyia kazi hapa, tunataka kujua — njia ya mawasiliano itafunguliwa katika toleo lijalo.',
      }}
    />
  );
}
