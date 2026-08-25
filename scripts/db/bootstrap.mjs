/**
 * Builds one file that sets up the whole database from nothing.
 *
 * Not a substitute for the migrations — they stay the source of truth, and
 * this concatenates them in filename order. It exists because the fastest way
 * to bring up a fresh Supabase project is one paste into the SQL editor, and
 * because pasting nine files in the right order by hand is one slip away from
 * a schema that half exists.
 *
 *   node scripts/db/bootstrap.mjs        writes supabase/bootstrap.sql
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'supabase', 'migrations');
const OUT = path.join(process.cwd(), 'supabase', 'bootstrap.sql');

const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();

const parts = [
  `-- =============================================================================
-- CRDB KONEKT — full schema, generated from supabase/migrations by
-- scripts/db/bootstrap.mjs. Do not edit: edit a migration and regenerate.
--
-- Run it once against a new project:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/bootstrap.sql
-- or paste it into the Supabase SQL editor.
--
-- Then seed the CRDB register:
--   DATABASE_URL=... npm run db:seed
-- =============================================================================

create extension if not exists postgis;
`,
];

for (const file of files) {
  const sql = await readFile(path.join(DIR, file), 'utf8');
  parts.push(`\n-- ${'='.repeat(77)}\n-- ${file}\n-- ${'='.repeat(77)}\n${sql}`);
}

await writeFile(OUT, parts.join('\n'));

console.log(`supabase/bootstrap.sql — ${files.length} migrations, ${(parts.join('').length / 1024).toFixed(0)}KB`);
for (const file of files) console.log(`  ${file}`);
