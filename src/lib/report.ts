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

export type ReportKind = 'reports' | 'stations' | 'events' | 'branches' | 'event';

export interface ReportRequest {
  kind: string;
  from?: string;
  to?: string;
  zone?: string;
  branch?: string;
  category?: string;
  /** One event, in full, with its pictures. */
  eventId?: string;
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
};

const money = (n: number) =>
  `TZS ${Math.round(n).toLocaleString('en-TZ')}`;

const EMPTY: BuiltReport = {
  kind: 'reports', title: 'Report', scope: '',
  headers: [], rows: [], summary: [],
};

export async function buildReport(req: ReportRequest): Promise<BuiltReport> {
  const kind = (['reports', 'stations', 'events', 'branches', 'event'] as const)
    .find((k) => k === req.kind) ?? 'reports';

  const supabase = await getServerClient();
  if (!supabase) return { ...EMPTY, kind, title: KINDS[kind] };

  const [stationRes, branchRes, catRes] = await Promise.all([
    supabase.from('stations' as never)
      .select('id, name, short_name, category_id, branch_id, zone_code, district_name, region_name, status, portfolio, last_report_month, contact_name, contact_phone')
      .limit(10000),
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

  // Monthly figures.
  const ids = stations.map((s) => s.id as string);
  let query = supabase.from('station_reports' as never)
    .select('station_id, period_month, period_kind, portfolio, accounts_opened, active_accounts, dormant_accounts, simbanking_activated, cards_issued, lipa_hapa_registered, deposits_tzs, loans_count, loans_value_tzs, note')
    .order('period_month', { ascending: false })
    .limit(50000);

  if (ids.length) query = query.in('station_id', ids);
  if (req.from) query = query.gte('period_month', req.from);
  if (req.to) query = query.lte('period_month', req.to);

  const { data } = ids.length ? await query : { data: [] };
  const reports = (data as unknown as Record<string, unknown>[]) ?? [];
  const byId = new Map(stations.map((s) => [s.id as string, s]));

  const deposits = reports.reduce((a, r) => a + Number(r.deposits_tzs ?? 0), 0);
  const opened = reports.reduce((a, r) => a + Number(r.accounts_opened ?? 0), 0);

  return {
    kind, title: KINDS[kind], scope,
    headers: ['Period', 'Covers', 'Station', 'Category', 'Branch', 'Zone', 'People',
      'Accounts opened', 'Active', 'Dormant', 'Coverage %', 'SimBanking',
      'Cards', 'Lipa Hapa', 'Deposits TZS', 'Loans', 'Loan value TZS', 'Note'],
    rows: reports.map((r) => {
      const s = byId.get(r.station_id as string) ?? {};
      const people = Number(r.portfolio ?? 0);
      const o = Number(r.accounts_opened ?? 0);
      return [
        String(r.period_month), String(r.period_kind ?? 'monthly'),
        (s.name as string) ?? '', catName.get(s.category_id as string) ?? '',
        branchName.get(s.branch_id as string) ?? '', (s.zone_code as string) ?? '',
        people, o, (r.active_accounts as number) ?? null,
        (r.dormant_accounts as number) ?? null,
        people > 0 ? Math.round((o / people) * 1000) / 10 : null,
        (r.simbanking_activated as number) ?? null,
        (r.cards_issued as number) ?? null,
        (r.lipa_hapa_registered as number) ?? null,
        (r.deposits_tzs as number) ?? null, (r.loans_count as number) ?? null,
        (r.loans_value_tzs as number) ?? null, (r.note as string) ?? '',
      ];
    }),
    summary: [
      { label: 'Rows', value: reports.length.toLocaleString() },
      { label: 'Stations', value: new Set(reports.map((r) => r.station_id)).size.toLocaleString() },
      { label: 'Accounts opened', value: opened.toLocaleString() },
      { label: 'Deposits', value: money(deposits) },
    ],
  };
}
