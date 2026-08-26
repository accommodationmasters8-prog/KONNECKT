import Link from 'next/link';
import { TanzaniaMap } from '../map/TanzaniaMap';
import { SectionHead } from './SectionHead';
import { zoneFigures } from '@/lib/zone-data';
import { ZONE_ANCHORS } from '@/lib/tanzania-map';
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
 * The pins sit at each zone's area-weighted centroid rather than at any one
 * branch, because not one record in the register carries a coordinate (§3.2.5)
 * — a pin drawn at a guessed address would be the map's first false claim.
 * When branches start dropping real points on their stations, the same pin
 * layer takes those instead.
 */
export function MapPreview({ locale, t }: { locale: Locale; t: Dictionary }) {
  const nf = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ');
  const top = zoneFigures;

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
            pins={zoneFigures.map((z) => ({
              id: z.key,
              x: ZONE_ANCHORS[z.key].x,
              y: ZONE_ANCHORS[z.key].y,
              label: z.label,
              count: z.campuses,
            }))}
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
