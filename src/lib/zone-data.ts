import { institutions, ZONES, zoneLabel, type Zone } from './seed';
import type { ZoneKey } from './tanzania-map';
import { REGIONS_BY_ZONE } from './tanzania-map';

/**
 * Zone figures, joined to the map.
 *
 * The register's zone strings ("LAKE ZONE") and the map's keys ("LAKE") are
 * the same eight zones under two spellings; this is the single place that
 * conversion happens.
 */
export function zoneKeyOf(zone: Zone): ZoneKey {
  return zone.replace(/\s+ZONE$/i, '').trim().replace(/\s+/g, '_') as ZoneKey;
}

export interface ZoneFigure {
  key: ZoneKey;
  zone: Zone;
  label: string;
  /** Every institution the register places in this zone, campuses included. */
  campuses: number;
  /** Mother institutions only — campuses rolled up, so nothing double-counts. */
  motherInstitutions: number;
  /** Regions the map draws in this zone. */
  regions: string[];
  /** Regions the register itself names in this zone. */
  registerRegions: string[];
}

export const zoneFigures: ZoneFigure[] = ZONES.map((zone) => {
  const key = zoneKeyOf(zone);
  const inZone = institutions.filter((i) => i.zone === zone);
  return {
    key,
    zone,
    label: zoneLabel(zone),
    campuses: inZone.length,
    motherInstitutions: inZone.filter((i) => !i.isChild).length,
    regions: REGIONS_BY_ZONE[key] ?? [],
    registerRegions: [...new Set(inZone.map((i) => i.region))].sort(),
  };
}).sort((a, b) => b.campuses - a.campuses);
