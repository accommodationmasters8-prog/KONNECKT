import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { EventForm } from '@/components/staff/EventForm';
import {
  CoordinatorPicker, DuplicateEvent, EventTransitions, PromoteWaitlist,
} from '@/components/staff/EventActions';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { nextStatuses } from '@/lib/event-lifecycle';
import { resolveLocale } from '@/lib/page';
import type { EventStatus } from '@/lib/supabase/types';
import staffStyles from '../../staff.module.css';
import styles from '../events.module.css';

export const metadata: Metadata = {
  title: 'Event — CRDB Konekt',
  robots: { index: false, follow: false },
};

interface EventDetail {
  id: string;
  slug: string;
  title_en: string;
  title_sw: string;
  summary_en: string | null;
  summary_sw: string | null;
  status: EventStatus;
  starts_at: string;
  ends_at: string;
  venue_name: string;
  zone_code: string | null;
  capacity: number | null;
  registered_count: number;
  waitlist_enabled: boolean;
  target_registrations: number | null;
  target_accounts: number | null;
  budget_tzs: number | null;
  coordinator_staff_id: string | null;
  published_at: string | null;
}

/**
 * One event, and everything that can be done to it.
 *
 * An event is not a record that gets typed in once. It gets approved,
 * published, staffed, filled, worked at the door, and then measured against
 * what it cost — so this screen is organised by those actions rather than by
 * the shape of the table behind it.
 *
 * Nothing here decides authorisation. Every query and every write runs under
 * the signed-in user's session, so a branch officer opening another zone's
 * event by guessing the URL gets nothing back to render.
 */
export default async function StaffEventDetail({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await resolveLocale(params as Promise<{ locale: string }>);
  const { id } = await params;
  const session = await getStaffSession();
  const supabase = await getServerClient();

  const nav = staffNav(locale, STAFF_LABELS);

  if (!supabase || !session.signedIn) {
    return (
      <StaffShell
        locale={locale}
        role={session.role}
        active="events"
        nav={nav}
        title="Event"
        scopeLabel={session.scopeLabel}
        user={session.user}
      >
        <Panel title="Event">
          <PanelEmpty>
            {supabase
              ? 'Sign in to work on an event.'
              : 'No database is attached to this deployment, so there is no event to open.'}
          </PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  const { data } = await supabase
    .from('events' as never)
    .select('id, slug, title_en, title_sw, summary_en, summary_sw, status, starts_at, ends_at, venue_name, zone_code, capacity, registered_count, waitlist_enabled, target_registrations, target_accounts, budget_tzs, coordinator_staff_id, published_at')
    .eq('id', id)
    .maybeSingle();

  const event = data as unknown as EventDetail | null;

  // Either it does not exist or this account may not reach it. The console
  // does not distinguish: telling someone an event exists but is not theirs
  // is itself a disclosure.
  if (!event) notFound();

  const [{ count: waiting }, { count: checkedIn }, { count: accounts }, staffList] =
    await Promise.all([
      supabase.from('registrations' as never)
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id).eq('status', 'waitlisted'),
      supabase.from('registrations' as never)
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id).eq('status', 'checked_in'),
      supabase.from('accounts_opened' as never)
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id),
      supabase.from('staff_users' as never)
        .select('id, full_name, email')
        .eq('is_active', true)
        .limit(200),
    ]);

  const coordinators = ((staffList.data as unknown as
    { id: string; full_name: string | null; email: string }[]) ?? [])
    .map((row) => ({ id: row.id, label: row.full_name || row.email }));

  const when = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    dateStyle: 'full', timeStyle: 'short',
  });
  const money = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    style: 'currency', currency: 'TZS', maximumFractionDigits: 0,
  });

  const costPerAccount =
    event.budget_tzs && accounts ? event.budget_tzs / accounts : null;

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="events"
      nav={nav}
      title={event.title_en}
      scopeLabel={`${event.status.replace(/_/g, ' ')} · ${event.venue_name}`}
      user={session.user}
      actions={
        <Link href={`/${locale}/staff/events`} className={styles.backLink}>
          ← All events
        </Link>
      }
    >
      <div className={staffStyles.metrics}>
        <MetricCard
          tone="teal"
          label="Registered"
          value={String(event.registered_count)}
          note={event.capacity ? `of ${event.capacity} seats` : 'No capacity limit'}
          source="konekt.registrations"
        />
        <MetricCard
          tone="gold"
          label="On the waitlist"
          value={String(waiting ?? 0)}
          note={event.waitlist_enabled ? 'Promoted in order' : 'Waitlist is off'}
          source="konekt.registrations"
        />
        <MetricCard
          tone="green"
          label="Checked in"
          value={String(checkedIn ?? 0)}
          note="Scanned at the door"
          source="konekt.check_ins"
        />
        <MetricCard
          tone="ink"
          label="Accounts opened"
          value={String(accounts ?? 0)}
          note={
            costPerAccount
              ? `${money.format(costPerAccount)} per account`
              : event.budget_tzs
                ? 'No accounts attributed yet'
                : 'No budget recorded'
          }
          source="konekt.accounts_opened"
        />
      </div>

      <div className={styles.detailGrid}>
        <Panel
          title="Where it is in its life"
          description="Only the moves that make sense from here are offered. The action refuses anything else, so a stale page cannot publish a cancelled event."
        >
          <EventTransitions id={event.id} status={event.status} allowed={nextStatuses(event.status)} />

          <dl className={styles.facts} style={{ marginBlockStart: 'var(--space-lg)' }}>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Starts</dt>
              <dd className={styles.factValue}>{when.format(new Date(event.starts_at))}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Ends</dt>
              <dd className={styles.factValue}>{when.format(new Date(event.ends_at))}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Published</dt>
              <dd className={styles.factValue}>
                {event.published_at ? when.format(new Date(event.published_at)) : 'Not yet'}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Public link</dt>
              <dd className={styles.factValue}>
                {['published', 'live', 'completed'].includes(event.status) ? (
                  <Link href={`/${locale}/events`} className={styles.link}>/{locale}/events</Link>
                ) : 'Not on the site'}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Budget</dt>
              <dd className={styles.factValue}>
                {event.budget_tzs ? money.format(event.budget_tzs) : 'Not set'}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel
          title="Who is running it"
          description="The coordinator is the person answerable for this event in reporting — accounts opened here are traced back through them."
        >
          <CoordinatorPicker
            id={event.id}
            current={event.coordinator_staff_id}
            options={coordinators}
          />

          <div style={{ marginBlockStart: 'var(--space-lg)', display: 'grid', gap: 'var(--space-md)' }}>
            <PromoteWaitlist id={event.id} waiting={waiting ?? 0} />
            <DuplicateEvent id={event.id} />
            <p className={staffStyles.hint}>
              Check-in for this event runs from the{' '}
              <Link href={`/${locale}/staff/check-in`} className={styles.link}>check-in screen</Link>,
              which queues scans offline and syncs when the venue&rsquo;s network comes back.
            </p>
          </div>
        </Panel>
      </div>

      <Panel
        title="Details"
        description="Editing these does not change where the event is in its lifecycle. A published event edited here stays published — and the edit is in the audit log."
      >
        <EventForm locale={locale} event={event} />
      </Panel>
    </StaffShell>
  );
}
