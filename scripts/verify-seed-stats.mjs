/**
 * Acceptance gate: every number the landing page shows is traceable to the
 * register, and the register itself still says what we think it says.
 *
 * This exists because the build prompt's own summary of the data and the data
 * itself disagree in one place, and a silent drift between them would put a
 * wrong number in front of CRDB.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const seed = JSON.parse(
  await readFile(path.join(process.cwd(), 'data', 'konekt-seed-data.json'), 'utf8'),
);

const branches = seed.branches;
const institutions = seed.institutions.universities_and_colleges;
const barracks = seed.institutions.jkt_barracks;

const expected = {
  zones: 8,
  branches: 252,
  institutions: 54,
  barracks: 21,
};

const actual = {
  zones: seed.zones.length,
  branches: branches.length,
  institutions: institutions.length,
  barracks: barracks.length,
};

let failed = false;
for (const [key, value] of Object.entries(expected)) {
  const ok = actual[key] === value;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${key.padEnd(14)} expected ${value}, register has ${actual[key]}`);
}

// --- Structural facts the schema has to honour -------------------------
const children = institutions.filter((i) => i.affiliation);
const zoneValues = new Set(institutions.map((i) => i.zone));
const unknownZones = [...zoneValues].filter((z) => !seed.zones.includes(z));
const withCoordinates = [...institutions, ...barracks, ...branches].filter(
  (r) => r.lat != null || r.latitude != null || r.lng != null || r.longitude != null,
);
const branchesWithGeography = branches.filter((b) => b.region || b.zone || b.district);

console.log('');
console.log(`  nested institutions (affiliation set): ${children.length} of ${institutions.length}`);
console.log(`  distinct zone values on institutions:  ${zoneValues.size}`);
console.log(`  institution zones outside the enum:    ${unknownZones.length}`);
console.log(`  records carrying coordinates:          ${withCoordinates.length}`);
console.log(`  branches carrying region/zone/district:${branchesWithGeography.length}`);

if (unknownZones.length) {
  console.error(`\nFAIL zones outside the 8-value enum: ${unknownZones.join(', ')}`);
  failed = true;
}

if (withCoordinates.length !== 0) {
  console.error('\nFAIL a record now carries coordinates — the geocoding assumption has changed.');
  failed = true;
}

// --- Discrepancy against the brief -------------------------------------
if (children.length !== 9) {
  console.log('');
  console.log('  NOTE  The build prompt states nine of the 54 institutions are children.');
  console.log(`        The register carries ${children.length}. Rolling up on the brief's figure`);
  console.log('        would double-count campuses in every zone report. Raised in');
  console.log('        docs/OPEN-ITEMS.md — the register is treated as authoritative.');
  const parents = [
    ...new Set(
      children.map((c) => (c.affiliation.match(/UNDER\s+(.+)$/i) || [])[1]?.trim()).filter(Boolean),
    ),
  ].sort();
  console.log(`        Mother institutions referenced: ${parents.join(', ')}`);
}

console.log('');
if (failed) {
  console.error('check:stats — FAILED');
  process.exit(1);
}
console.log('check:stats — every published figure matches the register.');
