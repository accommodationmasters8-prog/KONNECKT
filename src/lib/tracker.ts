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
  /** What branches booked, and what came of it. */
  bookings: number;
  leadsExpected: number;
  leadsGot: number;
  /** How many stations still owe this month's figures. */
  dueCount: number;
  /* A handful of names for the bar; the count above is the real figure. With
     sixteen thousand institutions, naming them all was the page's slowest
     part and nobody read past the first line of it. */
  due: { id: string; name: string; lastReport: string | null }[];
  events: {
    total: number; past: number; upcoming: number;
    participants: number; budget: number; spend: number;
  };
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
  categories: [], trend: [], reportedThisMonth: 0, awaitingReport: 0,
  dueCount: 0, due: [],
  totalCategories: 0, totalBranches: 0, branchesReporting: 0, zonesCovered: 0,
  simbanking: 0, cardsIssued: 0, lipaHapa: 0,
  bookings: 0, leadsExpected: 0, leadsGot: 0,
  events: { total: 0, past: 0, upcoming: 0, participants: 0, budget: 0, spend: 0 },
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

  // Retired categories are gone from every screen, not merely greyed out.
  // A retired category with nothing in it still rendered a card saying 0
  // stations, 0 accounts, 0% — nine tiles of nothing on the one screen whose
  // job is comparing the categories that matter.
  const { data } = await supabase
    .from('tracker_categories' as never)
    .select('id, slug, name_en, name_sw, description, member_noun_en, member_noun_sw, colour, is_active, display_order')
    .eq('is_active', true)
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
  const period = currentPeriod();

  /* Every total is summed in Postgres and comes back as one row. Pulling the
     rows and adding them up here worked at ninety institutions and broke at
     sixteen thousand: the row limits truncated the answer, so the screen was
     showing the sum of whatever came back first. */
  const [
    totalsRes, countsRes, engagementRes, categoryRes, trendRes,
    eventsRes, dueRes, recentStationsRes, recentReportsRes,
  ] = await Promise.all([
    supabase.from('overview_totals' as never).select('*').maybeSingle(),
    supabase.from('station_counts' as never).select('*').maybeSingle(),
    supabase.from('engagement_totals' as never).select('*').maybeSingle(),
    supabase.from('category_totals' as never).select('*'),
    supabase.from('monthly_totals' as never)
      .select('period_month, deposits_tzs, accounts_opened, stations')
      .gte('period_month', from)
      .order('period_month', { ascending: true }),
    supabase.from('tracked_events' as never)
      .select('id, name, event_date, participants, budget_tzs, actual_spend_tzs, accounts_opened, venue, created_at')
      .order('event_date', { ascending: false })
      .limit(200),
    /* Five names, not sixteen thousand. The count comes from the view; this
       is only what the bar shows before the link takes over. */
    supabase.from('stations' as never)
      .select('id, name, last_report_month')
      .eq('status', 'active')
      .or(`last_report_month.is.null,last_report_month.neq.${period}`)
      .order('last_report_month', { ascending: true, nullsFirst: true })
      .limit(5),
    supabase.from('stations' as never)
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('station_reports' as never)
      .select('id, station_id, period_month, submitted_at')
      .order('submitted_at', { ascending: false })
      .limit(6),
  ]);

  const n = (v: unknown) => Number(v ?? 0);
  const totals = (totalsRes.data ?? {}) as Record<string, unknown>;
  const counts = (countsRes.data ?? {}) as Record<string, unknown>;
  const eng = (engagementRes.data ?? {}) as Record<string, unknown>;
  const categories = (categoryRes.data as unknown as CategoryTotals[]) ?? [];

  const events = (eventsRes.data as unknown as
    { id: string; name: string; event_date: string; participants: number | null;
      budget_tzs: number | null; actual_spend_tzs: number | null;
      accounts_opened: number | null; venue: string; created_at: string }[]) ?? [];

  const trend = ((trendRes.data as unknown as
    { period_month: string; deposits_tzs: number; accounts_opened: number; stations: number }[]) ?? [])
    .map((r) => ({
      month: r.period_month.slice(0, 7),
      deposits: n(r.deposits_tzs),
      accounts: n(r.accounts_opened),
      stations: n(r.stations),
    }));

  const portfolio = n(totals.portfolio);
  const accountsOpened = n(totals.accounts_opened);
  const dormantAccounts = n(totals.dormant_accounts);
  const activeStations = n(counts.active_stations);

  const due = ((dueRes.data as unknown as
    { id: string; name: string; last_report_month: string | null }[]) ?? [])
    .map((s) => ({ id: s.id, name: s.name, lastReport: s.last_report_month }));

  const stationName = new Map(
    ((recentStationsRes.data as unknown as { id: string; name: string }[]) ?? [])
      .map((s) => [s.id, s.name] as const),
  );

  const recent: ActivityItem[] = [
    ...((recentStationsRes.data as unknown as
      { id: string; name: string; created_at: string }[]) ?? [])
      .map((s) => ({
        kind: 'station' as const,
        id: s.id,
        title: s.name,
        detail: 'added',
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

  const now = Date.now();

  return {
    configured: true,
    stations: n(counts.stations),
    activeStations,
    portfolio,
    accountsOpened,
    activeAccounts: n(totals.active_accounts),
    dormantAccounts,
    deposits: n(totals.deposits_tzs),
    loansValue: n(totals.loans_value_tzs),
    loansCount: n(totals.loans_count),
    coveragePct: portfolio > 0 ? Math.round((accountsOpened / portfolio) * 1000) / 10 : null,
    dormancyPct: accountsOpened > 0
      ? Math.round((dormantAccounts / accountsOpened) * 1000) / 10
      : null,
    categories,
    trend,
    reportedThisMonth: n(counts.reported_this_period),
    awaitingReport: n(counts.due_this_period),
    dueCount: n(counts.due_this_period),
    due,
    totalCategories: categories.length,
    totalBranches: n(counts.branches),
    branchesReporting: n(counts.branches),
    zonesCovered: n(counts.zones),
    simbanking: n(totals.simbanking_activated),
    cardsIssued: n(totals.cards_issued),
    lipaHapa: n(totals.lipa_hapa_registered),
    bookings: n(eng.bookings),
    leadsExpected: n(eng.leads_expected),
    leadsGot: n(eng.leads_got),
    events: {
      total: events.length,
      past: events.filter((e) => new Date(e.event_date).getTime() < now).length,
      upcoming: events.filter((e) => new Date(e.event_date).getTime() >= now).length,
      participants: events.reduce((a, e) => a + n(e.participants), 0),
      budget: events.reduce((a, e) => a + n(e.budget_tzs), 0),
      spend: events.reduce((a, e) => a + n(e.actual_spend_tzs), 0),
    },
    eventList: (() => {
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
