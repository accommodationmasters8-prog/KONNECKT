import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty, FoldPanel } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { count, money } from '@/lib/tracker';
import { localeParams, resolveLocale } from '@/lib/page';
import { EngagementsPanel, type EngagementRow } from './EngagementsPanel';
import styles from '../staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Engagements — Konekt',
  robots: { index: false, follow: false },
};

/* The shape the list and the correction form share. `tracked_events` is
   embedded rather than fetched separately and joined here: one round trip
   instead of two, and no chance of the two lists disagreeing about which
   event a visit belongs to. */
interface Row {
  id: string;
  institution: string;
  engaged_on: string;
  branch_id: string;
  station_id: string | null;
  category_id: string | null;
  event_id: string | null;
  notes: string | null;
  leads_expected: number;
  leads_got: number;
  accounts_opened: number;
  accounts_activated: number;
  simbanking_activated: number;
  lipa_hapa_registered: number;
  deposits_tzs: number;
  tracked_events: { name: string } | null;
}

/**
 * Visits a branch books on an institution.
 *
 * Separate from events, which are one-off and carry a budget. This is the
 * routine calling — a branch goes to a school, expects thirty leads, comes
 * back with nineteen. Expected against got is the whole point of the screen.
 */
export default async function EngagementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  let rows: Row[] = [];
  let branches: { id: string; name: string }[] = [];
  let categories: { id: string; name_en: string }[] = [];
  let events: { id: string; name: string; event_date: string }[] = [];
  let totals = { bookings: 0, leads_expected: 0, leads_got: 0, accounts_opened: 0,
    accounts_activated: 0, simbanking_activated: 0, lipa_hapa_registered: 0, deposits_tzs: 0 };

  if (supabase && session.signedIn) {
    const [listRes, totalRes, branchRes, catRes, eventRes] = await Promise.all([
      supabase.from('engagements' as never)
        .select('id, institution, engaged_on, branch_id, station_id, category_id, event_id, notes, leads_expected, leads_got, accounts_opened, accounts_activated, simbanking_activated, lipa_hapa_registered, deposits_tzs, tracked_events(name)')
        .order('engaged_on', { ascending: false })
        .limit(200),
      supabase.from('engagement_totals' as never).select('*').maybeSingle(),
      supabase.from('branches' as never).select('id, name').eq('is_active', true)
        .order('name').limit(500),
      supabase.from('tracker_categories' as never).select('id, name_en').order('name_en'),
      /* Events a visit can be attached to. Most recent first and capped:
         a picker is a list somebody reads, and this year's activations are
         what a visit being recorded today belongs to. */
      supabase.from('tracked_events' as never)
        .select('id, name, event_date')
        .order('event_date', { ascending: false })
        .limit(200),
    ]);
    rows = (listRes.data as unknown as Row[]) ?? [];
    if (totalRes.data) totals = { ...totals, ...(totalRes.data as typeof totals) };
    branches = (branchRes.data as unknown as { id: string; name: string }[]) ?? [];
    categories = (catRes.data as unknown as { id: string; name_en: string }[]) ?? [];
    events = (eventRes.data as unknown as
      { id: string; name: string; event_date: string }[]) ?? [];
  }

  const branchName = new Map(branches.map((b) => [b.id, b.name] as const));
  const n = (v: number) => Number(v ?? 0);
  const conversion = n(totals.leads_expected) > 0
    ? Math.round((n(totals.leads_got) / n(totals.leads_expected)) * 100)
    : null;

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="engagements"
      nav={staffNav(locale, STAFF_LABELS)}
      title="Engagements"
      scopeLabel={session.scopeLabel}
      user={session.user}
    >
      {!session.signedIn ? (
        <Panel title="Sign in">
          <PanelEmpty>Nothing is visible until you sign in.</PanelEmpty>
        </Panel>
      ) : (
        <>
          <div className={styles.metrics}>
            <MetricCard tone="teal" label="Institutions booked"
              value={totals.bookings === 0 ? '—' : count(n(totals.bookings), locale)} />
            <MetricCard tone="gold" label="Leads expected"
              value={n(totals.leads_expected) === 0 ? '—' : count(n(totals.leads_expected), locale)} />
            <MetricCard tone="green" label="Leads got"
              value={n(totals.leads_got) === 0 ? '—' : count(n(totals.leads_got), locale)}
              note={conversion === null ? undefined : `${conversion}%`} />
            <MetricCard tone="teal" label="Accounts opened"
              value={n(totals.accounts_opened) === 0 ? '—' : count(n(totals.accounts_opened), locale)} />
            <MetricCard tone="teal" label="Accounts activated"
              value={n(totals.accounts_activated) === 0 ? '—' : count(n(totals.accounts_activated), locale)} />
            <MetricCard tone="ink" label="SimBanking"
              value={n(totals.simbanking_activated) === 0 ? '—' : count(n(totals.simbanking_activated), locale)} />
            <MetricCard tone="green" label="Lipa Hapa"
              value={n(totals.lipa_hapa_registered) === 0 ? '—' : count(n(totals.lipa_hapa_registered), locale)} />
            <MetricCard tone="gold" label="Deposits"
              value={n(totals.deposits_tzs) === 0 ? '—' : money(n(totals.deposits_tzs), locale, true)} />
          </div>

          <EngagementsPanel
            rows={rows.map((r): EngagementRow => ({
              id: r.id,
              institution: r.institution,
              station_id: r.station_id,
              branch_id: r.branch_id,
              category_id: r.category_id,
              event_id: r.event_id,
              engaged_on: r.engaged_on,
              notes: r.notes,
              leads_expected: n(r.leads_expected),
              leads_got: n(r.leads_got),
              accounts_opened: n(r.accounts_opened),
              accounts_activated: n(r.accounts_activated),
              simbanking_activated: n(r.simbanking_activated),
              lipa_hapa_registered: n(r.lipa_hapa_registered),
              deposits_tzs: n(r.deposits_tzs),
              event_name: r.tracked_events?.name ?? null,
            }))}
            branches={branches}
            categories={categories}
            events={events}
            fixedBranch={session.role === 'branch' ? session.branchId : null}
            branchName={Object.fromEntries(branchName)}
            locale={locale}
          />
        </>
      )}
    </StaffShell>
  );
}
