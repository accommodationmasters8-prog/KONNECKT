import { getServerClient } from '@/lib/supabase/server';

/**
 * The tracker's read layer.
 *
 * Every query here runs under the signed-in user's session, so scope is the
 * database's decision: a branch officer's `select *` returns their branch, a
 * zone manager's returns the zone, HQ's returns everything. There is no
 * `where branch_id = ...` in this file, and there must never be one — a filter
 * written here is a filter somebody can forget to write on the next screen.
 *
 * Aggregation happens in TypeScript rather than in SQL because PostgREST does
 * not do GROUP BY, and the volumes are small by construction: hundreds of
 * stations and a few thousand monthly reports. When that stops being true the
 * answer is a view, not a smarter query builder.
 */

export interface TrackerCategory {
  id: string;
  slug: string;
  name_en: string;
  name_sw: string;
  description: string | null;
  member_noun_en: string;
  member_noun_sw: string;
  colour: 'teal' | 'green' | 'gold' | 'pink' | 'ink';
  is_active: boolean;
  display_order: number;
}

export interface CategoryTotals {
  category_id: string;
  slug: string;
  name_en: string;
  name_sw: string;
  colour: TrackerCategory['colour'];
  stations: number;
  active_stations: number;
  portfolio: number;
  accounts_opened: number;
  active_accounts: number;
  dormant_accounts: number;
  deposits_tzs: number;
  loans_count: number;
  loans_value_tzs: number;
  coverage_pct: number | null;
}

export interface StationRow {
  id: string;
  name: string;
  short_name: string | null;
  category_id: string;
  branch_id: string;
  zone_code: string | null;
  address: string | null;
  district_name: string | null;
  status: 'prospect' | 'active' | 'paused' | 'closed';
  portfolio: number | null;
  last_report_month: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_role: string | null;
  notes: string | null;
  created_at: string;
}

export interface StationLatest {
  station_id: string;
  period_month: string;
  portfolio: number;
  accounts_opened: number;
  active_accounts: number;
  dormant_accounts: number;
  deposits_tzs: number;
  loans_count: number;
  loans_value_tzs: number;
  coverage_pct: number | null;
  active_pct: number | null;
  dormancy_pct: number | null;
}

export interface StationReport extends StationLatest {
  id: string;
  note: string | null;
  submitted_at: string;
}

export interface TrackedEvent {
  id: string;
  name: string;
  event_date: string;
  end_date: string | null;
  branch_id: string;
  zone_code: string | null;
  station_id: string | null;
  category_id: string | null;
  venue: string;
  address: string | null;
  participants: number | null;
  budget_tzs: number | null;
  actual_spend_tzs: number | null;
  accounts_opened: number | null;
  deposits_tzs: number | null;
  album_url: string | null;
  notes: string | null;
  created_at: string;
}

/** Every figure the overview shows, in one shape. */
export interface TrackerOverview {
  configured: boolean;
  stations: number;
  activeStations: number;
  portfolio: number;
  accountsOpened: number;
  activeAccounts: number;
  dormantAccounts: number;
  deposits: number;
  loansValue: number;
  loansCount: number;
  coveragePct: number | null;
  dormancyPct: number | null;
  categories: CategoryTotals[];
  /** Oldest to newest, ready to plot. */
  trend: { month: string; deposits: number; accounts: number; stations: number }[];
  reportedThisMonth: number;
  awaitingReport: number;
  events: { total: number; past: number; upcoming: number; participants: number; budget: number };
  recent: ActivityItem[];
}

export interface ActivityItem {
  kind: 'station' | 'report' | 'event';
  id: string;
  title: string;
  detail: string;
  at: string;
}

const EMPTY: TrackerOverview = {
  configured: false,
  stations: 0, activeStations: 0, portfolio: 0,
  accountsOpened: 0, activeAccounts: 0, dormantAccounts: 0,
  deposits: 0, loansValue: 0, loansCount: 0,
  coveragePct: null, dormancyPct: null,
  categories: [], trend: [], reportedThisMonth: 0, awaitingReport: 0,
  events: { total: 0, past: 0, upcoming: 0, participants: 0, budget: 0 },
  recent: [],
};

/** First of the current month, as the reports store it. */
export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export function formatPeriod(period: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    month: 'short', year: 'numeric',
  }).format(new Date(`${period.slice(0, 7)}-01T00:00:00Z`));
}

export async function getCategories(): Promise<TrackerCategory[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from('tracker_categories' as never)
    .select('id, slug, name_en, name_sw, description, member_noun_en, member_noun_sw, colour, is_active, display_order')
    .order('display_order', { ascending: true });

  return (data as unknown as TrackerCategory[]) ?? [];
}

export async function getStations(): Promise<StationRow[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from('stations' as never)
    .select('id, name, short_name, category_id, branch_id, zone_code, address, district_name, status, portfolio, last_report_month, contact_name, contact_phone, contact_email, contact_role, notes, created_at')
    .order('name', { ascending: true })
    .limit(1000);

  return (data as unknown as StationRow[]) ?? [];
}

export async function getStationLatest(): Promise<Map<string, StationLatest>> {
  const supabase = await getServerClient();
  const map = new Map<string, StationLatest>();
  if (!supabase) return map;

  const { data } = await supabase
    .from('station_latest' as never)
    .select('*')
    .limit(1000);

  for (const row of (data as unknown as StationLatest[]) ?? []) {
    map.set(row.station_id, row);
  }
  return map;
}

/**
 * Everything the overview needs, in as few round trips as it can be done in.
 *
 * Not one query per card: a dashboard that fires fourteen requests is a
 * dashboard that takes fourteen round trips to a database in Ireland, and a
 * zone manager on a branch connection feels every one of them.
 */
export async function getTrackerOverview(): Promise<TrackerOverview> {
  const supabase = await getServerClient();
  if (!supabase) return EMPTY;

  const since = new Date();
  since.setMonth(since.getMonth() - 11);
  const from = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-01`;

  const [stationsRes, latestRes, categoryRes, trendRes, eventsRes, recentReportsRes] =
    await Promise.all([
      supabase.from('stations' as never)
        .select('id, name, status, category_id, created_at')
        .limit(2000),
      supabase.from('station_latest' as never).select('*').limit(2000),
      supabase.from('category_totals' as never).select('*'),
      supabase.from('station_reports' as never)
        .select('period_month, deposits_tzs, accounts_opened, station_id')
        .gte('period_month', from)
        .limit(5000),
      supabase.from('tracked_events' as never)
        .select('id, name, event_date, participants, budget_tzs, venue, created_at')
        .order('event_date', { ascending: false })
        .limit(500),
      supabase.from('station_reports' as never)
        .select('id, station_id, period_month, submitted_at, deposits_tzs, accounts_opened')
        .order('submitted_at', { ascending: false })
        .limit(10),
    ]);

  const stations = (stationsRes.data as unknown as
    { id: string; name: string; status: string; category_id: string; created_at: string }[]) ?? [];
  const latest = (latestRes.data as unknown as StationLatest[]) ?? [];
  const categories = (categoryRes.data as unknown as CategoryTotals[]) ?? [];
  const trendRows = (trendRes.data as unknown as
    { period_month: string; deposits_tzs: number; accounts_opened: number; station_id: string }[]) ?? [];
  const events = (eventsRes.data as unknown as
    { id: string; name: string; event_date: string; participants: number | null;
      budget_tzs: number | null; venue: string; created_at: string }[]) ?? [];

  const sum = (pick: (row: StationLatest) => number) =>
    latest.reduce((total, row) => total + Number(pick(row) ?? 0), 0);

  const portfolio = sum((r) => r.portfolio);
  const accountsOpened = sum((r) => r.accounts_opened);
  const dormantAccounts = sum((r) => r.dormant_accounts);

  // One month, one point. Deposits are a level rather than a flow, so the
  // month's figure is the sum of that month's reports, not a running total.
  const byMonth = new Map<string, { deposits: number; accounts: number; stations: Set<string> }>();
  for (const row of trendRows) {
    const key = row.period_month.slice(0, 7);
    const bucket = byMonth.get(key) ?? { deposits: 0, accounts: 0, stations: new Set<string>() };
    bucket.deposits += Number(row.deposits_tzs ?? 0);
    bucket.accounts += Number(row.accounts_opened ?? 0);
    bucket.stations.add(row.station_id);
    byMonth.set(key, bucket);
  }

  const trend = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month, deposits: v.deposits, accounts: v.accounts, stations: v.stations.size,
    }));

  const period = currentPeriod();
  const reportedThisMonth = latest.filter((r) => r.period_month === period).length;

  const today = new Date().toISOString().slice(0, 10);
  const stationName = new Map(stations.map((s) => [s.id, s.name]));

  const recent: ActivityItem[] = [
    ...stations
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6)
      .map((s) => ({
        kind: 'station' as const,
        id: s.id,
        title: s.name,
        detail: 'added to the tracker',
        at: s.created_at,
      })),
    ...((recentReportsRes.data as unknown as
      { id: string; station_id: string; period_month: string; submitted_at: string }[]) ?? [])
      .map((r) => ({
        kind: 'report' as const,
        id: r.id,
        title: stationName.get(r.station_id) ?? 'A station',
        detail: `reported ${r.period_month.slice(0, 7)}`,
        at: r.submitted_at,
      })),
    ...events.slice(0, 6).map((e) => ({
      kind: 'event' as const,
      id: e.id,
      title: e.name,
      detail: `${e.venue} · ${e.event_date}`,
      at: e.created_at,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  return {
    configured: true,
    stations: stations.length,
    activeStations: stations.filter((s) => s.status === 'active').length,
    portfolio,
    accountsOpened,
    activeAccounts: sum((r) => r.active_accounts),
    dormantAccounts,
    deposits: sum((r) => Number(r.deposits_tzs)),
    loansValue: sum((r) => Number(r.loans_value_tzs)),
    loansCount: sum((r) => r.loans_count),
    coveragePct: portfolio > 0 ? Math.round((accountsOpened / portfolio) * 1000) / 10 : null,
    dormancyPct: accountsOpened > 0
      ? Math.round((dormantAccounts / accountsOpened) * 1000) / 10
      : null,
    categories,
    trend,
    reportedThisMonth,
    awaitingReport: Math.max(stations.filter((s) => s.status === 'active').length - reportedThisMonth, 0),
    events: {
      total: events.length,
      past: events.filter((e) => e.event_date < today).length,
      upcoming: events.filter((e) => e.event_date >= today).length,
      participants: events.reduce((n, e) => n + Number(e.participants ?? 0), 0),
      budget: events.reduce((n, e) => n + Number(e.budget_tzs ?? 0), 0),
    },
    recent,
  };
}

/** Money, the way every screen in the tool shows it. */
export function money(value: number, locale: string, compact = false) {
  return new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value);
}

export function count(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ').format(value);
}
