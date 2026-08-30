import { getServerClient } from '@/lib/supabase/server';

/**
 * The network view: how zones compare, and how the branches inside one compare.
 *
 * Everything here reads through the same row level security as the rest of the
 * console, so the aggregation is honest about scope without ever filtering by
 * scope: HQ's query returns every zone, a zone manager's returns theirs, a
 * branch officer's returns the one row that is their branch. There is no
 * `where zone = ...` in this file and there must never be one.
 *
 * Aggregation happens here rather than in SQL because PostgREST does not do
 * GROUP BY and the volumes are small by construction — tens of zones, hundreds
 * of branches, a few thousand monthly rows.
 */

export interface Performer {
  key: string;
  name: string;
  /** Branches inside a zone; null on a branch row, which has none. */
  branches: number | null;
  stations: number;
  reporting: number;
  portfolio: number;
  accountsOpened: number;
  activeAccounts: number;
  dormantAccounts: number;
  deposits: number;
  loansCount: number;
  loansValue: number;
  coveragePct: number | null;
  /** Change in deposits against the month before, as a percentage. */
  momPct: number | null;
}

interface StationRow {
  id: string;
  name: string;
  zone_code: string | null;
  branch_id: string;
  status: string;
}

interface ReportRow {
  station_id: string;
  period_month: string;
  portfolio: number;
  accounts_opened: number;
  active_accounts: number;
  dormant_accounts: number;
  deposits_tzs: number;
  loans_count: number;
  loans_value_tzs: number;
}

export interface BranchStation {
  id: string;
  name: string;
  category: string;
  status: string;
  portfolio: number;
  accountsOpened: number;
  deposits: number;
  coveragePct: number | null;
  lastReport: string | null;
}

export interface NetworkView {
  /** Zones when HQ is signed in, branches otherwise. */
  rows: Performer[];
  /** What the rows are, for the heading. */
  level: 'zone' | 'branch';
  latestMonth: string | null;
  previousMonth: string | null;
  totals: Performer | null;
}

const EMPTY: Omit<Performer, 'key' | 'name'> = {
  branches: null, stations: 0, reporting: 0, portfolio: 0, accountsOpened: 0,
  activeAccounts: 0, dormantAccounts: 0, deposits: 0, loansCount: 0,
  loansValue: 0, coveragePct: null, momPct: null,
};

function finish(p: Performer): Performer {
  return {
    ...p,
    coveragePct: p.portfolio > 0
      ? Math.round((p.accountsOpened / p.portfolio) * 1000) / 10
      : null,
  };
}

export function zoneWording(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Compare the level below the one signed in.
 *
 * HQ compares zones; a zone manager compares the branches under them; a branch
 * officer sees a single row, which is their own — not useless, because the
 * KPIs beside it are the same ones their zone is reading.
 *
 * `zone` narrows HQ to one zone's branches, which is the drill-down: HQ opens
 * the country, picks a zone, and gets that zone's branch table.
 */
export async function getNetwork(
  role: string,
  zone?: string,
): Promise<NetworkView> {
  const supabase = await getServerClient();
  const groupByZone = role === 'hq' && !zone;

  if (!supabase) {
    return { rows: [], level: groupByZone ? 'zone' : 'branch', latestMonth: null, previousMonth: null, totals: null };
  }

  const since = new Date();
  since.setMonth(since.getMonth() - 2);
  const from = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-01`;

  const [stationRes, branchRes] = await Promise.all([
    supabase.from('stations' as never)
      .select('id, name, zone_code, branch_id, status')
      .limit(5000),
    supabase.from('branches' as never)
      .select('id, name, zone_code')
      .limit(1000),
  ]);

  let stations = (stationRes.data as unknown as StationRow[]) ?? [];
  const branches = (branchRes.data as unknown as
    { id: string; name: string; zone_code: string | null }[]) ?? [];

  // The drill-down. Narrowing to a zone HQ may already reach is a display
  // choice, not an authorisation one — RLS decided the set above.
  if (zone) stations = stations.filter((s) => s.zone_code === zone);

  const ids = stations.map((s) => s.id);
  const { data: reportData } = ids.length
    ? await supabase.from('station_reports' as never)
        .select('station_id, period_month, portfolio, accounts_opened, active_accounts, dormant_accounts, deposits_tzs, loans_count, loans_value_tzs')
        .in('station_id', ids)
        .gte('period_month', from)
        .limit(20000)
    : { data: [] };

  const reports = (reportData as unknown as ReportRow[]) ?? [];

  const months = [...new Set(reports.map((r) => r.period_month))].sort();
  const latestMonth = months.at(-1) ?? null;
  const previousMonth = months.at(-2) ?? null;

  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const branchZone = new Map(branches.map((b) => [b.id, b.zone_code]));

  const keyOf = (s: StationRow) =>
    groupByZone ? (s.zone_code ?? branchZone.get(s.branch_id) ?? 'UNASSIGNED') : s.branch_id;
  const nameOf = (s: StationRow) =>
    groupByZone
      ? zoneWording(s.zone_code ?? branchZone.get(s.branch_id) ?? 'Unassigned')
      : (branchName.get(s.branch_id) ?? 'Unknown branch');

  const rows = new Map<string, Performer>();
  const branchesSeen = new Map<string, Set<string>>();
  const prevDeposits = new Map<string, number>();

  for (const station of stations) {
    const key = keyOf(station);
    if (!rows.has(key)) {
      rows.set(key, { key, name: nameOf(station), ...EMPTY });
      branchesSeen.set(key, new Set());
    }
    const row = rows.get(key)!;
    row.stations += 1;
    branchesSeen.get(key)!.add(station.branch_id);
  }

  const stationKey = new Map(stations.map((s) => [s.id, keyOf(s)]));

  for (const report of reports) {
    const key = stationKey.get(report.station_id);
    if (!key) continue;
    const row = rows.get(key);
    if (!row) continue;

    if (report.period_month === latestMonth) {
      row.reporting += 1;
      row.portfolio += Number(report.portfolio);
      row.accountsOpened += Number(report.accounts_opened);
      row.activeAccounts += Number(report.active_accounts);
      row.dormantAccounts += Number(report.dormant_accounts);
      row.deposits += Number(report.deposits_tzs);
      row.loansCount += Number(report.loans_count);
      row.loansValue += Number(report.loans_value_tzs);
    } else if (report.period_month === previousMonth) {
      prevDeposits.set(key, (prevDeposits.get(key) ?? 0) + Number(report.deposits_tzs));
    }
  }

  const out = [...rows.values()].map((row) => {
    const before = prevDeposits.get(row.key) ?? 0;
    return finish({
      ...row,
      branches: groupByZone ? branchesSeen.get(row.key)!.size : null,
      momPct: before > 0
        ? Math.round(((row.deposits - before) / before) * 1000) / 10
        : null,
    });
  }).sort((a, b) => b.deposits - a.deposits);

  const totals = out.length
    ? finish(out.reduce<Performer>((acc, r) => ({
        ...acc,
        stations: acc.stations + r.stations,
        reporting: acc.reporting + r.reporting,
        portfolio: acc.portfolio + r.portfolio,
        accountsOpened: acc.accountsOpened + r.accountsOpened,
        activeAccounts: acc.activeAccounts + r.activeAccounts,
        dormantAccounts: acc.dormantAccounts + r.dormantAccounts,
        deposits: acc.deposits + r.deposits,
        loansCount: acc.loansCount + r.loansCount,
        loansValue: acc.loansValue + r.loansValue,
      }), { key: 'all', name: 'All', ...EMPTY }))
    : null;

  return {
    rows: out,
    level: groupByZone ? 'zone' : 'branch',
    latestMonth,
    previousMonth,
    totals,
  };
}

export interface CategorySlice {
  key: string;
  name: string;
  colour: string;
  stations: number;
  portfolio: number;
  accountsOpened: number;
  deposits: number;
  coveragePct: number | null;
}

/**
 * The stations inside one branch.
 *
 * The bottom of the drill-down: HQ opens the country, picks a zone, picks a
 * branch, and arrives at the actual places. Without this the trail stops at a
 * branch name and a total, which is the level at which nobody can do anything.
 */
export async function getBranchStations(branchId: string): Promise<BranchStation[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const [stationRes, catRes] = await Promise.all([
    supabase.from('stations' as never)
      .select('id, name, category_id, status, last_report_month')
      .eq('branch_id', branchId)
      .order('name', { ascending: true })
      .limit(2000),
    supabase.from('tracker_categories' as never).select('id, name_en').limit(200),
  ]);

  const stations = (stationRes.data as unknown as
    { id: string; name: string; category_id: string; status: string;
      last_report_month: string | null }[]) ?? [];
  if (stations.length === 0) return [];

  const catName = new Map(
    ((catRes.data as unknown as { id: string; name_en: string }[]) ?? [])
      .map((c) => [c.id, c.name_en]),
  );

  const { data: latestData } = await supabase
    .from('station_latest' as never)
    .select('station_id, portfolio, accounts_opened, deposits_tzs, coverage_pct')
    .in('station_id', stations.map((s) => s.id));

  const latest = new Map(
    ((latestData as unknown as Record<string, unknown>[]) ?? [])
      .map((r) => [r.station_id as string, r]),
  );

  return stations.map((station) => {
    const l = latest.get(station.id);
    return {
      id: station.id,
      name: station.name,
      category: catName.get(station.category_id) ?? '—',
      status: station.status,
      portfolio: Number(l?.portfolio ?? 0),
      accountsOpened: Number(l?.accounts_opened ?? 0),
      deposits: Number(l?.deposits_tzs ?? 0),
      coveragePct: l?.coverage_pct === null || l?.coverage_pct === undefined
        ? null : Number(l.coverage_pct),
      lastReport: station.last_report_month,
    };
  }).sort((a, b) => b.deposits - a.deposits);
}

/**
 * How one zone or branch divides by category.
 *
 * The performance table answers "who"; this answers "on what". A branch three
 * places off the bottom on deposits with 70% of its book in one category is a
 * different problem from one spread evenly, and the ranking alone cannot tell
 * them apart.
 *
 * Scope comes from row level security as everywhere else — passing a zone or
 * branch narrows what is displayed, never what may be read.
 */
export async function getCategoryBreakdown(
  opts: { zone?: string; branchId?: string } = {},
): Promise<CategorySlice[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const [stationRes, catRes] = await Promise.all([
    supabase.from('stations' as never)
      .select('id, category_id, zone_code, branch_id')
      .limit(5000),
    supabase.from('tracker_categories' as never)
      .select('id, name_en, colour')
      .order('display_order', { ascending: true })
      .limit(100),
  ]);

  let stations = (stationRes.data as unknown as
    { id: string; category_id: string; zone_code: string | null; branch_id: string }[]) ?? [];

  if (opts.zone) stations = stations.filter((s) => s.zone_code === opts.zone);
  if (opts.branchId) stations = stations.filter((s) => s.branch_id === opts.branchId);

  const ids = stations.map((s) => s.id);
  if (ids.length === 0) return [];

  const { data: latestData } = await supabase
    .from('station_latest' as never)
    .select('station_id, portfolio, accounts_opened, deposits_tzs')
    .in('station_id', ids);

  const latest = new Map(
    ((latestData as unknown as
      { station_id: string; portfolio: number; accounts_opened: number; deposits_tzs: number }[]) ?? [])
      .map((r) => [r.station_id, r]),
  );

  const categories = (catRes.data as unknown as
    { id: string; name_en: string; colour: string }[]) ?? [];
  const byId = new Map(categories.map((c) => [c.id, c]));

  const out = new Map<string, CategorySlice>();
  for (const station of stations) {
    const category = byId.get(station.category_id);
    if (!category) continue;
    if (!out.has(category.id)) {
      out.set(category.id, {
        key: category.id, name: category.name_en, colour: category.colour,
        stations: 0, portfolio: 0, accountsOpened: 0, deposits: 0, coveragePct: null,
      });
    }
    const row = out.get(category.id)!;
    row.stations += 1;

    const l = latest.get(station.id);
    if (l) {
      row.portfolio += Number(l.portfolio);
      row.accountsOpened += Number(l.accounts_opened);
      row.deposits += Number(l.deposits_tzs);
    }
  }

  return [...out.values()]
    .map((row) => ({
      ...row,
      coveragePct: row.portfolio > 0
        ? Math.round((row.accountsOpened / row.portfolio) * 1000) / 10
        : null,
    }))
    .sort((a, b) => b.deposits - a.deposits);
}
