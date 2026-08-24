import { MAP_REGIONS, MAP_VIEWBOX, ZONE_ANCHORS, type ZoneKey } from '@/lib/tanzania-map';
import styles from './TanzaniaMap.module.css';

/**
 * The Tanzania zone map.
 *
 * Real geography: Natural Earth 1:10m admin-1 boundaries for all 30 regions,
 * projected and simplified at build time by scripts/geo/build-tanzania-map.mjs.
 * No map library, no tile server, no network request — about 8KB gzipped of
 * path data, which is two orders of magnitude cheaper than MapLibre and works
 * with the radio off.
 *
 * What it does NOT do is place a pin. Not one record in the CRDB register has
 * a coordinate, so there is nothing truthful to plot; regions are shaded by
 * how many campuses the register puts in that zone, which is real data about a
 * real area rather than a false claim about a point.
 */
export interface ZoneDatum {
  zone: ZoneKey;
  label: string;
  campuses: number;
  regions: number;
}

export function TanzaniaMap({
  data,
  title,
  activeZone,
  variant = 'display',
  labels = false,
  className,
}: {
  data: ZoneDatum[];
  /** Accessible name for the figure. */
  title: string;
  activeZone?: ZoneKey;
  /** `display` shades by density; `flat` gives every zone equal weight. */
  variant?: 'display' | 'flat';
  /** Draw the zone name and campus count on the map itself. */
  labels?: boolean;
  className?: string;
}) {
  const byZone = new Map(data.map((d) => [d.zone, d]));
  const peak = Math.max(1, ...data.map((d) => d.campuses));

  return (
    <figure className={[styles.figure, className].filter(Boolean).join(' ')}>
      <svg
        viewBox={MAP_VIEWBOX}
        className={styles.map}
        role="img"
        aria-label={title}
        focusable="false"
      >
        <title>{title}</title>

        {/* Regions are grouped by zone so a zone reads as one shape even
            though it is drawn from several region outlines.

            No per-path <title> here, deliberately. React 19 treats <title> as
            hoistable document metadata unless its parent is <svg>, so a
            <title> inside a <path> gets moved to the document head on the
            client and every page carrying this map fails hydration. The
            region names live in the table below the map instead, which is
            more useful than a hover tooltip on a phone anyway. */}
        {MAP_REGIONS.map((region) => {
          const datum = byZone.get(region.zone);
          // Square-rooted rather than linear: campus counts run 1..16, and a
          // linear ramp leaves everything below about six indistinguishable
          // from empty. The root spreads the low end where most zones sit.
          const share = (datum?.campuses ?? 0) / peak;
          const weight = variant === 'flat' ? 0.6 : 0.14 + Math.sqrt(share) * 0.86;
          const isActive = activeZone === region.zone;

          return (
            <path
              key={region.name}
              d={region.d}
              className={[
                styles.region,
                isActive ? styles.regionActive : '',
                activeZone && !isActive ? styles.regionDimmed : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                {
                  '--zone-weight': weight.toFixed(3),
                } as React.CSSProperties
              }
              data-zone={region.zone}
            />
          );
        })}

        {/* Labels at real area-weighted centroids, so a zone with sixteen
            campuses says sixteen rather than relying on a shade the eye has to
            compare across the country. Dar es Salaam is the case that makes
            this necessary: it is the densest zone and the smallest shape. */}
        {labels
          ? data.map((datum) => {
              const anchor = ZONE_ANCHORS[datum.zone];
              if (!anchor) return null;
              return (
                <g key={datum.zone} className={styles.label}>
                  {anchor.leader ? (
                    <line
                      x1={anchor.leader.x}
                      y1={anchor.leader.y}
                      x2={anchor.x}
                      y2={anchor.y + 4}
                      className={styles.leader}
                    />
                  ) : null}
                  <text x={anchor.x} y={anchor.y - 6} className={styles.labelCount}>
                    {datum.campuses}
                  </text>
                  <text x={anchor.x} y={anchor.y + 20} className={styles.labelName}>
                    {datum.label}
                  </text>
                </g>
              );
            })
          : null}
      </svg>
    </figure>
  );
}
