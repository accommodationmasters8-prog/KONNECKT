import seed from '../../data/konekt-seed-data.json';

/* ===========================================================================
   Real CRDB mapping data — read at build time only.
   This module is imported exclusively by server components, so none of the
   63KB seed file reaches the client bundle.

   The shapes below follow the four schema corrections the real data forces
   (build prompt §3.2). They are the contract Phase 2's PostGIS schema has to
   honour; nothing here invents a value the register does not contain.
   ======================================================================== */

export const ZONES = [
  'CENTRAL ZONE',
  'COASTAL ZONE',
  'DAR ES SALAAM ZONE',
  'HIGHLAND ZONE',
  'LAKE ZONE',
  'NORTHERN ZONE',
  'SOUTHERN ZONE',
  'WESTERN ZONE',
] as const;

export type Zone = (typeof ZONES)[number];

/** §3.2.3 — real fields on every institution record. */
export type Ownership = 'PUBLIC' | 'PRIVATE';

/** §3.2.2 — parsed from the TCU AFFILIATION column. */
export type AffiliationType =
  | 'campus_college'
  | 'university_college'
  | 'university_centre'
  | 'university_institute';

export interface RawInstitution {
  name: string;
  year_established: number;
  ownership: string;
  head_office: string;
  affiliation: string | null;
  street: string;
  ward: string;
  district: string;
  region: string;
  coordinating_branch: string;
  zone: string;
  accreditation_status: string;
}

export interface RawBarracks {
  name: string;
  barrack_number: string;
  location: string;
  coordinating_branch: string;
  supporting_branches: string[];
}

export interface RawBranch {
  sn: number;
  name: string;
  year_established: string | null;
  year_refurbished: string | null;
}

const raw = seed as {
  zones: string[];
  regions_seen: string[];
  branches: RawBranch[];
  institutions: {
    universities_and_colleges: RawInstitution[];
    jkt_barracks: RawBarracks[];
  };
};

/* ---------------------------------------------------------------------------
   §3.2.2 — institutions nest. Nine were expected; the register actually
   carries twenty children under eight mother institutions. Parsing the
   AFFILIATION string rather than counting by hand is what surfaced that.
   The register also contains one typo, "CAMPUS COLLGE UNDER MUST", which is
   matched here rather than corrected in the source file.
------------------------------------------------------------------------- */
const AFFILIATION_PATTERN =
  /^(CAMPUS COLL(?:E)?GE|UNIVERSITY COLLEGE|UNIVERSITY CENTRE|UNIVERSITY INSTITUTE)\s+UNDER\s+(.+)$/i;

const AFFILIATION_TYPES: Record<string, AffiliationType> = {
  'campus college': 'campus_college',
  'campus collge': 'campus_college',
  'university college': 'university_college',
  'university centre': 'university_centre',
  'university institute': 'university_institute',
};

export interface ParsedAffiliation {
  type: AffiliationType;
  /** The mother institution's code as written in the register, e.g. "SAUT". */
  parentCode: string;
}

export function parseAffiliation(value: string | null): ParsedAffiliation | null {
  if (!value) return null;
  const match = AFFILIATION_PATTERN.exec(value.trim());
  if (!match) return null;
  const type = AFFILIATION_TYPES[match[1].toLowerCase()];
  if (!type) return null;
  return { type, parentCode: match[2].trim() };
}

export interface Institution extends RawInstitution {
  zone: Zone;
  ownership: Ownership;
  parsedAffiliation: ParsedAffiliation | null;
  /** True when this record rolls up into another — exclude to avoid
      double-counting campuses in any report. */
  isChild: boolean;
}

export const institutions: Institution[] =
  raw.institutions.universities_and_colleges.map((record) => {
    const parsedAffiliation = parseAffiliation(record.affiliation);
    return {
      ...record,
      zone: record.zone as Zone,
      ownership: record.ownership as Ownership,
      parsedAffiliation,
      isChild: parsedAffiliation !== null,
    };
  });

export const barracks: RawBarracks[] = raw.institutions.jkt_barracks;
export const branches: RawBranch[] = raw.branches;

/* ---------------------------------------------------------------------------
   Map teaser figures.

   Institutions are the only set in the register that carries a CRDB-assigned
   zone, so they are the only set broken down by zone here. Branches and
   barracks have no zone or region column at all (§3.2.6) — inferring one to
   fill the card would be inventing data, so they stay as honest national
   totals until the geocoding pass joins them to geography.
------------------------------------------------------------------------- */
export interface ZoneStat {
  zone: Zone;
  /** Institutions whose zone the register assigns directly. */
  institutions: number;
  /** Mother institutions only — campuses and centres rolled up. */
  motherInstitutions: number;
  /** Distinct regions the register places in this zone. */
  regions: number;
  regionNames: string[];
}

export const zoneStats: ZoneStat[] = ZONES.map((zone) => {
  const inZone = institutions.filter((i) => i.zone === zone);
  const regionNames = [...new Set(inZone.map((i) => i.region))].sort();
  return {
    zone,
    institutions: inZone.length,
    motherInstitutions: inZone.filter((i) => !i.isChild).length,
    regions: regionNames.length,
    regionNames,
  };
});

export const nationalStats = {
  branches: branches.length,
  institutions: institutions.length,
  motherInstitutions: institutions.filter((i) => !i.isChild).length,
  childInstitutions: institutions.filter((i) => i.isChild).length,
  barracks: barracks.length,
  zones: ZONES.length,
  regionsSeen: raw.regions_seen.length,
  /** Not one record in the register carries a coordinate. §3.2.5. */
  geocodedRecords: 0,
} as const;

/** Zone label as CRDB writes it, shortened for display: "LAKE ZONE" -> "Lake". */
export function zoneLabel(zone: Zone): string {
  const words = zone.replace(/\s+ZONE$/i, '').toLowerCase().split(' ');
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
