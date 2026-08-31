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
  /** The three channels and the loan book, from the same newest period as
   *  every other figure on the row. */
  simbanking: number;
  cards: number;
  lipaHapa: number;
  loans: number;
  loanValue: number;
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
    .select('station_id, portfolio, accounts_opened, deposits_tzs, coverage_pct, simbanking_activated, cards_issued, lipa_hapa_registered, loans_count, loans_value_tzs')
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
      simbanking: Number(l?.simbanking_activated ?? 0),
      cards: Number(l?.cards_issued ?? 0),
      lipaHapa: Number(l?.lipa_hapa_registered ?? 0),
      loans: Number(l?.loans_count ?? 0),
      loanValue: Number(l?.loans_value_tzs ?? 0),
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

export interface BranchNode {
  id: string;
  name: string;
  zone: string | null;
  stations: number;
  reporting: number;
  portfolio: number;
  accountsOpened: number;
  deposits: number;
  coveragePct: number | null;
}

export interface ZoneNode {
  zone: string;
  label: string;
  branches: BranchNode[];
  stations: number;
  deposits: number;
}

/**
 * The tree: zones own branches, branches own stations.
 *
 * One hierarchy, read once. The console had two — a flat station list and a
 * performance drill-down — which meant a station could be reached by two
 * routes that disagreed about what it belonged to. A branch is the only thing
 * that owns a station (branch_id is NOT NULL on the table), and a zone is
 * derived from the branch by trigger, so this shape is not a presentation
 * choice: it is what the database already enforces.
 *
 * Branches with no stations are included. A branch nobody has added anything
 * to is exactly the branch somebody needs to go and look at.
 */
export async function getBranchTree(): Promise<ZoneNode[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const [branchRes, stationRes] = await Promise.all([
    supabase.from('branches' as never)
      .select('id, name, zone_code')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(2000),
    supabase.from('stations' as never)
      .select('id, branch_id, zone_code, status')
      .limit(5000),
  ]);

  const branches = (branchRes.data as unknown as
    { id: string; name: string; zone_code: string | null }[]) ?? [];
  const stations = (stationRes.data as unknown as
    { id: string; branch_id: string; zone_code: string | null; status: string }[]) ?? [];

  const ids = stations.map((s) => s.id);
  const { data: latestData } = ids.length
    ? await supabase.from('station_latest' as never)
        .select('station_id, period_month, portfolio, accounts_opened, deposits_tzs')
        .in('station_id', ids)
    : { data: [] };

  const latest = new Map(
    ((latestData as unknown as Record<string, unknown>[]) ?? [])
      .map((r) => [r.station_id as string, r]),
  );

  const period = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();

  const byBranch = new Map<string, BranchNode>();
  for (const branch of branches) {
    byBranch.set(branch.id, {
      id: branch.id, name: branch.name, zone: branch.zone_code,
      stations: 0, reporting: 0, portfolio: 0, accountsOpened: 0,
      deposits: 0, coveragePct: null,
    });
  }

  for (const station of stations) {
    // A station whose branch is not in the visible list still counts against
    // its zone — dropping it would make the zone total disagree with the sum
    // of what is shown, which is the kind of thing people stop trusting.
    let node = byBranch.get(station.branch_id);
    if (!node) {
      node = {
        id: station.branch_id, name: 'Unnamed branch', zone: station.zone_code,
        stations: 0, reporting: 0, portfolio: 0, accountsOpened: 0,
        deposits: 0, coveragePct: null,
      };
      byBranch.set(station.branch_id, node);
    }

    node.stations += 1;
    const l = latest.get(station.id);
    if (l) {
      node.portfolio += Number(l.portfolio ?? 0);
      node.accountsOpened += Number(l.accounts_opened ?? 0);
      node.deposits += Number(l.deposits_tzs ?? 0);
      if (String(l.period_month) === period) node.reporting += 1;
    }
  }

  const zones = new Map<string, ZoneNode>();
  for (const branch of byBranch.values()) {
    branch.coveragePct = branch.portfolio > 0
      ? Math.round((branch.accountsOpened / branch.portfolio) * 1000) / 10
      : null;

    const key = branch.zone ?? 'UNASSIGNED';
    if (!zones.has(key)) {
      zones.set(key, {
        zone: key,
        label: key === 'UNASSIGNED' ? 'No zone assigned' : zoneWording(key),
        branches: [], stations: 0, deposits: 0,
      });
    }
    const zone = zones.get(key)!;
    zone.branches.push(branch);
    zone.stations += branch.stations;
    zone.deposits += branch.deposits;
  }

  for (const zone of zones.values()) {
    zone.branches.sort((a, b) => b.deposits - a.deposits || a.name.localeCompare(b.name));
  }

  return [...zones.values()].sort((a, b) => {
    // Unassigned last: it is a to-do list, not a zone.
    if (a.zone === 'UNASSIGNED') return 1;
    if (b.zone === 'UNASSIGNED') return -1;
    return b.deposits - a.deposits;
  });
}

export interface AccountTypeSlice {
  code: string;
  label: string;
  opened: number;
  active: number;
  dormant: number;
  deposits: number;
}

/**
 * Accounts opened, split by the type of account.
 *
 * The total says how many were opened; this says what they were. A branch that
 * opened 800 accounts entirely on one product has a different conversation
 * ahead of it from one spread across five, and the total alone cannot tell
 * them apart.
 *
 * Read from the newest report each station filed, so it lines up with every
 * other figure on the same screen rather than quietly summing a different set
 * of months. Scope comes from row level security as everywhere else.
 */
export async function getAccountTypeBreakdown(
  opts: { branchId?: string; zone?: string; categoryId?: string } = {},
): Promise<AccountTypeSlice[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  let stationQuery = supabase.from('stations' as never)
    .select('id, branch_id, zone_code, category_id')
    .limit(5000);
  if (opts.branchId) stationQuery = stationQuery.eq('branch_id', opts.branchId);
  if (opts.categoryId) stationQuery = stationQuery.eq('category_id', opts.categoryId);

  const { data: stationData } = await stationQuery;
  let stations = (stationData as unknown as
    { id: string; branch_id: string; zone_code: string | null }[]) ?? [];
  if (opts.zone) stations = stations.filter((s) => s.zone_code === opts.zone);

  const ids = stations.map((s) => s.id);
  if (ids.length === 0) return [];

  // The newest filed period per station, which is the same set every other
  // figure on these screens is drawn from.
  const { data: latestData } = await supabase
    .from('station_latest' as never)
    .select('station_id, report_id')
    .in('station_id', ids);

  const reportIds = ((latestData as unknown as
    { report_id: string | null }[]) ?? [])
    .map((r) => r.report_id)
    .filter((r): r is string => Boolean(r));

  if (reportIds.length === 0) return [];

  const [{ data: splitData }, { data: productData }] = await Promise.all([
    supabase.from('station_report_accounts' as never)
      .select('report_id, product_code, opened, active, dormant, deposits_tzs')
      .in('report_id', reportIds)
      .limit(20000),
    supabase.from('account_products' as never)
      .select('code, label_en, display_order')
      .order('display_order', { ascending: true })
      .limit(200),
  ]);

  const label = new Map(
    ((productData as unknown as { code: string; label_en: string }[]) ?? [])
      .map((p) => [p.code, p.label_en]),
  );

  const out = new Map<string, AccountTypeSlice>();
  for (const row of (splitData as unknown as {
    product_code: string; opened: number; active: number;
    dormant: number; deposits_tzs: number;
  }[]) ?? []) {
    if (!out.has(row.product_code)) {
      out.set(row.product_code, {
        code: row.product_code,
        label: label.get(row.product_code) ?? row.product_code,
        opened: 0, active: 0, dormant: 0, deposits: 0,
      });
    }
    const slice = out.get(row.product_code)!;
    slice.opened += Number(row.opened ?? 0);
    slice.active += Number(row.active ?? 0);
    slice.dormant += Number(row.dormant ?? 0);
    slice.deposits += Number(row.deposits_tzs ?? 0);
  }

  return [...out.values()].sort((a, b) => b.opened - a.opened);
}
