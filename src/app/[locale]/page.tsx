import { AppShell } from '@/components/shell/AppShell';
import { Hero } from '@/components/home/Hero';
import { PartnerStrip } from '@/components/home/PartnerStrip';
import { EventsPreview } from '@/components/home/EventsPreview';
import { MapPreview } from '@/components/home/MapPreview';
import { MembershipTiers } from '@/components/home/MembershipTiers';
import { OpportunitiesStrip } from '@/components/home/OpportunitiesStrip';
import { SiteFooter } from '@/components/SiteFooter';
import { ProgressiveEnhancement } from '@/components/ProgressiveEnhancement';
import { getLandingPlacements } from '@/lib/partners';
import { localeParams, resolveLocale } from '@/lib/page';

export function generateStaticParams() {
  return localeParams();
}

/**
 * The landing page is a highlight reel, not the product.
 *
 * Each block shows enough to be worth tapping and routes to a full page that
 * does the job properly. That split is what stops the home page becoming a
 * scroll of everything, and it is what makes the tab bar mean something.
 */
export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  // Uploaded partners when an administrator has added any; the committed
  // indicative list until then.
  const placements = await getLandingPlacements();

  return (
    <AppShell locale={locale} t={t} active="home">
      <Hero locale={locale} t={t} />
      <PartnerStrip t={t} placements={placements} />
      <EventsPreview locale={locale} t={t} />
      <MapPreview locale={locale} t={t} />
      <MembershipTiers locale={locale} t={t} />
      <OpportunitiesStrip locale={locale} t={t} />
      <SiteFooter locale={locale} t={t} />
      <ProgressiveEnhancement t={t} />
    </AppShell>
  );
}
