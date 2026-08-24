import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { SiteFooter } from '@/components/SiteFooter';
import { PageHeader } from '@/components/ui/PageHeader';
import { MembershipTiers } from '@/components/home/MembershipTiers';
import { PartnerStrip } from '@/components/home/PartnerStrip';
import { INDICATIVE_PARTNERS } from '@/lib/partners';
import { localeParams, resolveLocale } from '@/lib/page';
import { getDictionary, isLocale } from '@/i18n';

export function generateStaticParams() {
  return localeParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: `${t.pages.membership.title} — CRDB Konekt`,
    description: t.pages.membership.lead,
  };
}

export default async function MembershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);

  return (
    <AppShell locale={locale} t={t} active="membership">
      <PageHeader
        eyebrow={t.membership.eyebrow}
        title={t.pages.membership.title}
        lead={t.pages.membership.lead}
      />
      <MembershipTiers locale={locale} t={t} />
      <PartnerStrip t={t} placements={INDICATIVE_PARTNERS} />
      <SiteFooter locale={locale} t={t} />
    </AppShell>
  );
}
