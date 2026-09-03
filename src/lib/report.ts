import { getServerClient } from '@/lib/supabase/server';
import { zoneWording } from '@/lib/access-scope';

/**
 * One report, built once.
 *
 * The CSV route and the print view both call this. That is the whole point:
 * two code paths producing "the same" report is two code paths that will
 * disagree about a rounding rule within a month, and the disagreement will be
 * discovered in a board meeting.
 *
 * Every query runs under the caller's session, so row level security decides
 * the contents. The filters below are the person's own display choices layered
 * on top — never a second authorisation check, which would be a weaker copy of
 * the real one.
 */

export type ReportKind = 'reports' | 'stations' | 'events' | 'branches' | 'event' | 'engagements';

export interface ReportRequest {
  kind: string;
  from?: string;
  to?: string;
  zone?: string;
  branch?: string;
  category?: string;
  /** One event, in full, with its pictures. */
  eventId?: string;
  /** daily | weekly | monthly. Empty means every kind. */
  periodKind?: string;
  /** Roll the rows up to this level instead of one row per station. */
  groupBy?: string;
  /** Column keys to keep, in the order the report defines them. Empty means
   *  every column — a report nobody has narrowed is the whole thing. */
  columns?: string[];
}

export interface EventDossier {
  name: string;
  date: string;
  venue: string;
  address: string | null;
  branch: string;
  zone: string | null;
  notes: string | null;
  albumUrl: string | null;
  images: { id: string; url: string | null; caption: string | null }[];
  facts: { label: string; value: string }[];
}

export interface BuiltReport {
  kind: ReportKind;
  title: string;
  scope: string;
  headers: string[];
  rows: (string | number | null)[][];
  summary: { label: string; value: string }[];
  /** Set only for a single-event dossier, which the print view lays out with
   *  the pictures rather than as a table. */
  dossier?: EventDossier;
}

const KINDS: Record<ReportKind, string> = {
  reports: 'Period figures',
  stations: 'Station register',
  events: 'Events and KPIs',
  branches: 'Branches and zones',
  event: 'Event report',
  engagements: 'Engagements and leads',
};

/**
 * One column of a report.
 *
 * `group` says what happens to it when rows are rolled up: 'sum' adds, 'key'
 * is what they are grouped by and survives, and anything else disappears
 * because it has no meaning across a group — averaging a station name is not
 * a thing, and neither is showing one station's note for forty.
 */
interface Column {
  key: string;
  label: string;
  get: (row: Record<string, unknown>) => string | number | null;
  group?: 'sum' | 'key';
}

/** Cut a report down to the columns asked for, keeping the report's order. */
function pick(columns: Column[], wanted?: string[]): Column[] {
  if (!wanted || wanted.length === 0) return columns;
  const set = new Set(wanted);
  const kept = columns.filter((c) => set.has(c.key));
  return kept.length ? kept : columns;
}

const money = (n: number) =>
  `TZS ${Math.round(n).toLocaleString('en-TZ')}`;

const EMPTY: BuiltReport = {
  kind: 'reports', title: 'Report', scope: '',
  headers: [], rows: [], summary: [],
};

export async function buildReport(req: ReportRequest): Promise<BuiltReport> {
  const kind = (['reports', 'stations', 'events', 'branches', 'event', 'engagements'] as const)
    .find((k) => k === req.kind) ?? 'reports';

  const supabase = await getServerClient();
  if (!supabase) return { ...EMPTY, kind, title: KINDS[kind] };

  const [stationRes, branchRes, catRes] = await Promise.all([
    supabase.from('stations' as never)
      .select('id, name, short_name, category_id, branch_id, zone_code, district_name, region_name, status, portfolio, last_report_month, contact_name, contact_phone')
      .limit(30000),
    supabase.from('branches' as never).select('id, name, zone_code, is_active, year_established').limit(2000),
    supabase.from('tracker_categories' as never).select('id, name_en').limit(200),
  ]);

  const branches = (branchRes.data as unknown as
    { id: string; name: string; zone_code: string | null; is_active: boolean; year_established: number | null }[]) ?? [];
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const catName = new Map(
    ((catRes.data as unknown as { id: string; name_en: string }[]) ?? [])
      .map((c) => [c.id, c.name_en]),
  );

  let stations = (stationRes.data as unknown as Record<string, unknown>[]) ?? [];
  if (req.zone) stations = stations.filter((s) => s.zone_code === req.zone);
  if (req.branch) stations = stations.filter((s) => s.branch_id === req.branch);
  if (req.category) stations = stations.filter((s) => s.category_id === req.category);

  const scope = [
    req.zone ? `${zoneWording(req.zone)} zone` : null,
    req.branch ? branchName.get(req.branch) : null,
    req.category ? catName.get(req.category) : null,
    req.from || req.to
      ? `${req.from ?? 'the beginning'} to ${req.to ?? 'today'}`
      : null,
  ].filter(Boolean).join(' · ') || 'Everything you can reach';

  if (kind === 'stations') {
    return {
      kind, title: KINDS[kind], scope,
      headers: ['Station', 'Category', 'Branch', 'Zone', 'Region', 'District',
        'Status', 'People', 'Last report', 'Contact', 'Phone'],
      rows: stations.map((s) => [
        String(s.name), catName.get(s.category_id as string) ?? '',
        branchName.get(s.branch_id as string) ?? '', (s.zone_code as string) ?? '',
        (s.region_name as string) ?? '', (s.district_name as string) ?? '',
        (s.status as string) ?? '', (s.portfolio as number) ?? null,
        (s.last_report_month as string) ?? '', (s.contact_name as string) ?? '',
        (s.contact_phone as string) ?? '',
      ]),
      summary: [
        { label: 'Stations', value: stations.length.toLocaleString() },
        {
          label: 'Reporting',
          value: stations.filter((s) => s.last_report_month).length.toLocaleString(),
        },
        {
          label: 'Never reported',
          value: stations.filter((s) => !s.last_report_month).length.toLocaleString(),
        },
      ],
    };
  }

  if (kind === 'branches') {
    const rows = branches
      .filter((b) => !req.zone || b.zone_code === req.zone)
      .map((b) => [
        b.name, b.zone_code ?? 'not assigned',
        b.is_active ? 'Open' : 'Closed', b.year_established ?? null,
      ] as (string | number | null)[]);

    return {
      kind, title: KINDS[kind], scope,
      headers: ['Branch', 'Zone', 'Status', 'Established'],
      rows,
      summary: [
        { label: 'Branches', value: rows.length.toLocaleString() },
        {
          label: 'Without a zone',
          value: rows.filter((r) => r[1] === 'not assigned').length.toLocaleString(),
        },
      ],
    };
  }

  if (kind === 'event' && req.eventId) {
    const [eventRes, imageRes] = await Promise.all([
      supabase.from('tracked_events' as never)
        .select('id, name, event_date, end_date, venue, address, branch_id, zone_code, participants, budget_tzs, actual_spend_tzs, accounts_opened, simbanking_activated, cards_issued, lipa_hapa_registered, deposits_tzs, album_url, notes')
        .eq('id', req.eventId)
        .maybeSingle(),
      supabase.from('tracked_event_images' as never)
        .select('id, external_url, caption')
        .eq('event_id', req.eventId)
        .order('created_at', { ascending: true }),
    ]);

    const e = eventRes.data as unknown as Record<string, unknown> | null;
    if (!e) return { ...EMPTY, kind, title: KINDS[kind], scope: 'Not found' };

    const n = (k: string) => Number(e[k] ?? 0);
    const say = (k: string, fallback = '—') =>
      e[k] === null || e[k] === undefined || e[k] === '' ? fallback : String(e[k]);

    const facts = [
      { label: 'Participants', value: n('participants').toLocaleString() },
      { label: 'Accounts opened', value: n('accounts_opened').toLocaleString() },
      { label: 'SimBanking activated', value: n('simbanking_activated').toLocaleString() },
      { label: 'Cards issued', value: n('cards_issued').toLocaleString() },
      { label: 'Lipa Hapa registered', value: n('lipa_hapa_registered').toLocaleString() },
      { label: 'Budget', value: money(n('budget_tzs')) },
      { label: 'Actually spent', value: money(n('actual_spend_tzs')) },
      { label: 'Deposits raised', value: money(n('deposits_tzs')) },
    ];

    return {
      kind, title: `${say('name')} — event report`,
      scope: [say('venue'), say('address', ''), say('event_date')].filter(Boolean).join(' · '),
      headers: ['Measure', 'Value'],
      rows: facts.map((f) => [f.label, f.value]),
      summary: facts.slice(0, 4),
      dossier: {
        name: say('name'),
        date: say('event_date'),
        venue: say('venue'),
        address: (e.address as string) ?? null,
        branch: branchName.get(e.branch_id as string) ?? '—',
        zone: (e.zone_code as string) ?? null,
        notes: (e.notes as string) ?? null,
        albumUrl: (e.album_url as string) ?? null,
        images: ((imageRes.data as unknown as
          { id: string; external_url: string | null; caption: string | null }[]) ?? [])
          .map((i) => ({ id: i.id, url: i.external_url, caption: i.caption })),
        facts,
      },
    };
  }

  if (kind === 'events') {
    const { data } = await supabase.from('tracked_events' as never)
      .select('id, name, event_date, venue, address, branch_id, zone_code, participants, budget_tzs, actual_spend_tzs, accounts_opened, simbanking_activated, cards_issued, lipa_hapa_registered, deposits_tzs')
      .order('event_date', { ascending: false })
      .limit(10000);

    let events = (data as unknown as Record<string, unknown>[]) ?? [];
    if (req.zone) events = events.filter((e) => e.zone_code === req.zone);
    if (req.branch) events = events.filter((e) => e.branch_id === req.branch);
    if (req.from) events = events.filter((e) => String(e.event_date) >= req.from!);
    if (req.to) events = events.filter((e) => String(e.event_date) <= req.to!);

    const spend = events.reduce((a, e) => a + Number(e.actual_spend_tzs ?? 0), 0);
    const opened = events.reduce((a, e) => a + Number(e.accounts_opened ?? 0), 0);
    const people = events.reduce((a, e) => a + Number(e.participants ?? 0), 0);

    return {
      kind, title: KINDS[kind], scope,
      headers: ['Event', 'Date', 'Past or upcoming', 'Venue', 'Branch', 'Zone',
        'Participants', 'Budget TZS', 'Spent TZS', 'Accounts', 'SimBanking',
        'Cards', 'Lipa Hapa', 'Deposits TZS'],
      rows: events.map((e) => [
        String(e.name), String(e.event_date),
        new Date(String(e.event_date)) < new Date() ? 'Past' : 'Upcoming',
        (e.venue as string) ?? '', branchName.get(e.branch_id as string) ?? '',
        (e.zone_code as string) ?? '', (e.participants as number) ?? null,
        (e.budget_tzs as number) ?? null, (e.actual_spend_tzs as number) ?? null,
        (e.accounts_opened as number) ?? null,
        (e.simbanking_activated as number) ?? null,
        (e.cards_issued as number) ?? null,
        (e.lipa_hapa_registered as number) ?? null,
        (e.deposits_tzs as number) ?? null,
      ]),
      summary: [
        { label: 'Events', value: events.length.toLocaleString() },
        { label: 'People reached', value: people.toLocaleString() },
        { label: 'Accounts opened', value: opened.toLocaleString() },
        {
          label: 'SimBanking activated',
          value: events
            .reduce((a, e) => a + Number(e.simbanking_activated ?? 0), 0)
            .toLocaleString(),
        },
      ],
    };
  }

  // Engagements — the visits branches booked, and what came of them.
  if (kind === 'engagements') {
    let eq = supabase.from('engagements' as never)
      .select('institution, engaged_on, branch_id, category_id, zone_code, leads_expected, leads_got, accounts_opened, accounts_activated, simbanking_activated, lipa_hapa_registered, deposits_tzs, notes')
      .order('engaged_on', { ascending: false })
      .limit(50000);

    if (req.from) eq = eq.gte('engaged_on', req.from);
    if (req.to) eq = eq.lte('engaged_on', req.to);
    if (req.zone) eq = eq.eq('zone_code', req.zone);
    if (req.branch) eq = eq.eq('branch_id', req.branch);
    if (req.category) eq = eq.eq('category_id', req.category);

    const { data: engData } = await eq;
    const rows = (engData as unknown as Record<string, unknown>[]) ?? [];
    const n = (v: unknown) => Number(v ?? 0);

    const columns: Column[] = [
      { key: 'date', label: 'Date', get: (r) => String(r.engaged_on ?? ''), group: 'key' },
      { key: 'institution', label: 'Institution', get: (r) => String(r.institution ?? '') },
      { key: 'branch', label: 'Branch', get: (r) => branchName.get(r.branch_id as string) ?? '', group: 'key' },
      { key: 'zone', label: 'Zone', get: (r) => (r.zone_code as string) ?? '', group: 'key' },
      { key: 'category', label: 'Category', get: (r) => catName.get(r.category_id as string) ?? '', group: 'key' },
      { key: 'expected', label: 'Leads expected', get: (r) => n(r.leads_expected), group: 'sum' },
      { key: 'got', label: 'Leads got', get: (r) => n(r.leads_got), group: 'sum' },
      { key: 'conversion', label: 'Conversion %', get: (r) => n(r.leads_expected) > 0
          ? Math.round((n(r.leads_got) / n(r.leads_expected)) * 1000) / 10 : null },
      { key: 'opened', label: 'Accounts opened', get: (r) => n(r.accounts_opened), group: 'sum' },
      { key: 'activated', label: 'Accounts activated', get: (r) => n(r.accounts_activated), group: 'sum' },
      { key: 'simbanking', label: 'SimBanking', get: (r) => n(r.simbanking_activated), group: 'sum' },
      { key: 'lipahapa', label: 'Lipa Hapa', get: (r) => n(r.lipa_hapa_registered), group: 'sum' },
      { key: 'deposits', label: 'Deposits TZS', get: (r) => n(r.deposits_tzs), group: 'sum' },
      { key: 'note', label: 'Note', get: (r) => (r.notes as string) ?? '' },
    ];

    const built = shape(rows, columns, req.groupBy, req.columns);
    const expected = rows.reduce((a, r) => a + n(r.leads_expected), 0);
    const got = rows.reduce((a, r) => a + n(r.leads_got), 0);

    return {
      kind, title: KINDS[kind], scope,
      headers: built.headers, rows: built.rows,
      summary: [
        { label: 'Visits', value: rows.length.toLocaleString() },
        { label: 'Leads expected', value: expected.toLocaleString() },
        { label: 'Leads got', value: got.toLocaleString() },
        {
          label: 'Conversion',
          value: expected > 0 ? `${Math.round((got / expected) * 1000) / 10}%` : '—',
        },
      ],
    };
  }

  // Period figures.
  //
  // Filtered through an inner join on stations rather than by listing station
  // ids in the query string. With nineteen thousand institutions on the
  // register that list is a URL no server will accept, and the report simply
  // failed rather than coming back short.
  let query = supabase.from('station_reports' as never)
    .select('period_month, period_kind, portfolio, accounts_opened, active_accounts, dormant_accounts, simbanking_activated, cards_issued, lipa_hapa_registered, deposits_tzs, loans_count, loans_value_tzs, note, stations!inner(id, name, category_id, branch_id, zone_code)')
    .order('period_month', { ascending: false })
    .limit(50000);

  if (req.from) query = query.gte('period_month', req.from);
  if (req.to) query = query.lte('period_month', req.to);
  if (req.periodKind) query = query.eq('period_kind', req.periodKind);
  if (req.zone) query = query.eq('stations.zone_code', req.zone);
  if (req.branch) query = query.eq('stations.branch_id', req.branch);
  if (req.category) query = query.eq('stations.category_id', req.category);

  const { data } = await query;
  const reports = (data as unknown as Record<string, unknown>[]) ?? [];
  const st = (r: Record<string, unknown>) =>
    (r.stations ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => Number(v ?? 0);

  const columns: Column[] = [
    { key: 'period', label: 'Period', get: (r) => String(r.period_month ?? ''), group: 'key' },
    { key: 'covers', label: 'Covers', get: (r) => String(r.period_kind ?? 'monthly'), group: 'key' },
    { key: 'station', label: 'Station', get: (r) => (st(r).name as string) ?? '' },
    { key: 'category', label: 'Category', get: (r) => catName.get(st(r).category_id as string) ?? '', group: 'key' },
    { key: 'branch', label: 'Branch', get: (r) => branchName.get(st(r).branch_id as string) ?? '', group: 'key' },
    { key: 'zone', label: 'Zone', get: (r) => (st(r).zone_code as string) ?? '', group: 'key' },
    { key: 'people', label: 'People', get: (r) => num(r.portfolio), group: 'sum' },
    { key: 'opened', label: 'Accounts opened', get: (r) => num(r.accounts_opened), group: 'sum' },
    { key: 'active', label: 'Active', get: (r) => num(r.active_accounts), group: 'sum' },
    { key: 'dormant', label: 'Dormant', get: (r) => num(r.dormant_accounts), group: 'sum' },
    { key: 'coverage', label: 'Coverage %', get: (r) => num(r.portfolio) > 0
        ? Math.round((num(r.accounts_opened) / num(r.portfolio)) * 1000) / 10 : null },
    { key: 'simbanking', label: 'SimBanking', get: (r) => num(r.simbanking_activated), group: 'sum' },
    { key: 'cards', label: 'Cards', get: (r) => num(r.cards_issued), group: 'sum' },
    { key: 'lipahapa', label: 'Lipa Hapa', get: (r) => num(r.lipa_hapa_registered), group: 'sum' },
    { key: 'deposits', label: 'Deposits TZS', get: (r) => num(r.deposits_tzs), group: 'sum' },
    { key: 'loans', label: 'Loans', get: (r) => num(r.loans_count), group: 'sum' },
    { key: 'loanvalue', label: 'Loan value TZS', get: (r) => num(r.loans_value_tzs), group: 'sum' },
    { key: 'note', label: 'Note', get: (r) => (r.note as string) ?? '' },
  ];

  const built = shape(reports, columns, req.groupBy, req.columns);
  const deposits = reports.reduce((a, r) => a + num(r.deposits_tzs), 0);
  const opened = reports.reduce((a, r) => a + num(r.accounts_opened), 0);

  return {
    kind, title: KINDS[kind], scope,
    headers: built.headers,
    rows: built.rows,
    summary: [
      { label: 'Rows', value: built.rows.length.toLocaleString() },
      { label: 'Stations', value: new Set(reports.map((r) => st(r).id)).size.toLocaleString() },
      { label: 'Accounts opened', value: opened.toLocaleString() },
      { label: 'Deposits', value: money(deposits) },
    ],
  };
}

/**
 * Apply the grouping and the column choice.
 *
 * Grouping is a fold on one column's value: every numeric column marked 'sum'
 * is added up, the columns marked 'key' survive if they are constant within
 * the group, and everything else is dropped — a station name means nothing
 * across forty stations, and neither does one of their notes. A derived
 * column such as coverage is recomputed from the summed columns rather than
 * averaged, because the average of forty percentages is not a percentage of
 * anything.
 */
function shape(
  rows: Record<string, unknown>[],
  columns: Column[],
  groupBy?: string,
  wanted?: string[],
): { headers: string[]; rows: (string | number | null)[][] } {
  if (!groupBy || groupBy === 'none') {
    const cols = pick(columns, wanted);
    return {
      headers: cols.map((c) => c.label),
      rows: rows.map((r) => cols.map((c) => c.get(r))),
    };
  }

  const keyCol = columns.find((c) => c.key === groupBy);
  if (!keyCol) {
    const cols = pick(columns, wanted);
    return {
      headers: cols.map((c) => c.label),
      rows: rows.map((r) => cols.map((c) => c.get(r))),
    };
  }

  const sums = columns.filter((c) => c.group === 'sum');
  const buckets = new Map<string, { key: string | number | null; total: Map<string, number>; n: number }>();

  for (const row of rows) {
    const k = String(keyCol.get(row) ?? '');
    let bucket = buckets.get(k);
    if (!bucket) {
      bucket = { key: keyCol.get(row), total: new Map(), n: 0 };
      buckets.set(k, bucket);
    }
    bucket.n += 1;
    for (const c of sums) {
      bucket.total.set(c.key, (bucket.total.get(c.key) ?? 0) + Number(c.get(row) ?? 0));
    }
  }

  // Coverage is the one derived column here, and it is derived again from the
  // group's own totals rather than carried through the fold.
  const coverage = (b: { total: Map<string, number> }) => {
    const people = b.total.get('people') ?? 0;
    const got = b.total.get('opened') ?? 0;
    return people > 0 ? Math.round((got / people) * 1000) / 10 : null;
  };

  const shown = pick(
    [
      { key: keyCol.key, label: keyCol.label, get: () => null },
      { key: '_rows', label: 'Rows', get: () => null },
      ...columns.filter((c) => c.group === 'sum' || c.key === 'coverage'),
    ].filter((c, i, all) => all.findIndex((x) => x.key === c.key) === i),
    wanted && wanted.length ? [keyCol.key, '_rows', ...wanted] : undefined,
  );

  return {
    headers: shown.map((c) => c.label),
    rows: [...buckets.values()]
      .sort((a, b) => String(a.key).localeCompare(String(b.key)))
      .map((b) => shown.map((c) => {
        if (c.key === keyCol.key) return b.key;
        if (c.key === '_rows') return b.n;
        if (c.key === 'coverage') return coverage(b);
        return b.total.get(c.key) ?? 0;
      })),
  };
}
