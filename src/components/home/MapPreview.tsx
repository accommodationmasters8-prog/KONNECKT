import Link from 'next/link';
import { TanzaniaMap } from '../map/TanzaniaMap';
import { SectionHead } from './SectionHead';
import { zoneFigures } from '@/lib/zone-data';
import { regionCentre } from '@/lib/tanzania-map';
import { getPublicStationPins } from '@/lib/tracker';
import { nationalStats } from '@/lib/seed';
import { plural } from '@/i18n';
import type { Dictionary, Locale } from '@/i18n';
import styles from './MapPreview.module.css';

/**
 * The map, as a landing-page highlight.
 *
 * Real boundaries, a pin on every zone the network reaches, the four national
 * totals, and a route into the full map page. The landing page shows; the map
 * page explains.
 *
 * The pins are the stations actually being tracked, drawn at the centre of
 * the region the register places each in. Not one record carries a coordinate
 * (§3.2.5), so a pin at a street address would be the map's first false
 * claim; stations sharing a region share a pin, which carries the count. When
 * branches start dropping real points, the same layer takes those instead.
 */
export async function MapPreview({ locale, t }: { locale: Locale; t: Dictionary }) {
  const nf = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ');
  const top = zoneFigures;

  // Real stations, placed at the centre of the region the register puts them
  // in. Several stations in one region collapse to one pin carrying the count,
  // which is the honest drawing: the register has no street coordinates, so
  // eight pins scattered around Dodoma would be eight fictions.
  const stations = await getPublicStationPins();
  const byRegion = new Map<string, { x: number; y: number; count: number }>();
  for (const station of stations) {
    const centre = regionCentre(station.region_name);
    if (!centre) continue;
    const key = `${centre.x.toFixed(1)},${centre.y.toFixed(1)}`;
    const seen = byRegion.get(key);
    if (seen) seen.count += 1;
    else byRegion.set(key, { ...centre, count: 1 });
  }

  const pins = [...byRegion.entries()].map(([key, pin]) => ({
    id: key,
    x: pin.x,
    y: pin.y,
    label: `${pin.count} tracked`,
    count: pin.count,
  }));

  const totals = [
    { value: nationalStats.branches, label: t.map.totalBranches },
    { value: nationalStats.institutions, label: t.map.totalInstitutions },
    { value: nationalStats.barracks, label: t.map.totalBarracks },
    { value: nationalStats.zones, label: t.map.totalZones },
  ];

  return (
    <section className={`section ${styles.section}`} aria-labelledby="map-title">
      <div className="shell">
        <SectionHead
          id="map-title"
          eyebrow={t.map.eyebrow}
          accent="pink"
          title={t.map.title}
          lead={t.map.lead}
          action={{ href: `/${locale}/map`, label: t.common.seeAll }}
          marker={<span className="tri tri--place" aria-hidden="true" />}
        />

        <div className={styles.split}>
          <TanzaniaMap
            data={zoneFigures.map((z) => ({
              zone: z.key,
              label: z.label,
              campuses: z.campuses,
              regions: z.regions.length,
            }))}
            title={t.pages.map.densityNote}
            className={styles.map}
            pins={pins}
          />

          <div className={styles.side}>
            <ul className={styles.zones}>
              {top.map((z) => (
                <li key={z.key} className={styles.zone}>
                  <span className={styles.zoneName}>{z.label}</span>
                  <span className={`t-data ${styles.zoneValue}`}>{nf.format(z.campuses)}</span>
                  <span className={styles.zoneUnit}>
                    {plural(locale, z.campuses, t.map.institutionsUnit)}
                  </span>
                </li>
              ))}
            </ul>

            <Link href={`/${locale}/map`} prefetch={false} className={`btn btn--quiet ${styles.sideAction}`}>
              {t.common.seeAll}
            </Link>
          </div>
        </div>

        <dl className={styles.totals}>
          {totals.map((item) => (
            <div key={item.label} className={styles.total}>
              <dd className={`t-data ${styles.totalValue}`}>{nf.format(item.value)}</dd>
              <dt className={styles.totalLabel}>{item.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
