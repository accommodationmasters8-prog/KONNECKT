import { getPublicClient, getServerClient } from '@/lib/supabase/server';
import { mapRegionName } from '@/lib/tanzania-map';

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
  /** The three channels the bank is actually judged on, per category. They
   *  were already on every report and already summed per zone and branch;
   *  this is the level at which "which kind of place activates SimBanking"
   *  becomes answerable. */
  simbanking_activated: number;
  cards_issued: number;
  lipa_hapa_registered: number;
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
  /** What turned the accounts into customers. Zero, never null: a period
   *  that reported nothing on a channel reported nothing, which is a fact. */
  simbanking_activated: number;
  cards_issued: number;
  lipa_hapa_registered: number;
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
  simbanking_activated: number | null;
  cards_issued: number | null;
  lipa_hapa_registered: number | null;
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
  /** Structure, not performance: how much there is to look at. */
  totalCategories: number;
  totalBranches: number;
  branchesReporting: number;
  zonesCovered: number;
  simbanking: number;
  cardsIssued: number;
  lipaHapa: number;
  /** Named, not counted: a count is a status, a name is the next click. */
  due: { id: string; name: string; lastReport: string | null }[];
  events: { total: number; past: number; upcoming: number; participants: number; budget: number };
  /** The next few and the last few, for the overview's own panel. */
  eventList: OverviewEvent[];
  recent: ActivityItem[];
}

export interface OverviewEvent {
  id: string;
  name: string;
  event_date: string;
  venue: string;
  participants: number | null;
  accounts_opened: number | null;
  past: boolean;
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
  categories: [], trend: [], reportedThisMonth: 0, awaitingReport: 0, due: [],
  totalCategories: 0, totalBranches: 0, branchesReporting: 0, zonesCovered: 0,
  simbanking: 0, cardsIssued: 0, lipaHapa: 0,
  events: { total: 0, past: 0, upcoming: 0, participants: 0, budget: 0 },
  eventList: [],
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
        .select('id, name, status, category_id, branch_id, zone_code, created_at')
        .limit(2000),
      supabase.from('station_latest' as never).select('*').limit(2000),
      supabase.from('category_totals' as never).select('*'),
      supabase.from('station_reports' as never)
        .select('period_month, deposits_tzs, accounts_opened, station_id')
        .gte('period_month', from)
        .limit(5000),
      supabase.from('tracked_events' as never)
        .select('id, name, event_date, participants, budget_tzs, accounts_opened, venue, created_at')
        .order('event_date', { ascending: false })
        .limit(500),
      supabase.from('station_reports' as never)
        .select('id, station_id, period_month, submitted_at, deposits_tzs, accounts_opened')
        .order('submitted_at', { ascending: false })
        .limit(10),
    ]);

  const stations = (stationsRes.data as unknown as
    { id: string; name: string; status: string; category_id: string;
      branch_id: string; zone_code: string | null; created_at: string }[]) ?? [];
  const latest = (latestRes.data as unknown as StationLatest[]) ?? [];
  const categories = (categoryRes.data as unknown as CategoryTotals[]) ?? [];
  const trendRows = (trendRes.data as unknown as
    { period_month: string; deposits_tzs: number; accounts_opened: number; station_id: string }[]) ?? [];
  const events = (eventsRes.data as unknown as
    { id: string; name: string; event_date: string; participants: number | null;
      budget_tzs: number | null; accounts_opened: number | null; venue: string;
      created_at: string }[]) ?? [];

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

  // Active stations with nothing filed for the current period. Named rather
  // than counted, because the next thing anybody does with this list is open
  // one of them.
  const filedThisPeriod = new Set(
    latest.filter((r) => r.period_month === period).map((r) => r.station_id),
  );
  const lastReportOf = new Map(latest.map((r) => [r.station_id, r.period_month]));

  const due = stations
    .filter((s) => s.status === 'active' && !filedThisPeriod.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      lastReport: lastReportOf.get(s.id) ?? null,
    }))
    // Never-filed first: those are the ones nobody is watching.
    .sort((a, b) => {
      if (!a.lastReport && b.lastReport) return -1;
      if (a.lastReport && !b.lastReport) return 1;
      return (a.lastReport ?? '').localeCompare(b.lastReport ?? '');
    });

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
    due,
    totalCategories: categories.length,
    // Branches and zones that actually have something in them: a count of
    // every branch in the register would say 252 and mean nothing.
    totalBranches: new Set(stations.map((s) => s.branch_id)).size,
    branchesReporting: new Set(
      latest
        .filter((r) => r.period_month === period)
        .map((r) => stations.find((s) => s.id === r.station_id)?.branch_id)
        .filter(Boolean),
    ).size,
    zonesCovered: new Set(stations.map((s) => s.zone_code).filter(Boolean)).size,
    simbanking: latest.reduce((a, r) => a + Number(
      (r as unknown as { simbanking_activated?: number }).simbanking_activated ?? 0), 0),
    cardsIssued: latest.reduce((a, r) => a + Number(
      (r as unknown as { cards_issued?: number }).cards_issued ?? 0), 0),
    lipaHapa: latest.reduce((a, r) => a + Number(
      (r as unknown as { lipa_hapa_registered?: number }).lipa_hapa_registered ?? 0), 0),
    awaitingReport: Math.max(stations.filter((s) => s.status === 'active').length - reportedThisMonth, 0),
    // The three closest on each side of today: what just happened and what is
    // about to. A list ordered purely by date puts next year's event above
    // last week's, which is the wrong end of the diary to lead with.
    eventList: (() => {
      const now = Date.now();
      const shape = (e: typeof events[number]) => ({
        id: e.id, name: e.name, event_date: e.event_date, venue: e.venue,
        participants: e.participants, accounts_opened: e.accounts_opened,
        past: new Date(e.event_date).getTime() < now,
      });
      const upcoming = events
        .filter((e) => new Date(e.event_date).getTime() >= now)
        .sort((a, b) => a.event_date.localeCompare(b.event_date))
        .slice(0, 3);
      const past = events
        .filter((e) => new Date(e.event_date).getTime() < now)
        .slice(0, 3);
      return [...upcoming, ...past].map(shape);
    })(),
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

export interface StationPin {
  id: string;
  region_name: string | null;
  district_name: string | null;
  zone_code: string | null;
}

export interface MapRegionRow {
  /** The map's own name for the region, so a row and a shape are the same
   *  thing. The register's spellings live in `sources`. */
  region: string;
  stations: number;
  districts: string[];
  zone: string | null;
  /** What the register called it, where that differs from the map. */
  sources: string[];
  /** False when nothing on the map matches, so the row is listed but not
   *  drawn rather than pinned somewhere plausible. */
  onMap: boolean;
}

export interface MapZoneRow {
  zone: string;
  stations: number;
  regions: number;
}

export interface PublicMapData {
  stations: number;
  regions: MapRegionRow[];
  zones: MapZoneRow[];
  districts: number;
}

/**
 * The public map, which is geography and nothing else.
 *
 * Presence is worth publishing: the country CRDB reaches is a fact about
 * CRDB, and a staff member should be able to open it on a phone with no
 * password. Identity is not. The view this reads carries no station name and
 * no category — those two columns together are the target list, and it was
 * being served to anonymous callers until this release.
 *
 * Read with the publishable key rather than the request's session, so the
 * page stays prerenderable: a cookie read here would make it dynamic for
 * every visitor.
 */
export async function getPublicMapData(): Promise<PublicMapData> {
  const supabase = getPublicClient();
  if (!supabase) return { stations: 0, regions: [], zones: [], districts: 0 };

  const { data } = await supabase
    .from('public_station_pins' as never)
    .select('id, region_name, district_name, zone_code')
    .limit(5000);

  const pins = (data as unknown as StationPin[]) ?? [];

  const byRegion = new Map<string, MapRegionRow>();
  const byZone = new Map<string, { stations: number; regions: Set<string> }>();
  const districts = new Set<string>();

  for (const pin of pins) {
    const raw = pin.region_name?.trim() ?? '';
    const canonical = mapRegionName(raw);
    const region = canonical
      ?? (raw ? raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unrecorded');

    if (!byRegion.has(region)) {
      byRegion.set(region, {
        region, stations: 0, districts: [], zone: pin.zone_code,
        sources: [], onMap: canonical !== null,
      });
    }
    const row = byRegion.get(region)!;
    row.stations += 1;
    if (raw && raw !== region && !row.sources.includes(raw)) row.sources.push(raw);
    if (pin.district_name && !row.districts.includes(pin.district_name)) {
      row.districts.push(pin.district_name);
    }
    // A region's zone is whatever its first station's branch says. They agree
    // in practice — a region sits in one zone — and where they would not, the
    // first answer is as good as an argument the map cannot settle.
    if (!row.zone) row.zone = pin.zone_code;

    if (pin.district_name) districts.add(pin.district_name);

    const zoneKey = pin.zone_code ?? 'UNASSIGNED';
    if (!byZone.has(zoneKey)) byZone.set(zoneKey, { stations: 0, regions: new Set() });
    const zone = byZone.get(zoneKey)!;
    zone.stations += 1;
    zone.regions.add(region);
  }

  for (const row of byRegion.values()) {
    row.districts.sort();
    row.sources.sort();
  }

  return {
    stations: pins.length,
    districts: districts.size,
    regions: [...byRegion.values()]
      .sort((a, b) => b.stations - a.stations || a.region.localeCompare(b.region)),
    zones: [...byZone.entries()]
      .map(([zone, z]) => ({ zone, stations: z.stations, regions: z.regions.size }))
      .sort((a, b) => b.stations - a.stations),
  };
}

export interface StaffMapRegion {
  region: string;
  stations: number;
  districts: string[];
  categories: { name: string; stations: number }[];
  accountsOpened: number;
  deposits: number;
  reporting: number;
}

/**
 * The same map, for somebody who has signed in.
 *
 * One page, two depths. The public tier answers "where is CRDB" and stops;
 * this adds the three things that make it a working screen — what kind of
 * place, how much has been opened there, and how many of those stations have
 * actually filed. Splitting them into two pages would guarantee that one of
 * them eventually shows a different national total from the other.
 *
 * Read through the request's own session, so row level security decides the
 * scope: HQ gets the country, a zone manager gets their zone, a branch
 * officer gets their branch. There is no zone filter in this function and
 * there must never be one.
 */
export async function getStaffMapRegions(): Promise<StaffMapRegion[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const [stationRes, catRes] = await Promise.all([
    supabase.from('stations' as never)
      .select('id, region_name, district_name, category_id, status')
      .eq('status', 'active')
      .limit(5000),
    supabase.from('tracker_categories' as never).select('id, name_en').limit(200),
  ]);

  const stations = (stationRes.data as unknown as {
    id: string; region_name: string | null; district_name: string | null;
    category_id: string;
  }[]) ?? [];
  if (stations.length === 0) return [];

  const catName = new Map(
    ((catRes.data as unknown as { id: string; name_en: string }[]) ?? [])
      .map((c) => [c.id, c.name_en]),
  );

  const { data: latestData } = await supabase
    .from('station_latest' as never)
    .select('station_id, accounts_opened, deposits_tzs')
    .in('station_id', stations.map((s) => s.id));

  const latest = new Map(
    ((latestData as unknown as
      { station_id: string; accounts_opened: number; deposits_tzs: number }[]) ?? [])
      .map((r) => [r.station_id, r]),
  );

  const byRegion = new Map<string, StaffMapRegion & { cats: Map<string, number> }>();

  for (const station of stations) {
    const raw = station.region_name?.trim() ?? '';
    const region = mapRegionName(raw)
      ?? (raw ? raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unrecorded');
    if (!byRegion.has(region)) {
      byRegion.set(region, {
        region, stations: 0, districts: [], categories: [],
        accountsOpened: 0, deposits: 0, reporting: 0,
        cats: new Map(),
      });
    }
    const row = byRegion.get(region)!;
    row.stations += 1;
    if (station.district_name && !row.districts.includes(station.district_name)) {
      row.districts.push(station.district_name);
    }

    const name = catName.get(station.category_id) ?? 'Uncategorised';
    row.cats.set(name, (row.cats.get(name) ?? 0) + 1);

    const l = latest.get(station.id);
    if (l) {
      row.reporting += 1;
      row.accountsOpened += Number(l.accounts_opened ?? 0);
      row.deposits += Number(l.deposits_tzs ?? 0);
    }
  }

  return [...byRegion.values()]
    .map(({ cats, ...row }) => ({
      ...row,
      districts: row.districts.sort(),
      categories: [...cats.entries()]
        .map(([name, n]) => ({ name, stations: n }))
        .sort((a, b) => b.stations - a.stations),
    }))
    .sort((a, b) => b.stations - a.stations || a.region.localeCompare(b.region));
}
