import { notFound } from 'next/navigation';
import { StubPage } from '@/components/StubPage';
import { isLocale, locales } from '@/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata = { title: 'Terms of use — CRDB Konekt' };

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
      title={{ en: 'Terms of use', sw: 'Masharti ya matumizi' }}
      body={{
        en: 'The terms are with CRDB Legal for approval in both languages. They will be published here, and separately from any marketing consent, before registration opens.',
        sw: 'Masharti yapo kwa Idara ya Sheria ya CRDB kwa idhini katika lugha zote mbili. Yatachapishwa hapa, na kwa kutenganishwa na idhini yoyote ya masoko, kabla usajili haujafunguliwa.',
      }}
    />
  );
}
