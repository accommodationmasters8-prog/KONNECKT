import { notFound } from 'next/navigation';
import { StubPage } from '@/components/StubPage';
import { isLocale, locales } from '@/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata = { title: 'Privacy policy — CRDB Konekt' };

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
      title={{ en: 'Privacy policy', sw: 'Sera ya faragha' }}
      body={{
        en: 'This policy is being drafted with CRDB Legal and has to be approved in English and Kiswahili before it is published. Until then, nothing on this site collects personal data — there is no form, no account and no tracking here.',
        sw: 'Sera hii inaandaliwa pamoja na Idara ya Sheria ya CRDB na lazima iidhinishwe kwa Kiingereza na Kiswahili kabla ya kuchapishwa. Hadi wakati huo, hakuna kinachokusanya taarifa binafsi katika tovuti hii — hakuna fomu, hakuna akaunti, wala hakuna ufuatiliaji.',
      }}
    />
  );
}
