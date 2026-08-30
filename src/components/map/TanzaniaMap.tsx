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

/**
 * A pin on the map.
 *
 * Coordinates are in the map's own viewBox space, not degrees — callers with
 * real lon/lat run them through `projectToMap` first. That keeps this
 * component ignorant of projection, which matters because the pins come from
 * two places: zone anchors today, and station points once branches have
 * dropped them.
 */
export interface MapPin {
  id: string;
  x: number;
  y: number;
  label: string;
  /** How many things are at this pin. Drawn on the pin when above one. */
  count?: number;
  /** Where clicking it goes. A pin without one stays a mark on a picture. */
  href?: string;
  /** The one currently being read, drawn larger and in the active colour. */
  selected?: boolean;
}

export function TanzaniaMap({
  data,
  title,
  activeZone,
  variant = 'display',
  labels = false,
  pins,
  className,
  regionHref,
  selectedRegion,
}: {
  data: ZoneDatum[];
  /** Accessible name for the figure. */
  title: string;
  activeZone?: ZoneKey;
  /** `display` shades by density; `flat` gives every zone equal weight. */
  variant?: 'display' | 'flat';
  /** Draw the zone name and campus count on the map itself. */
  labels?: boolean;
  /** Places to mark. Drawn above every region, in the brand's place colour. */
  pins?: MapPin[];
  className?: string;
  /** Makes each region a link. Given a region name, return where clicking it
   *  goes, or null to leave that region inert — a region with nothing in it
   *  should not offer a click that lands on an empty panel. */
  regionHref?: (region: string) => string | null;
  /** The region being read right now, drawn in the active colour. */
  selectedRegion?: string | null;
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

          const isSelected = selectedRegion === region.name;
          const href = regionHref?.(region.name) ?? null;

          const shape = (
            <path
              key={region.name}
              d={region.d}
              className={[
                styles.region,
                isActive ? styles.regionActive : '',
                isSelected ? styles.regionSelected : '',
                activeZone && !isActive ? styles.regionDimmed : '',
                href ? styles.regionLink : '',
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

          // An <a> around the path rather than an onClick, so the region works
          // with a keyboard, opens in a new tab on a middle click, and needs
          // no JavaScript at all. `aria-label` carries the name because the
          // path itself has no text and a <title> inside it would be hoisted
          // to the document head by React 19 and break hydration.
          if (!href) return shape;
          return (
            <a
              key={region.name}
              href={href}
              className={styles.regionAnchor}
              aria-label={region.name}
              aria-current={isSelected ? 'true' : undefined}
            >
              {shape}
            </a>
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

        {/* Pins, last so they sit above every region.

            Pink is the brand's place colour and is used for nothing else, so a
            pin needs no legend — it is the only pink on the map. Each is a
            filled dot with a white ring, which is what keeps it visible over
            both the palest zone and the darkest one. */}
        {pins?.length
          ? pins.map((pin) => {
              const dot = (
                <g
                  className={[styles.pin, pin.href ? styles.pinClickable : '']
                    .filter(Boolean).join(' ')}
                >
                  <circle cx={pin.x} cy={pin.y} r="13"
                    className={pin.selected ? styles.pinHaloOn : styles.pinHalo} />
                  <circle cx={pin.x} cy={pin.y} r={pin.selected ? 9 : 7}
                    className={pin.selected ? styles.pinDotOn : styles.pinDot} />
                  {pin.count && pin.count > 1 ? (
                    <text x={pin.x} y={pin.y + 28} className={styles.pinCount}>
                      {pin.count}
                    </text>
                  ) : null}
                </g>
              );

              if (!pin.href) return <g key={pin.id}>{dot}</g>;
              return (
                <a
                  key={pin.id}
                  href={pin.href}
                  aria-label={`${pin.label}${pin.count ? `, ${pin.count} stations` : ''}`}
                  aria-current={pin.selected ? 'true' : undefined}
                >
                  {dot}
                </a>
              );
            })
          : null}
      </svg>
    </figure>
  );
}
