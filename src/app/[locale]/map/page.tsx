import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { SiteFooter } from '@/components/SiteFooter';
import { TanzaniaMap } from '@/components/map/TanzaniaMap';
import { zoneFigures } from '@/lib/zone-data';
import { nationalStats } from '@/lib/seed';
import { localeParams, resolveLocale } from '@/lib/page';
import { getDictionary, isLocale } from '@/i18n';
import styles from './map.module.css';

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
  return { title: `${t.pages.map.title} — CRDB Konekt`, description: t.pages.map.lead };
}

/**
 * The map, in full.
 *
 * Real boundaries for all 30 Tanzanian regions, grouped into CRDB's eight
 * zones and shaded by campus density. Below it, the same figures as a table —
 * a shaded map is a picture, and a picture is not a number a zone manager can
 * act on.
 *
 * There are still no pins, and the page says why rather than leaving a gap.
 */
export default async function MapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  const nf = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ');

  const totals = [
    { value: nationalStats.branches, label: t.map.totalBranches },
    { value: nationalStats.institutions, label: t.map.totalInstitutions },
    { value: nationalStats.barracks, label: t.map.totalBarracks },
    { value: nationalStats.zones, label: t.map.totalZones },
  ];

  return (
    <AppShell locale={locale} t={t} active="map">
      <div className={`on-ink ${styles.hero}`}>
        <div className="shell">
          <div className="page-head">
            <p className="t-eyebrow" style={{ color: 'var(--konekt-pink)' }}>
              <span className="tri tri--place" aria-hidden="true" />
              {t.map.eyebrow}
            </p>
            <h1 className="t-h1" style={{ color: 'var(--text-on-inverse)' }}>
              {t.pages.map.title}
            </h1>
            <p className="t-lead" style={{ color: 'var(--text-muted-on-inverse)' }}>
              {t.pages.map.lead}
            </p>
          </div>

          <TanzaniaMap
            data={zoneFigures.map((z) => ({
              zone: z.key,
              label: z.label,
              campuses: z.campuses,
              regions: z.regions.length,
            }))}
            title={t.pages.map.densityNote}
            labels
            className={styles.map}
          />

          <p className={styles.legend}>{t.pages.map.legend}</p>

          <dl className={styles.totals}>
            {totals.map((item) => (
              <div key={item.label} className={styles.total}>
                <dd className={`t-data ${styles.totalValue}`}>{nf.format(item.value)}</dd>
                <dt className={styles.totalLabel}>{item.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className={`section ${styles.detail}`}>
        <div className="shell">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.caption}>{t.pages.map.tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.pages.map.colZone}</th>
                  <th scope="col" className={styles.num}>{t.pages.map.colCampuses}</th>
                  <th scope="col" className={styles.num}>{t.pages.map.colRegions}</th>
                  <th scope="col">{t.pages.map.colRegionNames}</th>
                </tr>
              </thead>
              <tbody>
                {zoneFigures.map((z) => (
                  <tr key={z.key}>
                    <th scope="row">{z.label}</th>
                    <td className={styles.num}>{nf.format(z.campuses)}</td>
                    <td className={styles.num}>{nf.format(z.regions.length)}</td>
                    <td className={styles.regionList}>{z.regions.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.notes}>
            <p className={`t-caption ${styles.note}`}>{t.pages.map.densityNote}</p>
            <p className={`t-caption ${styles.pinNote}`}>
              <span className="tri tri--live" aria-hidden="true" />
              {t.pages.map.pinNote}
            </p>
            <p className={`t-caption ${styles.note}`}>{t.map.sourceNote}</p>
          </div>
        </div>
      </div>

      <SiteFooter locale={locale} t={t} />
    </AppShell>
  );
}
