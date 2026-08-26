import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { BarTable } from '@/components/staff/Charts';
import { EventForm } from '@/components/staff/EventForms';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { count, getCategories, getStations, money, type TrackedEvent } from '@/lib/tracker';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Events — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * The events tracker.
 *
 * Nobody registers through this. It records what took place — who came, what
 * it cost, what it produced — so that two events can be compared, and so that
 * "how many did we run this year, and what did they get us" is a query rather
 * than a phone call to eight zones.
 *
 * Past and upcoming are the date against today, computed here. There is no
 * status column to go stale.
 */
export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  let events: TrackedEvent[] = [];
  let branches: { id: string; name: string }[] = [];

  if (supabase && session.signedIn) {
    const [eventRes, branchRes] = await Promise.all([
      supabase.from('tracked_events' as never)
        .select('id, name, event_date, end_date, branch_id, zone_code, station_id, category_id, venue, address, participants, budget_tzs, actual_spend_tzs, accounts_opened, deposits_tzs, album_url, notes, created_at')
        .order('event_date', { ascending: false })
        .limit(500),
      session.role === 'branch'
        ? Promise.resolve({ data: [] })
        : supabase.from('branches' as never)
            .select('id, name').eq('is_active', true)
            .order('name', { ascending: true }).limit(300),
    ]);
    events = (eventRes.data as unknown as TrackedEvent[]) ?? [];
    branches = (branchRes.data as unknown as { id: string; name: string }[]) ?? [];
  }

  const [stations, categories] = await Promise.all([getStations(), getCategories()]);

  const today = new Date().toISOString().slice(0, 10);
  const past = events.filter((e) => e.event_date < today);
  const upcoming = events.filter((e) => e.event_date >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  const participants = past.reduce((n, e) => n + Number(e.participants ?? 0), 0);
  const spend = past.reduce((n, e) => n + Number(e.actual_spend_tzs ?? e.budget_tzs ?? 0), 0);
  const accounts = past.reduce((n, e) => n + Number(e.accounts_opened ?? 0), 0);
  const costPerAccount = accounts > 0 ? spend / accounts : null;

  const when = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', { dateStyle: 'medium' });

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="events"
      nav={staffNav(locale, STAFF_LABELS)}
      title="Events"
      scopeLabel={session.scopeLabel}
      user={session.user}
    >
      {!session.signedIn ? (
        <Panel title="Events">
          <PanelEmpty>Sign in to see the events your role can reach.</PanelEmpty>
        </Panel>
      ) : (
        <>
          <div className={styles.metrics}>
            <MetricCard tone="teal" label="Events held" value={count(past.length, locale)}
              note={`${count(upcoming.length, locale)} upcoming`} />
            <MetricCard tone="green" label="People reached" value={count(participants, locale)}
              note="Across every event held" />
            <MetricCard tone="gold" label="Spent" value={money(spend, locale, true)}
              note="Actual where recorded, budget where not" />
            <MetricCard tone="ink" label="Cost per account"
              value={costPerAccount === null ? '—' : money(costPerAccount, locale)}
              note={accounts > 0 ? `${count(accounts, locale)} accounts opened` : 'No accounts recorded yet'} />
          </div>

          {upcoming.length > 0 ? (
            <Panel title="Coming up" description="Everything dated today or later.">
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Event</th>
                      <th scope="col">When</th>
                      <th scope="col">Where</th>
                      <th scope="col" className={styles.num}>Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((event) => (
                      <tr key={event.id}>
                        <th scope="row">
                          <Link href={`/${locale}/staff/events/${event.id}`} className={styles.link}>
                            {event.name}
                          </Link>
                        </th>
                        <td>{when.format(new Date(event.event_date))}</td>
                        <td>{event.venue}<span className={styles.sub}>{event.address ?? ''}</span></td>
                        <td className={styles.num}>
                          {event.budget_tzs ? money(Number(event.budget_tzs), locale, true) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          <Panel
            title="Performance"
            description="Events held, ranked by what they produced. An event with no accounts recorded sits at the bottom — that is information too."
          >
            {past.length === 0 ? (
              <PanelEmpty>No events held yet.</PanelEmpty>
            ) : (
              <BarTable
                caption="Events ranked by accounts opened"
                unitLabel="Accounts"
                rows={past
                  .slice()
                  .sort((a, b) => Number(b.accounts_opened ?? 0) - Number(a.accounts_opened ?? 0))
                  .slice(0, 15)
                  .map((event) => ({
                    label: event.name,
                    value: Number(event.accounts_opened ?? 0),
                    secondary: `${when.format(new Date(event.event_date))} · ${count(Number(event.participants ?? 0), locale)} people · ${
                      event.actual_spend_tzs || event.budget_tzs
                        ? money(Number(event.actual_spend_tzs ?? event.budget_tzs), locale, true)
                        : 'no cost recorded'
                    }`,
                  }))}
              />
            )}
          </Panel>

          <Panel title="Everything on record" description="Newest first.">
            {events.length === 0 ? (
              <PanelEmpty>
                Nothing recorded yet. Add the first event below — it can be one
                that already happened.
              </PanelEmpty>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Event</th>
                      <th scope="col">When</th>
                      <th scope="col" className={styles.num}>People</th>
                      <th scope="col" className={styles.num}>Accounts</th>
                      <th scope="col" className={styles.num}>Spent</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id}>
                        <th scope="row">
                          <Link href={`/${locale}/staff/events/${event.id}`} className={styles.link}>
                            {event.name}
                          </Link>
                          <span className={styles.sub}>{event.venue}</span>
                        </th>
                        <td>{when.format(new Date(event.event_date))}</td>
                        <td className={styles.num}>
                          {event.participants === null ? '—' : count(event.participants, locale)}
                        </td>
                        <td className={styles.num}>
                          {event.accounts_opened === null ? '—' : count(event.accounts_opened, locale)}
                        </td>
                        <td className={styles.num}>
                          {event.actual_spend_tzs || event.budget_tzs
                            ? money(Number(event.actual_spend_tzs ?? event.budget_tzs), locale, true)
                            : '—'}
                        </td>
                        <td>
                          <span className={event.event_date < today ? styles.chip : styles.chipActive}>
                            {event.event_date < today ? 'held' : 'upcoming'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Record an event"
            description="Held or planned — the date decides which. What it cost and what it produced are what make one event comparable with another."
          >
            <EventForm
              stations={stations.map((s) => ({ id: s.id, name: s.name }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name_en }))}
              branches={branches}
              needsBranch={session.role !== 'branch'}
            />
          </Panel>
        </>
      )}
    </StaffShell>
  );
}
