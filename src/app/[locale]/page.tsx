import { AppShell } from '@/components/shell/AppShell';
import { Hero } from '@/components/home/Hero';
import { MapPreview } from '@/components/home/MapPreview';
import { SiteFooter } from '@/components/SiteFooter';
import { ProgressiveEnhancement } from '@/components/ProgressiveEnhancement';
import { localeParams, resolveLocale } from '@/lib/page';

export function generateStaticParams() {
  return localeParams();
}

/**
 * The front door, and nothing more.
 *
 * The mark, where the network reaches, who is behind it, and a way in. It was
 * a scroll of six sections selling a membership; the product turned out to be
 * something else, and a landing page that keeps advertising the old one is a
 * landing page that lies.
 */
export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);

  return (
    <AppShell locale={locale} t={t} active="home">
      <Hero locale={locale} t={t} />
      <MapPreview locale={locale} t={t} />
      <SiteFooter locale={locale} t={t} />
      <ProgressiveEnhancement t={t} />
    </AppShell>
  );
}
