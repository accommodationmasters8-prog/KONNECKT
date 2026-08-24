/**
 * Builds the Tanzania zone map from real geography.
 *
 * Source: Natural Earth 1:10m admin-1 boundaries (public domain), filtered to
 * adm0_a3 = TZA. Thirty regions, grouped into the eight CRDB zones using the
 * register's own zone assignments as the authority — every grouping below is
 * cross-checked against a region that appears in konekt-seed-data.json.
 *
 * Output: src/lib/tanzania-map.ts — SVG path data, one path per region plus one
 * merged outline per zone, already projected and simplified. No geometry work
 * happens in the browser and no map library is shipped.
 *
 * Re-run with:  node scripts/geo/build-tanzania-map.mjs <path-to-geojson>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE = process.argv[2] || '/tmp/claude-0/ne10_admin1.geojson';
const OUT = path.join(process.cwd(), 'src', 'lib', 'tanzania-map.ts');

/* ---------------------------------------------------------------------------
   Region -> CRDB zone.

   The eight zones are CRDB's own. Where the supplied register places a region
   in a zone, that placement wins — Shinyanga sits in WESTERN here because the
   register puts KIZUMBI INSTITUTE (Shinyanga) in WESTERN ZONE, not because a
   map would suggest it belongs with the lake.

   Regions marked `fromRegister: true` are confirmed by an institution record.
   The rest are assigned by geography and need CRDB's confirmation — they are
   listed in the generated file so the gap is visible rather than assumed away.
------------------------------------------------------------------------- */
const ZONE_BY_REGION = {
  'Dar-Es-Salaam': { zone: 'DAR_ES_SALAAM', fromRegister: true },

  'Pwani': { zone: 'COASTAL', fromRegister: true },
  'Zanzibar West': { zone: 'COASTAL', fromRegister: true },
  'Zanzibar South and Central': { zone: 'COASTAL', fromRegister: false },
  'Kaskazini-Unguja': { zone: 'COASTAL', fromRegister: true },
  'Kaskazini-Pemba': { zone: 'COASTAL', fromRegister: false },
  'Kusini-Pemba': { zone: 'COASTAL', fromRegister: false },

  'Arusha': { zone: 'NORTHERN', fromRegister: true },
  'Kilimanjaro': { zone: 'NORTHERN', fromRegister: true },
  'Manyara': { zone: 'NORTHERN', fromRegister: false },
  'Tanga': { zone: 'NORTHERN', fromRegister: false },

  'Mwanza': { zone: 'LAKE', fromRegister: true },
  'Mara': { zone: 'LAKE', fromRegister: true },
  'Kagera': { zone: 'LAKE', fromRegister: false },
  'Geita': { zone: 'LAKE', fromRegister: false },
  'Simiyu': { zone: 'LAKE', fromRegister: false },

  'Tabora': { zone: 'WESTERN', fromRegister: true },
  'Kigoma': { zone: 'WESTERN', fromRegister: false },
  'Shinyanga': { zone: 'WESTERN', fromRegister: true },

  'Dodoma': { zone: 'CENTRAL', fromRegister: true },
  'Singida': { zone: 'CENTRAL', fromRegister: false },
  'Morogoro': { zone: 'CENTRAL', fromRegister: true },
  'Iringa': { zone: 'CENTRAL', fromRegister: true },

  'Mbeya': { zone: 'HIGHLAND', fromRegister: true },
  'Njombe': { zone: 'HIGHLAND', fromRegister: false },
  'Rukwa': { zone: 'HIGHLAND', fromRegister: true },
  'Katavi': { zone: 'HIGHLAND', fromRegister: true },

  'Mtwara': { zone: 'SOUTHERN', fromRegister: true },
  'Lindi': { zone: 'SOUTHERN', fromRegister: false },
  'Ruvuma': { zone: 'SOUTHERN', fromRegister: false },
};

/* ---------------------------------------------------------------------------
   Ramer-Douglas-Peucker. The 1:10m boundaries carry far more vertices than a
   400px-wide map can show; shipping them all would be tens of kilobytes of
   coordinates nobody can see.
------------------------------------------------------------------------- */
function perpendicularDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const cx = ax + Math.max(0, Math.min(1, t)) * dx;
  const cy = ay + Math.max(0, Math.min(1, t)) * dy;
  return Math.hypot(px - cx, py - cy);
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

/* ---------------------------------------------------------------------------
   Projection.

   Tanzania spans roughly 1S to 12S. That close to the equator an
   equirectangular projection with a cosine correction at the mean latitude is
   visually indistinguishable from Mercator and costs nothing to compute, so
   there is no projection library here either.
------------------------------------------------------------------------- */
const VIEW_WIDTH = 1000;

function buildProjector(features) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of features) {
    for (const ring of eachRing(f.geometry)) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  const meanLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lonScale = Math.cos(meanLat);
  const spanX = (maxLon - minLon) * lonScale;
  const spanY = maxLat - minLat;
  const scale = VIEW_WIDTH / spanX;
  const height = Math.round(spanY * scale);

  return {
    height,
    project([lon, lat]) {
      return [
        (lon - minLon) * lonScale * scale,
        (maxLat - lat) * scale,
      ];
    },
    bounds: { minLon, maxLon, minLat, maxLat },
  };
}

function* eachRing(geometry) {
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) yield ring;
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) for (const ring of polygon) yield ring;
  }
}

/**
 * Area-weighted centroid of a zone's regions, in projected coordinates.
 *
 * Used to place the zone label. A simple bounding-box centre would put the
 * Coastal label in the sea between Zanzibar and the mainland; weighting by
 * polygon area keeps it on land.
 */
function polygonCentroid(rings) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
  }
  if (area === 0) return null;
  area *= 0.5;
  return [cx / (6 * area), cy / (6 * area)];
}

function toPath(geometry, project, tolerance) {
  const parts = [];
  for (const ring of eachRing(geometry)) {
    const projected = ring.map(project);
    const reduced = simplify(projected, tolerance);
    // A ring that simplifies to a sliver is an island too small to see.
    if (reduced.length < 4) continue;
    const d = reduced
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join('');
    parts.push(`${d}Z`);
  }
  return parts.join('');
}

/* ------------------------------------------------------------------------ */

const geo = JSON.parse(readFileSync(SOURCE, 'utf8'));
const features = geo.features.filter((f) => f.properties.adm0_a3 === 'TZA');

if (features.length === 0) {
  console.error('No Tanzanian features found. Is this the admin-1 file?');
  process.exit(1);
}

const unmapped = features
  .map((f) => f.properties.name)
  .filter((name) => !ZONE_BY_REGION[name]);

if (unmapped.length) {
  console.error('Regions with no zone assignment:', unmapped.join(', '));
  console.error('Add them to ZONE_BY_REGION — a region silently dropped from the');
  console.error('map is a region CRDB will notice is missing.');
  process.exit(1);
}

const projector = buildProjector(features);
const TOLERANCE = 1.1; // in projected units; ~1px at the rendered width

const regions = features
  .map((f) => {
    const meta = ZONE_BY_REGION[f.properties.name];
    return {
      name: f.properties.name,
      zone: meta.zone,
      confirmedByRegister: meta.fromRegister,
      d: toPath(f.geometry, projector.project, TOLERANCE),
    };
  })
  .filter((r) => r.d.length > 0)
  .sort((a, b) => a.name.localeCompare(b.name));

const zones = [...new Set(regions.map((r) => r.zone))].sort();

/**
 * Manual nudges for zones whose centroids collide.
 *
 * Dar es Salaam is the densest zone and the smallest shape on the map, and its
 * centroid sits about 50px from Coastal's — close enough that the two labels
 * overlap. Rather than shrink the labels until neither is readable, these two
 * are pushed apart: Dar out over the water it fronts, Coastal south into
 * Pwani. Everything else uses its real centroid.
 *
 * Offsets are in viewBox units, so they hold at every rendered size.
 */
const LABEL_NUDGE = {
  DAR_ES_SALAAM: { dx: 66, dy: -78 },
  COASTAL: { dx: -18, dy: 96 },
};

// Zone label anchors, from the projected geometry of every region in the zone.
const zoneAnchors = {};
for (const zone of zones) {
  const rings = [];
  for (const f of features) {
    if (ZONE_BY_REGION[f.properties.name].zone !== zone) continue;
    for (const ring of eachRing(f.geometry)) rings.push(ring.map(projector.project));
  }
  const centroid = polygonCentroid(rings);
  if (centroid) {
    const nudge = LABEL_NUDGE[zone] ?? { dx: 0, dy: 0 };
    zoneAnchors[zone] = {
      x: Math.round(centroid[0] + nudge.dx),
      y: Math.round(centroid[1] + nudge.dy),
      // A nudged label no longer sits on its own shape, so it gets a leader
      // line back to the real centroid.
      leader: nudge.dx || nudge.dy
        ? { x: Math.round(centroid[0]), y: Math.round(centroid[1]) }
        : null,
    };
  }
}

const confirmed = regions.filter((r) => r.confirmedByRegister).length;
const bytes = regions.reduce((n, r) => n + r.d.length, 0);

const banner = `/**
 * Tanzania zone map — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   node scripts/geo/build-tanzania-map.mjs <ne_10m_admin_1_states_provinces.geojson>
 *
 * Source: Natural Earth 1:10m admin-1 boundaries, public domain.
 * ${regions.length} Tanzanian regions, projected and simplified to ~1px at the
 * rendered width. Total path data: ${(bytes / 1024).toFixed(1)}KB.
 *
 * This is real geography, not a drawing. Region-to-zone assignment follows the
 * CRDB register wherever the register states one (${confirmed} of ${regions.length} regions);
 * the remainder are assigned geographically and are flagged
 * confirmedByRegister: false so the gap stays visible.
 *
 * Known gap: Songwe region (created 2016) is absent from this edition of
 * Natural Earth and is therefore not drawn. Its institutions still appear in
 * the counts. See docs/OPEN-ITEMS.md.
 */`;

const out = `${banner}

export type ZoneKey =
${zones.map((z) => `  | '${z}'`).join('\n')};

export interface MapRegion {
  /** Region name as Natural Earth spells it. */
  name: string;
  zone: ZoneKey;
  /** True when a CRDB register record places this region in this zone. */
  confirmedByRegister: boolean;
  /** SVG path data in the viewBox below. */
  d: string;
}

export const MAP_VIEWBOX = '0 0 ${VIEW_WIDTH} ${projector.height}';
export const MAP_WIDTH = ${VIEW_WIDTH};
export const MAP_HEIGHT = ${projector.height};

/** Geographic bounds of the projection, for placing a pin once one is verified. */
export const MAP_BOUNDS = {
  minLon: ${projector.bounds.minLon.toFixed(4)},
  maxLon: ${projector.bounds.maxLon.toFixed(4)},
  minLat: ${projector.bounds.minLat.toFixed(4)},
  maxLat: ${projector.bounds.maxLat.toFixed(4)},
} as const;

export const MAP_REGIONS: MapRegion[] = ${JSON.stringify(regions, null, 2)};

/**
 * Projects a coordinate into the map's viewBox. Equirectangular with a cosine
 * correction at the mean latitude — the same transform the paths were built
 * with, so a pin lands where the boundary says it should.
 *
 * Only ever call this with a coordinate a human has verified.
 */
export function projectToMap(lon: number, lat: number): { x: number; y: number } {
  const meanLat = ((MAP_BOUNDS.minLat + MAP_BOUNDS.maxLat) / 2) * (Math.PI / 180);
  const lonScale = Math.cos(meanLat);
  const scale = MAP_WIDTH / ((MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon) * lonScale);
  return {
    x: (lon - MAP_BOUNDS.minLon) * lonScale * scale,
    y: (MAP_BOUNDS.maxLat - lat) * scale,
  };
}

/**
 * Where to anchor a zone's label, in viewBox coordinates. Area-weighted so the
 * label sits on land rather than in the middle of a bounding box.
 */
export interface ZoneAnchor {
  x: number;
  y: number;
  /** Set when the label was moved off its shape, so it can be joined back. */
  leader: { x: number; y: number } | null;
}

export const ZONE_ANCHORS: Record<ZoneKey, ZoneAnchor> = ${JSON.stringify(
  zoneAnchors,
  null,
  2,
)};

export const REGIONS_BY_ZONE: Record<ZoneKey, string[]> = ${JSON.stringify(
  Object.fromEntries(zones.map((z) => [z, regions.filter((r) => r.zone === z).map((r) => r.name)])),
  null,
  2,
)};
`;

writeFileSync(OUT, out);
console.log(`Wrote ${OUT}`);
console.log(`  ${regions.length} regions, ${zones.length} zones`);
console.log(`  ${confirmed} region-to-zone assignments confirmed by the CRDB register`);
console.log(`  viewBox 0 0 ${VIEW_WIDTH} ${projector.height}`);
console.log(`  path data ${(bytes / 1024).toFixed(1)}KB`);
