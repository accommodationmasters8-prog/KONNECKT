import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { SiteFooter } from '@/components/SiteFooter';
import { TanzaniaMap } from '@/components/map/TanzaniaMap';
import { zoneFigures } from '@/lib/zone-data';
import { regionCentre } from '@/lib/tanzania-map';
import { getPublicStationPins } from '@/lib/tracker';
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
 * zones, with a pin on every region that has a station in it. Below the map,
 * the stations themselves by region — a shaded map is a picture, and a picture
 * is not a number anybody can act on.
 *
 * The pins and the region table come from the database, not the committed
 * register: this page has to show what has actually been added, or the whole
 * point of centralising the updates is lost the first time a branch adds a
 * station and the public map keeps showing last year's list.
 *
 * The register still supplies the boundaries and the zone grouping, because
 * those are geography and do not change when somebody files a report.
 */
export default async function MapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  const nf = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ');

  // Live. When nothing is attached this is empty and the page falls back to
  // the register's own counts rather than showing zero, which would read as a
  // measurement rather than as an absent connection.
  const stations = await getPublicStationPins();

  const byRegion = new Map<string, { x: number; y: number; count: number; names: string[] }>();
  const byCategory = new Map<string, number>();

  for (const station of stations) {
    byCategory.set(station.category_name, (byCategory.get(station.category_name) ?? 0) + 1);

    const centre = regionCentre(station.region_name);
    if (!centre) continue;
    const key = station.region_name ?? 'unknown';
    const seen = byRegion.get(key);
    if (seen) {
      seen.count += 1;
      seen.names.push(station.name);
    } else {
      byRegion.set(key, { ...centre, count: 1, names: [station.name] });
    }
  }

  const pins = [...byRegion.entries()].map(([region, pin]) => ({
    id: region, x: pin.x, y: pin.y, label: region, count: pin.count,
  }));

  const regionRows = [...byRegion.entries()]
    .map(([region, pin]) => ({ region, count: pin.count, names: pin.names.sort() }))
    .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region));

  const totals = [
    { value: nationalStats.branches, label: t.map.totalBranches },
    {
      value: stations.length || nationalStats.stations,
      label: t.map.totalStations,
    },
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
            pins={pins}
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
          {regionRows.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className={styles.caption}>
                  {t.pages.map.liveCaption}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t.pages.map.colRegion}</th>
                    <th scope="col" className={styles.num}>{t.pages.map.colStations}</th>
                    <th scope="col">{t.pages.map.colWhich}</th>
                  </tr>
                </thead>
                <tbody>
                  {regionRows.map((row) => (
                    <tr key={row.region}>
                      <th scope="row">{row.region}</th>
                      <td className={styles.num}>{nf.format(row.count)}</td>
                      <td className={styles.regionList}>{row.names.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.caption}>{t.pages.map.tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.pages.map.colZone}</th>
                  <th scope="col" className={styles.num}>{t.pages.map.colStations}</th>
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
