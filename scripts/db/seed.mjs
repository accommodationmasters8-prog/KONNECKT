/**
 * Seeds the CRDB register into Postgres.
 *
 * Idempotent: safe to re-run. Every insert is an upsert keyed on the register's
 * own identifiers, so re-seeding after a schema change does not duplicate the
 * 252 branches.
 *
 * What this deliberately does NOT do: invent a coordinate. Not one record in
 * the supplied files has one, so every location row lands with
 * geocode_status = 'not_attempted' and goes into the verification queue.
 * A map with wrong pins in front of the client is worse than no map.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/db/seed.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  console.error('  local:    DATABASE_URL=postgres://postgres@localhost:5433/konekt');
  console.error('  supabase: use the connection string from Project Settings > Database');
  process.exit(1);
}

const register = JSON.parse(
  readFileSync(path.join(process.cwd(), 'data', 'konekt-seed-data.json'), 'utf8'),
);

/* ---------------------------------------------------------------------------
   Normalisation helpers
------------------------------------------------------------------------- */

const ZONE_CODES = {
  'CENTRAL ZONE': 'CENTRAL',
  'COASTAL ZONE': 'COASTAL',
  'DAR ES SALAAM ZONE': 'DAR_ES_SALAAM',
  'HIGHLAND ZONE': 'HIGHLAND',
  'LAKE ZONE': 'LAKE',
  'NORTHERN ZONE': 'NORTHERN',
  'SOUTHERN ZONE': 'SOUTHERN',
  'WESTERN ZONE': 'WESTERN',
};

const ZONE_NAMES = {
  CENTRAL: ['Central', 'Kanda ya Kati'],
  COASTAL: ['Coastal', 'Kanda ya Pwani'],
  DAR_ES_SALAAM: ['Dar es Salaam', 'Dar es Salaam'],
  HIGHLAND: ['Highland', 'Kanda ya Nyanda za Juu'],
  LAKE: ['Lake', 'Kanda ya Ziwa'],
  NORTHERN: ['Northern', 'Kanda ya Kaskazini'],
  SOUTHERN: ['Southern', 'Kanda ya Kusini'],
  WESTERN: ['Western', 'Kanda ya Magharibi'],
};

const ACCREDITATION = {
  'Accredited & Chartered': 'accredited_and_chartered',
  'Accredited': 'accredited',
  'Provisional Lisence': 'provisional_licence', // the register's spelling
  'Provisional Licence': 'provisional_licence',
  'Certificate of full registration & Chartered': 'full_registration_and_chartered',
  'Certificate of full registration': 'full_registration',
  'As per status of mother University': 'per_mother_institution',
};

const AFFILIATION_KIND = {
  'campus college': ['campus_college', 'campus_college'],
  'campus collge': ['campus_college', 'campus_college'], // register typo, matched not edited
  'university college': ['university_college', 'university_college'],
  'university centre': ['university_centre', 'university_centre'],
  'university institute': ['university_institute', 'university_institute'],
};

const slugify = (value) =>
  value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

/** "Q3 - Aug. 2024" and "1990" both yield 2024 / 1990. Junk yields null. */
function parseYear(raw) {
  if (!raw) return null;
  const match = String(raw).match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function parseAffiliation(raw) {
  if (!raw) return null;
  const match = raw
    .trim()
    .match(/^(CAMPUS COLL(?:E)?GE|UNIVERSITY COLLEGE|UNIVERSITY CENTRE|UNIVERSITY INSTITUTE)\s+UNDER\s+(.+)$/i);
  if (!match) return null;
  const mapped = AFFILIATION_KIND[match[1].toLowerCase()];
  if (!mapped) return null;
  return { affiliationType: mapped[0], kind: mapped[1], parentCode: match[2].trim() };
}

/** "MOBILE 4 - Itigi" is a van, not a branch with a pin. */
const isMobileUnit = (name) => /^MOBILE\s+\d+/i.test(name);

/* ------------------------------------------------------------------------ */

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

const counts = {
  zones: 0, regions: 0, districts: 0, wards: 0,
  branches: 0, institutions: 0, children: 0, barracks: 0,
  supporting: 0, locations: 0, unresolvedBranches: new Set(), orphans: [],
};

try {
  await client.query('begin');
  await client.query('set search_path to konekt, public');

  // --- Zones ---------------------------------------------------------------
  for (const [code, [en, sw]] of Object.entries(ZONE_NAMES)) {
    await client.query(
      `insert into konekt.zones (code, name_en, name_sw, display_order)
       values ($1, $2, $3, $4)
       on conflict (code) do update
         set name_en = excluded.name_en, name_sw = excluded.name_sw`,
      [code, en, sw, Object.keys(ZONE_NAMES).indexOf(code) + 1],
    );
    counts.zones += 1;
  }

  // --- Geography lookups ---------------------------------------------------
  const regionIds = new Map();
  const districtIds = new Map();
  const wardIds = new Map();

  async function ensureRegion(name, zoneCode) {
    if (!name) return null;
    const key = name.trim().toUpperCase();
    if (regionIds.has(key)) return regionIds.get(key);
    const { rows } = await client.query(
      `insert into konekt.regions (name, zone_code) values ($1, $2)
       on conflict (name) do update
         set zone_code = coalesce(konekt.regions.zone_code, excluded.zone_code)
       returning id`,
      [key, zoneCode ?? null],
    );
    regionIds.set(key, rows[0].id);
    counts.regions += 1;
    return rows[0].id;
  }

  async function ensureDistrict(regionId, name) {
    if (!regionId || !name) return null;
    const key = `${regionId}|${name.trim().toUpperCase()}`;
    if (districtIds.has(key)) return districtIds.get(key);
    const { rows } = await client.query(
      `insert into konekt.districts (region_id, name) values ($1, $2)
       on conflict (region_id, name) do update set name = excluded.name
       returning id`,
      [regionId, name.trim().toUpperCase()],
    );
    districtIds.set(key, rows[0].id);
    counts.districts += 1;
    return rows[0].id;
  }

  async function ensureWard(districtId, name) {
    if (!districtId || !name) return null;
    const key = `${districtId}|${name.trim().toUpperCase()}`;
    if (wardIds.has(key)) return wardIds.get(key);
    const { rows } = await client.query(
      `insert into konekt.wards (district_id, name) values ($1, $2)
       on conflict (district_id, name) do update set name = excluded.name
       returning id`,
      [districtId, name.trim().toUpperCase()],
    );
    wardIds.set(key, rows[0].id);
    counts.wards += 1;
    return rows[0].id;
  }

  /**
   * Creates or updates the location row for a record.
   *
   * Takes the owner's existing location_id when there is one, so re-running the
   * seed updates that row rather than orphaning it and creating another. A seed
   * that quietly doubles the geocoding queue on every run would have branch
   * staff verifying the same pin twice.
   *
   * Note what is absent: any coordinate. Records enter the queue at
   * not_attempted and stay invisible to the public map until a human confirms
   * a pin. Any already-verified coordinate is left completely alone — re-seeding
   * must never undo someone's verification work.
   */
  async function upsertLocation(existingId, { street, wardId, districtId, regionId }) {
    if (existingId) {
      await client.query(
        `update konekt.locations
           set street = $2, ward_id = $3, district_id = $4, region_id = $5
         where id = $1
           and geocode_status <> 'verified'`,
        [existingId, street ?? null, wardId, districtId, regionId],
      );
      return existingId;
    }
    const { rows } = await client.query(
      `insert into konekt.locations (street, ward_id, district_id, region_id)
       values ($1, $2, $3, $4) returning id`,
      [street ?? null, wardId, districtId, regionId],
    );
    counts.locations += 1;
    return rows[0].id;
  }

  /** The location a previous seed run already created for this slug, if any. */
  async function existingLocationFor(slug) {
    const { rows } = await client.query(
      'select location_id from konekt.institutions where slug = $1',
      [slug],
    );
    return rows[0]?.location_id ?? null;
  }

  // --- Branches ------------------------------------------------------------
  // The register gives a name and two year columns. No region, no zone, no
  // coordinate (§3.2.6), so nothing is inferred here.
  const branchIdBySlug = new Map();
  const branchIdByName = new Map();

  for (const branch of register.branches) {
    const name = branch.name.trim();
    const slug = slugify(`${name}-${branch.sn}`);
    const { rows } = await client.query(
      `insert into konekt.branches
         (register_sn, name, slug, year_established, year_established_raw,
          year_refurbished, year_refurbished_raw, is_mobile)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (register_sn) do update set
         name = excluded.name,
         year_established = excluded.year_established,
         year_established_raw = excluded.year_established_raw,
         year_refurbished = excluded.year_refurbished,
         year_refurbished_raw = excluded.year_refurbished_raw,
         is_mobile = excluded.is_mobile
       returning id`,
      [
        branch.sn, name, slug,
        parseYear(branch.year_established), branch.year_established,
        parseYear(branch.year_refurbished), branch.year_refurbished,
        isMobileUnit(name),
      ],
    );
    branchIdBySlug.set(slug, rows[0].id);
    branchIdByName.set(name.toUpperCase(), rows[0].id);
    counts.branches += 1;
  }

  /**
   * Resolves a branch name as written on an institution record.
   *
   * The register is not consistent: "CRDB UPANGA", "PALM BEACH PREMIER" and
   * "KARIAKOO NARUNG'OMBE" all refer to branches whose canonical names differ.
   * Unresolved names are collected and reported rather than silently dropped —
   * a missing coordinating branch is a real gap CRDB needs to close.
   */
  function resolveBranch(rawName) {
    if (!rawName) return null;
    const cleaned = rawName.trim().toUpperCase().replace(/^CRDB\s+/, '');
    if (branchIdByName.has(cleaned)) return branchIdByName.get(cleaned);

    for (const [name, id] of branchIdByName) {
      if (name === cleaned) return id;
      if (name.startsWith(cleaned) || cleaned.startsWith(name)) return id;
    }
    const collapsed = cleaned.replace(/[^A-Z]/g, '');
    for (const [name, id] of branchIdByName) {
      if (name.replace(/[^A-Z]/g, '') === collapsed) return id;
    }
    counts.unresolvedBranches.add(rawName);
    return null;
  }

  // --- Institutions: mothers first, then children --------------------------
  // Two passes because a child's parent_institution_id has to exist already.
  const institutions = register.institutions.universities_and_colleges;
  const idByShortName = new Map();
  const idBySlug = new Map();

  /** "ST. AUGUSTINE UNIVERSITY OF TANZANIA (SAUT)" -> "SAUT" */
  function shortNameOf(name) {
    const match = name.match(/\(([^)]+)\)\s*$/);
    if (match) return match[1].trim().toUpperCase();
    const alt = name.match(/\(([A-Za-z-]+)\)/);
    return alt ? alt[1].trim().toUpperCase() : null;
  }

  async function upsertInstitution(record, { parentId, affiliationType, kind }) {
    const zoneCode = ZONE_CODES[record.zone?.trim()] ?? null;
    const regionId = await ensureRegion(record.region, zoneCode);
    const districtId = await ensureDistrict(regionId, record.district);
    const wardId = await ensureWard(districtId, record.ward);

    const slug = slugify(record.name);
    const locationId = await upsertLocation(await existingLocationFor(slug), {
      street: record.street, wardId, districtId, regionId,
    });
    const { rows } = await client.query(
      `insert into konekt.institutions
         (name, short_name, slug, kind, parent_institution_id, affiliation_type,
          affiliation_raw, ownership, accreditation_status, year_established,
          coordinating_branch_id, location_id, zone_code, head_office)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (slug) do update set
         name = excluded.name,
         kind = excluded.kind,
         parent_institution_id = excluded.parent_institution_id,
         affiliation_type = excluded.affiliation_type,
         ownership = excluded.ownership,
         accreditation_status = excluded.accreditation_status,
         coordinating_branch_id = excluded.coordinating_branch_id,
         zone_code = excluded.zone_code
       returning id`,
      [
        record.name.trim(),
        shortNameOf(record.name),
        slug,
        kind,
        parentId,
        affiliationType,
        record.affiliation ?? null,
        record.ownership ? record.ownership.toLowerCase() : null,
        ACCREDITATION[record.accreditation_status?.trim()] ?? null,
        record.year_established ?? null,
        resolveBranch(record.coordinating_branch),
        locationId,
        zoneCode,
        record.head_office ?? null,
      ],
    );
    idBySlug.set(slug, rows[0].id);
    // Register every institution's short name, child or not. The register
    // nests two levels deep in one place — MWIKA CENTRE sits under SMMUCo,
    // which is itself a university college under TUMA — so a child can be
    // somebody else's parent.
    const short = shortNameOf(record.name);
    if (short) idByShortName.set(short, rows[0].id);
    counts.institutions += 1;
    return rows[0].id;
  }

  const mothers = institutions.filter((i) => !parseAffiliation(i.affiliation));
  const children = institutions.filter((i) => parseAffiliation(i.affiliation));

  for (const record of mothers) {
    await upsertInstitution(record, {
      parentId: null, affiliationType: null, kind: 'university',
    });
  }

  // Children are inserted in dependency order rather than in file order:
  // repeat passes until nothing new resolves. Without this, a grandchild whose
  // parent has not been inserted yet silently loses its affiliation.
  let pending = [...children];
  let pass = 0;
  while (pending.length && pass < 8) {
    pass += 1;
    const deferred = [];
    for (const record of pending) {
      const parsed = parseAffiliation(record.affiliation);
      const parentId = idByShortName.get(parsed.parentCode.toUpperCase()) ?? null;
      if (!parentId) {
        deferred.push(record);
        continue;
      }
      await upsertInstitution(record, {
        parentId,
        affiliationType: parsed.affiliationType,
        kind: parsed.kind,
      });
      counts.children += 1;
    }
    if (deferred.length === pending.length) break; // no progress; stop
    pending = deferred;
  }

  // Whatever is left names a mother institution that is not in the register.
  // Recorded standalone rather than dropped, and reported.
  const orphans = [];
  for (const record of pending) {
    const parsed = parseAffiliation(record.affiliation);
    orphans.push(`${record.name}  ->  ${parsed.parentCode}`);
    await upsertInstitution(record, {
      parentId: null, affiliationType: null, kind: parsed.kind,
    });
  }
  counts.orphans = orphans;

  // --- JKT barracks --------------------------------------------------------
  // §3.2.1 in its clearest form: one coordinating branch, several supporting.
  for (const barracks of register.institutions.jkt_barracks) {
    const regionId = await ensureRegion(barracks.location, null);
    const slug = slugify(`jkt-${barracks.name}-${barracks.barrack_number}`);
    const locationId = await upsertLocation(await existingLocationFor(slug), {
      regionId, wardId: null, districtId: null,
    });

    const { rows } = await client.query(
      `insert into konekt.institutions
         (name, slug, kind, barrack_number, coordinating_branch_id, location_id, head_office)
       values ($1,$2,'jkt_barracks',$3,$4,$5,$6)
       on conflict (slug) do update set
         name = excluded.name,
         coordinating_branch_id = excluded.coordinating_branch_id
       returning id`,
      [
        barracks.name.trim(),
        slug,
        barracks.barrack_number,
        resolveBranch(barracks.coordinating_branch),
        locationId,
        barracks.location,
      ],
    );
    counts.barracks += 1;

    for (const supporting of barracks.supporting_branches ?? []) {
      const branchId = resolveBranch(supporting);
      if (!branchId) continue;
      await client.query(
        `insert into konekt.institution_supporting_branches (institution_id, branch_id)
         values ($1, $2) on conflict do nothing`,
        [rows[0].id, branchId],
      );
      counts.supporting += 1;
    }
  }

  await client.query('commit');
} catch (error) {
  await client.query('rollback');
  console.error('Seed failed, nothing was written:', error.message);
  await client.end();
  process.exit(1);
}

/* --- Report --------------------------------------------------------------- */

const { rows: verify } = await client.query(`
  select
    (select count(*) from konekt.zones) as zones,
    (select count(*) from konekt.branches) as branches,
    (select count(*) from konekt.institutions where kind <> 'jkt_barracks') as institutions,
    (select count(*) from konekt.institutions where kind = 'jkt_barracks') as barracks,
    (select count(*) from konekt.institutions where parent_institution_id is not null) as children,
    (select count(*) from konekt.institution_supporting_branches) as supporting,
    (select count(*) from konekt.locations) as locations,
    (select count(*) from konekt.locations where point is not null) as with_coordinates,
    (select count(*) from konekt.institutions where coordinating_branch_id is null) as no_branch
`);
const v = verify[0];

console.log('\nSeeded from the CRDB register:');
console.log(`  zones                        ${v.zones}`);
console.log(`  branches                     ${v.branches}`);
console.log(`  universities and colleges    ${v.institutions}`);
console.log(`  JKT barracks                 ${v.barracks}`);
console.log(`  nested under a mother        ${v.children}`);
console.log(`  supporting-branch links      ${v.supporting}`);
console.log(`  locations queued to geocode  ${v.locations}`);
console.log(`  locations with a coordinate  ${v.with_coordinates}   <- correct: the register has none`);

if (Number(v.no_branch) > 0) {
  console.log(`\n  ${v.no_branch} institution(s) have no coordinating branch resolved.`);
}
if (counts.orphans.length) {
  console.log('\n  Institution(s) affiliated to a mother that is not in the register:');
  for (const line of counts.orphans) console.log(`    ${line}`);
}
if (counts.unresolvedBranches.size) {
  console.log('\n  Branch names on institution records that match no branch in the register:');
  for (const name of [...counts.unresolvedBranches].sort()) {
    console.log(`    ${name}`);
  }
  console.log('  These are real gaps in the supplied data, not seed failures.');
  console.log('  Listed in docs/OPEN-ITEMS.md for CRDB to resolve.');
}

await client.end();
