import { zoneStats, nationalStats, zoneLabel, type Zone } from '@/lib/seed';
import { plural } from '@/i18n';
import type { Dictionary, Locale } from '@/i18n';
import styles from './ZoneMapTeaser.module.css';

/**
 * The map teaser.
 *
 * A schematic of the eight CRDB zones, laid out in roughly their national
 * arrangement, carrying the real counts from the seed register. Not
 * interactive — there are no coordinates in any of the supplied files, so
 * there is nothing to plot yet (§3.2.5).
 *
 * It is deliberately a schematic rather than a drawn coastline. An
 * approximated outline of Tanzania in front of CRDB would invite exactly the
 * argument the geocoding rule exists to prevent. The numbers are the pitch;
 * they are real, and every one of them is traceable to the register.
 */

/** Rough national arrangement, as a 3-column schematic. */
const LAYOUT: Array<{ zone: Zone; column: number; row: number }> = [
  { zone: 'LAKE ZONE', column: 1, row: 1 },
  { zone: 'NORTHERN ZONE', column: 2, row: 1 },
  { zone: 'COASTAL ZONE', column: 3, row: 1 },
  { zone: 'WESTERN ZONE', column: 1, row: 2 },
  { zone: 'CENTRAL ZONE', column: 2, row: 2 },
  { zone: 'DAR ES SALAAM ZONE', column: 3, row: 2 },
  { zone: 'HIGHLAND ZONE', column: 1, row: 3 },
  { zone: 'SOUTHERN ZONE', column: 2, row: 3 },
];

export function ZoneMapTeaser({ locale, t }: { locale: Locale; t: Dictionary }) {
  const nf = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ');
  const byZone = new Map(zoneStats.map((s) => [s.zone, s]));

  // The zone carrying the most campuses sets the scale for the fill weight,
  // so tile emphasis is driven by the data rather than chosen by hand.
  const peak = Math.max(...zoneStats.map((s) => s.institutions));

  const totals = [
    { value: nationalStats.branches, label: t.map.totalBranches },
    { value: nationalStats.institutions, label: t.map.totalInstitutions },
    { value: nationalStats.barracks, label: t.map.totalBarracks },
    { value: nationalStats.zones, label: t.map.totalZones },
  ];

  return (
    <section
      id="map"
      className={`section on-ink ${styles.section} chev-edge-top`}
      aria-labelledby="map-title"
    >
      <div className="shell">
        <div className="reveal-head">
          <p className="t-eyebrow" style={{ color: 'var(--konekt-pink)' }}>
            <span className="tri tri--place" aria-hidden="true" />
            {t.map.eyebrow}
          </p>
          <h2 id="map-title" className={`t-h2 ${styles.title}`}>
            {t.map.title}
          </h2>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelCopy}>
            <p className={`t-lead ${styles.lead}`}>{t.map.lead}</p>
            <p className={`t-caption ${styles.notePending}`}>
              <span className="tri tri--live" aria-hidden="true" />
              {t.map.pendingNote}
            </p>
          </div>

          <ul className={styles.grid} aria-describedby="map-source">
            {LAYOUT.map(({ zone, column, row }) => {
              const stat = byZone.get(zone);
              if (!stat) return null;
              return (
                <li
                  key={zone}
                  className={styles.tile}
                  style={
                    {
                      gridColumn: column,
                      gridRow: row,
                      '--tile-weight': (stat.institutions / peak).toFixed(3),
                    } as React.CSSProperties
                  }
                >
                  <span className={styles.tileName}>{zoneLabel(zone)}</span>
                  <span className={`t-data ${styles.tileValue}`}>
                    {nf.format(stat.institutions)}
                  </span>
                  <span className={styles.tileUnit}>
                    {plural(locale, stat.institutions, t.map.institutionsUnit)}
                  </span>
                  <span className={styles.tileRegions}>
                    {nf.format(stat.regions)}{' '}
                    {plural(locale, stat.regions, t.map.regionsUnit)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <dl className={styles.totals}>
          {totals.map((item) => (
            <div key={item.label} className={styles.total}>
              <dd className={`t-data ${styles.totalValue}`}>{nf.format(item.value)}</dd>
              <dt className={styles.totalLabel}>{item.label}</dt>
            </div>
          ))}
        </dl>

        <div className={styles.notes}>
          <p id="map-source" className={`t-caption ${styles.note}`}>
            {t.map.sourceNote}
          </p>
          <p className={`t-micro ${styles.noteFuture}`}>{t.map.ctaMap}</p>
        </div>
      </div>
    </section>
  );
}
