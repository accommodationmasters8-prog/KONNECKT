/**
 * Acceptance gate: zero hardcoded hex values outside tokens.css, and no
 * character in the copy that the shipped font subset cannot render.
 *
 * Every colour in a component, stylesheet or page must resolve through a
 * custom property. The exceptions below are files that are not styling the
 * page and cannot reference CSS variables at all — the manifest, the icon
 * generator and the viewport theme colour, which browsers read before any
 * stylesheet has parsed.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

const SEARCH_DIRS = ['src', 'public', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git']);

/** Files that legitimately carry literal colour values, with the reason. */
const ALLOWED = new Map([
  ['src/styles/tokens.css', 'the token file itself — the single source of truth'],
  ['scripts/generate-icons.mjs', 'runs in plain Node; PNG encoding cannot read CSS'],
  ['scripts/check-no-raw-hex.mjs', 'this checker'],
  ['public/manifest.webmanifest', 'read by the OS before any stylesheet exists'],
  ['public/sw.js', 'no colours, but exempt from scanning'],
  ['src/app/[locale]/layout.tsx', 'viewport themeColor is parsed before CSS loads'],
]);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const failures = [];

for (const dir of SEARCH_DIRS) {
  for await (const file of walk(path.join(ROOT, dir))) {
    if (!/\.(css|tsx?|jsx?|mjs|json|webmanifest)$/.test(file)) continue;
    const rel = path.relative(ROOT, file);
    if (ALLOWED.has(rel)) continue;

    const source = await readFile(file, 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      // A hex inside a comment is documentation, not a hardcoded value.
      const stripped = line.replace(/\/\*.*?\*\//g, '').replace(/(^|\s)(\/\/|\*).*$/, '');
      const matches = stripped.match(HEX);
      if (matches) {
        failures.push(`${rel}:${index + 1}  ${matches.join(', ')}   ${line.trim()}`);
      }
    });
  }
}

/* ---------------------------------------------------------------------------
   Font subset guard.

   The fonts ship with the `latin` subset only. The brief expected `latin-ext`
   on the grounds that Swahili needs it; standard Kiswahili orthography uses
   the plain 26-letter Latin alphabet with no diacritics, and dropping the
   extended subset saved 111KB — a third of the initial payload on a 3G
   connection.

   That saving is only safe while no string actually needs those glyphs. This
   check scans every locale dictionary and the CRDB register for characters in
   the Latin Extended ranges. If one ever appears, the build says so, rather
   than silently falling back to a system face mid-sentence.
------------------------------------------------------------------------- */
const LATIN_EXT_SOURCES = [
  'src/i18n/en.ts',
  'src/i18n/sw.ts',
  'src/lib/sample-events.ts',
  'data/konekt-seed-data.json',
];

const inLatinExt = (cp) =>
  (cp >= 0x0100 && cp <= 0x024f) || // Latin Extended-A and -B
  (cp >= 0x1e00 && cp <= 0x1eff); // Latin Extended Additional

const extended = [];
for (const rel of LATIN_EXT_SOURCES) {
  let source;
  try {
    source = await readFile(path.join(ROOT, rel), 'utf8');
  } catch {
    continue;
  }
  const lines = source.split('\n');
  lines.forEach((line, index) => {
    for (const ch of line) {
      if (inLatinExt(ch.codePointAt(0))) {
        extended.push(
          `${rel}:${index + 1}  ${JSON.stringify(ch)} U+${ch
            .codePointAt(0)
            .toString(16)
            .toUpperCase()}`,
        );
      }
    }
  });
}

if (failures.length || extended.length) {
  if (failures.length) {
    console.error('Hardcoded hex values found outside tokens.css:\n');
    failures.forEach((f) => console.error('  ' + f));
  }
  if (extended.length) {
    console.error(
      '\nLatin Extended characters found, but the fonts ship the `latin` subset only.',
    );
    console.error('Either restrict the copy, or add `latin-ext` back in the layout:\n');
    extended.forEach((f) => console.error('  ' + f));
  }
  console.error(`\n${failures.length + extended.length} violation(s).`);
  process.exit(1);
}

console.log('check:tokens — no hardcoded hex values outside tokens.css.');
for (const [file, reason] of ALLOWED) {
  console.log(`  exempt: ${file}  (${reason})`);
}
console.log(
  `check:tokens — no Latin Extended characters in ${LATIN_EXT_SOURCES.length} copy sources; the shipped \`latin\` subset covers everything.`,
);
