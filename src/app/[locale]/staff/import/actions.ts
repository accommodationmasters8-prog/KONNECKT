'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';
import { parseCsvRows, pick, num, normaliseHeader, type CsvRow } from '@/lib/csv';
import { detectColumns, valueOf, FIELD_WORDING, type ColumnMap } from '@/lib/column-map';
import { readXlsx } from '@/lib/xlsx';

export type ImportKind = 'zones' | 'branches' | 'stations';

export interface ImportIssue {
  line: number;
  name: string;
  problem: string;
}

export interface ImportResult {
  ran: boolean;
  /** True when nothing was written — the preview pass. */
  preview: boolean;
  kind: ImportKind | null;
  /** Which column the importer decided is which, so the preview can show it
   *  and somebody can see it read the wrong one before it writes anything. */
  mapping: { field: string; column: string }[];
  toCreate: { line: number; name: string; detail: string }[];
  toUpdate: { line: number; name: string; detail: string }[];
  issues: ImportIssue[];
  message: string;
  ok: boolean;
}

const EMPTY: ImportResult = {
  ran: false, preview: true, kind: null, mapping: [],
  toCreate: [], toUpdate: [], issues: [], message: '', ok: false,
};

/** The mapping, in the order a person would read it. */
function describe(map: ColumnMap): { field: string; column: string }[] {
  return Object.entries(map).map(([field, column]) => ({
    field: FIELD_WORDING[field as keyof typeof FIELD_WORDING] ?? field,
    column,
  }));
}

/**
 * Bring a spreadsheet in.
 *
 * Two passes over the same code, always. The first reports what would happen
 * and writes nothing; the second does it. A bulk import that goes straight to
 * the database is one where 240 rows land wrong and the only way to find out
 * is to go looking — so nothing is written until somebody has read the list of
 * what is about to change.
 *
 * Scope is not checked here. Row level security decides whether each row may
 * be written, so a zone manager importing a file full of other zones gets
 * their own rows in and the rest refused by name.
 */
export async function importCsv(
  _prev: ImportResult,
  form: FormData,
): Promise<ImportResult> {
  const supabase = await getServerClient();
  if (!supabase) return { ...EMPTY, ran: true, message: 'No database is attached.' };

  const session = await getStaffSession();
  if (!session.signedIn) return { ...EMPTY, ran: true, message: 'Sign in first.' };

  const kind = String(form.get('kind') ?? '') as ImportKind;
  if (kind !== 'branches' && kind !== 'stations' && kind !== 'zones') {
    return { ...EMPTY, ran: true, message: 'Choose what the file contains.' };
  }

  const commit = String(form.get('commit') ?? '') === 'yes';

  // A file if one was chosen, otherwise whatever was pasted. Pasting is not a
  // fallback — it is how somebody with the spreadsheet open on the same screen
  // actually moves twenty rows across.
  const file = form.get('file');
  let rows: CsvRow[] = [];

  if (file instanceof File && file.size > 0) {
    // A register is a big file. 40MB covers every workbook this has been
    // handed so far with room over — an .xlsx is a compressed archive, so a
    // 40MB one is tens of thousands of rows, not hundreds.
    if (file.size > 40_000_000) {
      return {
        ...EMPTY, ran: true,
        message: 'That file is over 40MB, which is larger than a register of stations should ever be. If it carries embedded images or extra sheets, save a copy with just the list in it.',
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // An .xlsx is a ZIP, and every ZIP starts "PK". Sniffing the bytes rather
    // than trusting the extension is what catches a workbook somebody renamed
    // to .csv, which is a thing people do.
    const isWorkbook = buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;

    if (isWorkbook) {
      try {
        rows = fromGrid(readXlsx(buffer));
      } catch (error) {
        return {
          ...EMPTY, ran: true,
          message: `That workbook could not be read (${
            error instanceof Error ? error.message : 'unknown format'
          }). If it is an old .xls, open it in Excel and save it as .xlsx or CSV.`,
        };
      }
    } else if (/\.xls$/i.test(file.name)) {
      return {
        ...EMPTY, ran: true,
        message: `${file.name} is the old Excel format. Open it and use File → Save As → Excel Workbook (.xlsx), or CSV.`,
      };
    } else {
      rows = parseCsvRows(buffer.toString('utf8')).rows;
    }
  } else {
    const pasted = String(form.get('pasted') ?? '');
    if (pasted.trim() === '') {
      return { ...EMPTY, ran: true, message: 'Upload a spreadsheet or paste the rows.' };
    }
    rows = parseCsvRows(pasted).rows;
  }

  if (rows.length === 0) {
    return { ...EMPTY, ran: true, message: 'That file has a header row and nothing under it.' };
  }

  // Which column is which, decided once from the headers rather than guessed
  // per row. Real files do not use this importer's names for things — the TCU
  // register calls the name "NAME OF UNIVERSITY" and the branch "NEAR BRANCH".
  const map = detectColumns(Object.keys(rows[0] ?? {}));

  if (!map.name) {
    return {
      ...EMPTY, ran: true, mapping: describe(map),
      message: 'No column in that file looks like a name. Rename the column holding the names to "name" and upload it again.',
    };
  }
  // The whole file lands in one transaction, so the ceiling is what the
  // database will do inside one statement timeout rather than what the parser
  // can read. Ten thousand is comfortably inside it and well past any real
  // register.
  if (rows.length > 10_000) {
    return {
      ...EMPTY, ran: true,
      message: `${rows.length.toLocaleString()} rows is more than one import should carry in a single transaction. Split it into files of 10,000 or fewer and upload them one after another — each is all-or-nothing on its own.`,
    };
  }

  // Arriving from a category screen, the category is already the answer to a
  // question the file would otherwise have to carry a column for.
  const fixedCategory = String(form.get('fixed_category') ?? '').trim() || null;
  const fixedBranch = String(form.get('fixed_branch') ?? '').trim() || null;

  if (kind === 'zones') return importZones(supabase, rows, map, commit, session.role);

  return kind === 'branches'
    ? importBranches(supabase, rows, map, commit, session.role, session.zone)
    : importStations(supabase, rows, map, commit, fixedCategory, fixedBranch);
}

type Client = NonNullable<Awaited<ReturnType<typeof getServerClient>>>;

/**
 * A sheet of cells, keyed by its header row.
 *
 * The same shape `parseCsvRows` produces, so a workbook and a CSV take
 * identical paths from here on. Headers are normalised the same way, and
 * columns the importer does not recognise are simply never asked for — which
 * is what lets somebody upload their own working spreadsheet, thirty columns
 * wide, instead of building a file to a template first.
 */
function fromGrid(grid: string[][]): CsvRow[] {
  if (grid.length === 0) return [];

  // The header is the first row with at least two filled cells. Exports often
  // open with a title row and a blank one before the real headings.
  let headerAt = grid.findIndex((r) => r.filter((c) => c.trim() !== '').length >= 2);
  if (headerAt < 0) headerAt = 0;

  const keys = grid[headerAt].map(normaliseHeader);

  return grid.slice(headerAt + 1).map((cells) => {
    const row: CsvRow = {};
    keys.forEach((key, i) => {
      if (key) row[key] = (cells[i] ?? '').trim();
    });
    return row;
  }).filter((row) => Object.values(row).some((v) => v !== ''));
}

/** Names compare loosely: case and inner spacing are not identity. */
function key(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

/**
 * Zones, from a list of names.
 *
 * The one import that is not a single transaction, and cannot be: adding a
 * zone alters an enum twelve tables depend on, and Postgres will not let a new
 * enum value be used in the transaction that created it. So each zone is two
 * calls, and the loop is honest about what it managed rather than pretending
 * to be atomic.
 *
 * It is close to harmless in practice. A zone with no branches in it shows an
 * empty panel and nothing else — unlike a half-imported branch list, a
 * half-imported zone list breaks nothing and the missing ones can simply be
 * added again.
 */
async function importZones(
  supabase: Client,
  rows: CsvRow[],
  map: ColumnMap,
  commit: boolean,
  role: string,
): Promise<ImportResult> {
  if (role !== 'hq') {
    return { ...EMPTY, ran: true, kind: 'zones', message: 'Only HQ can add zones.' };
  }

  const { data: existing } = await supabase.from('zones' as never)
    .select('code, name_en').limit(200);
  const known = new Set(
    ((existing as unknown as { name_en: string }[]) ?? []).map((z) => key(z.name_en)),
  );

  const toCreate: ImportResult['toCreate'] = [];
  const toUpdate: ImportResult['toUpdate'] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  const planned: { line: number; name: string }[] = [];

  rows.forEach((row, i) => {
    const line = i + 2;
    // A zone list often has the zone in a column called "zone" rather than
    // "name", so either will do.
    const name = (valueOf(row, map, 'name') || valueOf(row, map, 'zone'))
      .replace(/\s*zone\s*$/i, '').trim();

    if (name.length < 2) {
      issues.push({ line, name: name || '(blank)', problem: 'No zone name in this row.' });
      return;
    }
    if (seen.has(key(name))) {
      issues.push({ line, name, problem: 'The same zone appears earlier in this file.' });
      return;
    }
    seen.add(key(name));

    if (known.has(key(name))) toUpdate.push({ line, name, detail: 'already exists' });
    else { toCreate.push({ line, name, detail: 'new zone' }); planned.push({ line, name }); }
  });

  if (!commit) {
    return {
      ran: true, preview: true, kind: 'zones', mapping: describe(map),
      toCreate, toUpdate, issues, ok: true,
      message: `${toCreate.length} zones to add, ${toUpdate.length} already here, ${issues.length} skipped. Nothing has been written yet.`,
    };
  }

  let created = 0;
  const failures: ImportIssue[] = [...issues];

  for (const item of planned) {
    const code = item.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

    const { error: addError } = await supabase.rpc('zone_add_value' as never, { p_code: code } as never);
    if (addError) { failures.push({ line: item.line, name: item.name, problem: addError.message }); continue; }

    const { error: regError } = await supabase.rpc('zone_register' as never, {
      p_code: code, p_name_en: item.name, p_name_sw: item.name,
    } as never);
    if (regError) failures.push({ line: item.line, name: item.name, problem: regError.message });
    else created += 1;
  }

  revalidatePath('/', 'layout');
  return {
    ran: true, preview: false, kind: 'zones', mapping: describe(map),
    toCreate: [], toUpdate: [], issues: failures, ok: true,
    message: `Done. ${created} zones added${failures.length ? `, ${failures.length} skipped` : ''}.`,
  };
}

async function importBranches(
  supabase: Client,
  rows: CsvRow[],
  map: ColumnMap,
  commit: boolean,
  role: string,
  ownZone: string | null,
): Promise<ImportResult> {
  const [{ data: existing }, { data: zoneRows }] = await Promise.all([
    supabase.from('branches' as never).select('id, name, zone_code').limit(5000),
    supabase.from('zones' as never).select('code').limit(200),
  ]);

  const byName = new Map(
    ((existing as unknown as { id: string; name: string; zone_code: string | null }[]) ?? [])
      .map((b) => [key(b.name), b]),
  );
  const zones = new Set(
    ((zoneRows as unknown as { code: string }[]) ?? []).map((z) => z.code),
  );

  const toCreate: ImportResult['toCreate'] = [];
  const toUpdate: ImportResult['toUpdate'] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();

  const planned: {
    line: number; row: CsvRow; name: string; zone: string | null; existingId?: string;
  }[] = [];

  rows.forEach((row, i) => {
    const line = i + 2; // header is line 1
    const name = valueOf(row, map, 'name');

    if (name.length < 2) {
      issues.push({ line, name: name || '(blank)', problem: 'No branch name in this row.' });
      return;
    }
    if (seen.has(key(name))) {
      issues.push({ line, name, problem: 'The same branch appears earlier in this file.' });
      return;
    }
    seen.add(key(name));

    const rawZone = valueOf(row, map, 'zone').toUpperCase()
      .replace(/\s*ZONE\s*$/, '')      // "LAKE ZONE" is the LAKE zone.
      .trim().replace(/[\s-]+/g, '_');
    // A zone manager's file is filed into their own zone whatever it says.
    const zone = role === 'zone' ? ownZone : (rawZone || null);

    if (zone && !zones.has(zone)) {
      issues.push({ line, name, problem: `No zone called "${rawZone}". Add the zone first, or leave the column blank.` });
      return;
    }

    const found = byName.get(key(name));
    const detail = zone ? `${zone.replace(/_/g, ' ')} zone` : 'no zone';

    if (found) {
      toUpdate.push({ line, name, detail });
      planned.push({ line, row, name, zone, existingId: found.id });
    } else {
      toCreate.push({ line, name, detail });
      planned.push({ line, row, name, zone });
    }
  });

  if (!commit) {
    return {
      ran: true, preview: true, kind: 'branches', mapping: describe(map), toCreate, toUpdate, issues, ok: true,
      message: `${toCreate.length} to add, ${toUpdate.length} to update, ${issues.length} skipped. Nothing has been written yet — importing writes all of them together or none.`,
    };
  }

  // One call, one transaction. The loop that used to live here made a separate
  // write per row, so anything that stopped it in the middle — a timeout, a
  // closed browser, one row refused — left the database holding half a
  // spreadsheet, with nothing to say which half.
  const payload = planned.map((item) => {
    const n = num(valueOf(item.row, map, 'year'));
    const year = n !== null && n >= 1960 && n <= new Date().getFullYear() + 1 ? String(n) : '';

    return {
      name: item.name,
      slug: slugify(item.name),
      zone_code: item.zone ?? '',
      year_established: year,
      year_refurbished: '',
      notes: valueOf(item.row, map, 'notes'),
    };
  });

  const { data: result, error } = await supabase.rpc(
    'import_branches' as never,
    { p_rows: payload } as never,
  );

  if (error) return { ...EMPTY, ran: true, kind: 'branches', mapping: describe(map), issues, message: wording(error.message) };

  const counts = (result as unknown as { created: number; updated: number }) ?? { created: 0, updated: 0 };

  revalidatePath('/', 'layout');
  return {
    ran: true, preview: false, kind: 'branches', mapping: describe(map),
    toCreate: [], toUpdate: [], issues, ok: true,
    message: `Done. ${counts.created} branches added, ${counts.updated} updated${issues.length ? `, ${issues.length} skipped before it ran` : ''}.`,
  };
}

async function importStations(
  supabase: Client,
  rows: CsvRow[],
  map: ColumnMap,
  commit: boolean,
  /** Slug of the category every row belongs to, when the screen already knows.
   *  A column in the file is then redundant, and is ignored rather than
   *  allowed to send half the rows somewhere else. */
  fixedCategory: string | null = null,
  /** Likewise the branch, when importing from inside one. An id rather than a
   *  name: the screen has the row, so there is nothing to match and nothing to
   *  misspell. */
  fixedBranchId: string | null = null,
): Promise<ImportResult> {
  const [{ data: branchRows }, { data: catRows }, { data: stationRows }] = await Promise.all([
    supabase.from('branches' as never).select('id, name').limit(5000),
    supabase.from('tracker_categories' as never)
      .select('id, slug, name_en').eq('is_active', true).limit(100),
    supabase.from('stations' as never).select('id, name, branch_id').limit(5000),
  ]);

  const branchList = (branchRows as unknown as { id: string; name: string }[]) ?? [];
  const branches = new Map(branchList.map((b) => [key(b.name), b.id]));
  const branchNameById = new Map(branchList.map((b) => [b.id, b.name]));
  const categories = new Map<string, string>();
  const categoryLabel = new Map<string, string>();
  for (const c of (catRows as unknown as { id: string; slug: string; name_en: string }[]) ?? []) {
    categories.set(key(c.name_en), c.id);
    categories.set(key(c.slug.replace(/-/g, ' ')), c.id);
    categories.set(key(c.slug), c.id);
    categoryLabel.set(c.id, c.name_en);
  }
  const existing = new Map(
    ((stationRows as unknown as { id: string; name: string }[]) ?? [])
      .map((s) => [key(s.name), s.id]),
  );

  const toCreate: ImportResult['toCreate'] = [];
  const toUpdate: ImportResult['toUpdate'] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  const planned: {
    line: number; row: CsvRow; name: string;
    branchId: string; categoryId: string; existingId?: string;
  }[] = [];

  rows.forEach((row, i) => {
    const line = i + 2;
    const name = valueOf(row, map, 'name');

    if (name.length < 2) {
      issues.push({ line, name: name || '(blank)', problem: 'No station name in this row.' });
      return;
    }
    if (seen.has(key(name))) {
      issues.push({ line, name, problem: 'The same station appears earlier in this file.' });
      return;
    }
    seen.add(key(name));

    const branchName = fixedBranchId
      ? (branchNameById.get(fixedBranchId) ?? 'this branch')
      : valueOf(row, map, 'branch');
    const branchId = fixedBranchId ?? branches.get(key(branchName));
    if (!branchId) {
      issues.push({
        line, name,
        problem: branchName
          ? `No branch called "${branchName}". Import the branches first, or correct the spelling.`
          : 'No branch in this row. Every station belongs to exactly one.',
      });
      return;
    }

    const catName = fixedCategory ?? valueOf(row, map, 'category');
    const categoryId = categories.get(key(catName));
    if (!categoryId) {
      issues.push({
        line, name,
        problem: catName
          ? `No category called "${catName}". Use one of the eight on the Categories screen.`
          : 'No category in this row.',
      });
      return;
    }

    const found = existing.get(key(name));
    const detail = `${branchName} · ${categoryLabel.get(categoryId) ?? catName}`;

    if (found) { toUpdate.push({ line, name, detail }); planned.push({ line, row, name, branchId, categoryId, existingId: found }); }
    else { toCreate.push({ line, name, detail }); planned.push({ line, row, name, branchId, categoryId }); }
  });

  if (!commit) {
    return {
      ran: true, preview: true, kind: 'stations', mapping: describe(map), toCreate, toUpdate, issues, ok: true,
      message: `${toCreate.length} to add, ${toUpdate.length} to update, ${issues.length} skipped. Nothing has been written yet — importing writes all of them together or none.`,
    };
  }

  // One call, one transaction — same reasoning as the branches above. Either
  // the whole sheet lands or none of it does.
  const payload = planned.map((item) => ({
    name: item.name,
    branch_id: item.branchId,
    category_id: item.categoryId,
    region_name: valueOf(item.row, map, 'region'),
    district_name: valueOf(item.row, map, 'district'),
    address: valueOf(item.row, map, 'address'),
    contact_name: valueOf(item.row, map, 'contact'),
    contact_phone: valueOf(item.row, map, 'phone'),
    portfolio: String(num(valueOf(item.row, map, 'portfolio')) ?? ''),
  }));

  const { data: result, error } = await supabase.rpc(
    'import_stations' as never,
    { p_rows: payload } as never,
  );

  if (error) return { ...EMPTY, ran: true, kind: 'stations', mapping: describe(map), issues, message: wording(error.message) };

  const counts = (result as unknown as { created: number; updated: number }) ?? { created: 0, updated: 0 };

  revalidatePath('/', 'layout');
  return {
    ran: true, preview: false, kind: 'stations', mapping: describe(map),
    toCreate: [], toUpdate: [], issues, ok: true,
    message: `Done. ${counts.created} stations added, ${counts.updated} updated${issues.length ? `, ${issues.length} skipped before it ran` : ''}.`,
  };
}

/**
 * A database error, said to somebody holding a spreadsheet.
 *
 * The important half of every one of these is the same: nothing was written.
 * That has to lead, because the question in the reader's head is "what state
 * is it in now" and the answer is always "exactly as it was".
 */
function wording(message: string): string {
  const nothing = 'Nothing was imported — the whole file was rolled back, so the database is exactly as it was.';

  if (message.includes('row-level security')) {
    return `${nothing} One or more rows are outside what your account can write to.`;
  }
  if (message.includes('duplicate key')) {
    return `${nothing} Two rows would have created the same record.`;
  }
  if (message.includes('violates foreign key')) {
    return `${nothing} A row points at a branch or category that no longer exists — check the file and try again.`;
  }
  if (message.includes('invalid input value for enum')) {
    return `${nothing} A zone in the file is not one this system knows.`;
  }
  if (/timeout|canceling statement/i.test(message)) {
    return `${nothing} The file was too large to finish in one go — split it into smaller files and upload them one at a time.`;
  }
  return `${nothing} The database said: ${message}`;
}
