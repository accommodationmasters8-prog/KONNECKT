'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';
import { parseCsvRows, pick, num, normaliseHeader, type CsvRow } from '@/lib/csv';
import { readXlsx } from '@/lib/xlsx';

export type ImportKind = 'branches' | 'stations';

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
  toCreate: { line: number; name: string; detail: string }[];
  toUpdate: { line: number; name: string; detail: string }[];
  issues: ImportIssue[];
  message: string;
  ok: boolean;
}

const EMPTY: ImportResult = {
  ran: false, preview: true, kind: null,
  toCreate: [], toUpdate: [], issues: [], message: '', ok: false,
};

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
  if (kind !== 'branches' && kind !== 'stations') {
    return { ...EMPTY, ran: true, message: 'Choose what the file contains.' };
  }

  const commit = String(form.get('commit') ?? '') === 'yes';

  // A file if one was chosen, otherwise whatever was pasted. Pasting is not a
  // fallback — it is how somebody with the spreadsheet open on the same screen
  // actually moves twenty rows across.
  const file = form.get('file');
  let rows: CsvRow[] = [];

  if (file instanceof File && file.size > 0) {
    if (file.size > 8_000_000) {
      return { ...EMPTY, ran: true, message: 'That file is over 8MB. Split it, or paste the rows instead.' };
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
  if (rows.length > 2000) {
    return { ...EMPTY, ran: true, message: `${rows.length} rows is more than one import should carry. Split it into files of 2000 or fewer.` };
  }

  // Arriving from a category screen, the category is already the answer to a
  // question the file would otherwise have to carry a column for.
  const fixedCategory = String(form.get('fixed_category') ?? '').trim() || null;
  const fixedBranch = String(form.get('fixed_branch') ?? '').trim() || null;

  return kind === 'branches'
    ? importBranches(supabase, rows, commit, session.role, session.zone)
    : importStations(supabase, rows, commit, fixedCategory, fixedBranch);
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

async function importBranches(
  supabase: Client,
  rows: CsvRow[],
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
    const name = pick(row, 'name', 'branch', 'branch_name');

    if (name.length < 2) {
      issues.push({ line, name: name || '(blank)', problem: 'No branch name in this row.' });
      return;
    }
    if (seen.has(key(name))) {
      issues.push({ line, name, problem: 'The same branch appears earlier in this file.' });
      return;
    }
    seen.add(key(name));

    const rawZone = pick(row, 'zone', 'zone_code').toUpperCase().replace(/[\s-]+/g, '_');
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
      ran: true, preview: true, kind: 'branches', toCreate, toUpdate, issues, ok: true,
      message: `${toCreate.length} to add, ${toUpdate.length} to update, ${issues.length} skipped. Nothing has been written yet — importing writes all of them together or none.`,
    };
  }

  // One call, one transaction. The loop that used to live here made a separate
  // write per row, so anything that stopped it in the middle — a timeout, a
  // closed browser, one row refused — left the database holding half a
  // spreadsheet, with nothing to say which half.
  const payload = planned.map((item) => {
    const year = (k: string) => {
      const n = num(pick(item.row, k));
      return n !== null && n >= 1960 && n <= new Date().getFullYear() + 1 ? String(n) : '';
    };

    return {
      name: item.name,
      slug: slugify(item.name),
      zone_code: item.zone ?? '',
      year_established: year('year_established') || year('year') || year('established'),
      year_refurbished: year('year_refurbished') || year('refurbished'),
      notes: pick(item.row, 'notes', 'note'),
    };
  });

  const { data: result, error } = await supabase.rpc(
    'import_branches' as never,
    { p_rows: payload } as never,
  );

  if (error) return { ...EMPTY, ran: true, kind: 'branches', issues, message: wording(error.message) };

  const counts = (result as unknown as { created: number; updated: number }) ?? { created: 0, updated: 0 };

  revalidatePath('/', 'layout');
  return {
    ran: true, preview: false, kind: 'branches',
    toCreate: [], toUpdate: [], issues, ok: true,
    message: `Done. ${counts.created} branches added, ${counts.updated} updated${issues.length ? `, ${issues.length} skipped before it ran` : ''}.`,
  };
}

async function importStations(
  supabase: Client,
  rows: CsvRow[],
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
    const name = pick(row, 'name', 'station', 'station_name', 'institution');

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
      : pick(row, 'branch', 'branch_name', 'coordinating_branch');
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

    const catName = fixedCategory ?? pick(row, 'category', 'type', 'category_name');
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
      ran: true, preview: true, kind: 'stations', toCreate, toUpdate, issues, ok: true,
      message: `${toCreate.length} to add, ${toUpdate.length} to update, ${issues.length} skipped. Nothing has been written yet — importing writes all of them together or none.`,
    };
  }

  // One call, one transaction — same reasoning as the branches above. Either
  // the whole sheet lands or none of it does.
  const payload = planned.map((item) => ({
    name: item.name,
    branch_id: item.branchId,
    category_id: item.categoryId,
    region_name: pick(item.row, 'region', 'region_name'),
    district_name: pick(item.row, 'district', 'district_name'),
    address: pick(item.row, 'address', 'location'),
    contact_name: pick(item.row, 'contact', 'contact_name'),
    contact_phone: pick(item.row, 'phone', 'contact_phone'),
    portfolio: String(num(pick(item.row, 'portfolio', 'people', 'youth', 'headcount')) ?? ''),
  }));

  const { data: result, error } = await supabase.rpc(
    'import_stations' as never,
    { p_rows: payload } as never,
  );

  if (error) return { ...EMPTY, ran: true, kind: 'stations', issues, message: wording(error.message) };

  const counts = (result as unknown as { created: number; updated: number }) ?? { created: 0, updated: 0 };

  revalidatePath('/', 'layout');
  return {
    ran: true, preview: false, kind: 'stations',
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
