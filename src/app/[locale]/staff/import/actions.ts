'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';
import { parseCsvRows, pick, num, type CsvRow } from '@/lib/csv';

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
  let text = String(form.get('pasted') ?? '');
  if (file instanceof File && file.size > 0) {
    if (file.size > 4_000_000) {
      return { ...EMPTY, ran: true, message: 'That file is over 4MB. Split it, or paste the rows instead.' };
    }
    if (/\.xlsx?$/i.test(file.name)) {
      return {
        ...EMPTY, ran: true,
        message: `${file.name} is an Excel workbook, which this cannot read directly. In Excel: File → Save As → CSV UTF-8, then upload that. Nothing else changes.`,
      };
    }
    text = await file.text();
  }

  if (text.trim() === '') {
    return { ...EMPTY, ran: true, message: 'Upload a CSV or paste the rows.' };
  }

  const { rows } = parseCsvRows(text);
  if (rows.length === 0) {
    return { ...EMPTY, ran: true, message: 'That file has a header and no rows.' };
  }
  if (rows.length > 2000) {
    return { ...EMPTY, ran: true, message: `${rows.length} rows is more than one import should carry. Split it into files of 2000 or fewer.` };
  }

  return kind === 'branches'
    ? importBranches(supabase, rows, commit, session.role, session.zone)
    : importStations(supabase, rows, commit);
}

type Client = NonNullable<Awaited<ReturnType<typeof getServerClient>>>;

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
      message: `${toCreate.length} to add, ${toUpdate.length} to update, ${issues.length} skipped. Nothing has been written yet.`,
    };
  }

  let created = 0;
  let updated = 0;
  const failures: ImportIssue[] = [...issues];

  for (const item of planned) {
    const year = (k: string) => {
      const n = num(pick(item.row, k));
      return n !== null && n >= 1960 && n <= new Date().getFullYear() + 1 ? n : null;
    };

    const payload = {
      name: item.name,
      zone_code: item.zone,
      year_established: year('year_established') ?? year('year') ?? year('established'),
      year_refurbished: year('year_refurbished') ?? year('refurbished'),
      is_active: true,
      notes: pick(item.row, 'notes', 'note') || null,
    };

    const { error } = item.existingId
      ? await supabase.from('branches' as never).update(payload as never).eq('id', item.existingId)
      : await supabase.from('branches' as never)
          .insert({ ...payload, slug: slugify(item.name) } as never);

    if (error) {
      failures.push({
        line: item.line, name: item.name,
        problem: error.message.includes('row-level security')
          ? 'Outside what your account can write to.'
          : error.message,
      });
    } else if (item.existingId) updated += 1;
    else created += 1;
  }

  revalidatePath('/', 'layout');
  return {
    ran: true, preview: false, kind: 'branches',
    toCreate: [], toUpdate: [], issues: failures, ok: true,
    message: `Added ${created} branches, updated ${updated}${failures.length ? `, skipped ${failures.length}` : ''}.`,
  };
}

async function importStations(
  supabase: Client,
  rows: CsvRow[],
  commit: boolean,
): Promise<ImportResult> {
  const [{ data: branchRows }, { data: catRows }, { data: stationRows }] = await Promise.all([
    supabase.from('branches' as never).select('id, name').limit(5000),
    supabase.from('tracker_categories' as never)
      .select('id, slug, name_en').eq('is_active', true).limit(100),
    supabase.from('stations' as never).select('id, name, branch_id').limit(5000),
  ]);

  const branches = new Map(
    ((branchRows as unknown as { id: string; name: string }[]) ?? [])
      .map((b) => [key(b.name), b.id]),
  );
  const categories = new Map<string, string>();
  for (const c of (catRows as unknown as { id: string; slug: string; name_en: string }[]) ?? []) {
    categories.set(key(c.name_en), c.id);
    categories.set(key(c.slug.replace(/-/g, ' ')), c.id);
    categories.set(key(c.slug), c.id);
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

    const branchName = pick(row, 'branch', 'branch_name', 'coordinating_branch');
    const branchId = branches.get(key(branchName));
    if (!branchId) {
      issues.push({
        line, name,
        problem: branchName
          ? `No branch called "${branchName}". Import the branches first, or correct the spelling.`
          : 'No branch in this row. Every station belongs to exactly one.',
      });
      return;
    }

    const catName = pick(row, 'category', 'type', 'category_name');
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
    const detail = `${branchName} · ${catName}`;

    if (found) { toUpdate.push({ line, name, detail }); planned.push({ line, row, name, branchId, categoryId, existingId: found }); }
    else { toCreate.push({ line, name, detail }); planned.push({ line, row, name, branchId, categoryId }); }
  });

  if (!commit) {
    return {
      ran: true, preview: true, kind: 'stations', toCreate, toUpdate, issues, ok: true,
      message: `${toCreate.length} to add, ${toUpdate.length} to update, ${issues.length} skipped. Nothing has been written yet.`,
    };
  }

  let created = 0;
  let updated = 0;
  const failures: ImportIssue[] = [...issues];

  for (const item of planned) {
    const payload = {
      name: item.name,
      branch_id: item.branchId,
      category_id: item.categoryId,
      region_name: pick(item.row, 'region', 'region_name') || null,
      district_name: pick(item.row, 'district', 'district_name') || null,
      address: pick(item.row, 'address', 'location') || null,
      contact_name: pick(item.row, 'contact', 'contact_name') || null,
      contact_phone: pick(item.row, 'phone', 'contact_phone') || null,
      portfolio: num(pick(item.row, 'portfolio', 'people', 'youth', 'headcount')) ?? 0,
      status: 'active',
    };

    const { error } = item.existingId
      ? await supabase.from('stations' as never).update(payload as never).eq('id', item.existingId)
      : await supabase.from('stations' as never).insert(payload as never);

    if (error) {
      failures.push({
        line: item.line, name: item.name,
        problem: error.message.includes('row-level security')
          ? 'Outside what your account can write to.'
          : error.message,
      });
    } else if (item.existingId) updated += 1;
    else created += 1;
  }

  revalidatePath('/', 'layout');
  return {
    ran: true, preview: false, kind: 'stations',
    toCreate: [], toUpdate: [], issues: failures, ok: true,
    message: `Added ${created} stations, updated ${updated}${failures.length ? `, skipped ${failures.length}` : ''}.`,
  };
}
