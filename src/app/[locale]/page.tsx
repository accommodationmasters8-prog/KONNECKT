import { getDictionary, isLocale, type Locale } from '@/i18n';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Hero } from '@/components/Hero';
import { EventsPreview } from '@/components/EventsPreview';
import { ZoneMapTeaser } from '@/components/ZoneMapTeaser';
import { MembershipTiers } from '@/components/MembershipTiers';
import { OpportunitiesStrip } from '@/components/OpportunitiesStrip';
import { SiteFooter } from '@/components/SiteFooter';
import { ProgressiveEnhancement } from '@/components/ProgressiveEnhancement';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const typed: Locale = locale;
  const t = getDictionary(typed);

  return (
    <>
      <a href="#main" className="skip-link">
        {t.nav.skipToContent}
      </a>

      <SiteHeader locale={typed} t={t} />

      <main id="main">
        <Hero locale={typed} t={t} />
        <EventsPreview locale={typed} t={t} />
        <ZoneMapTeaser locale={typed} t={t} />
        <MembershipTiers t={t} />
        <OpportunitiesStrip t={t} />
      </main>

      <SiteFooter locale={typed} t={t} />

      <ProgressiveEnhancement t={t} />
    </>
  );
}
