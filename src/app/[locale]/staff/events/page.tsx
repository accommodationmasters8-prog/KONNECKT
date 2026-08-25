import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { EventForm } from '@/components/staff/EventForm';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { sampleEvents } from '@/lib/sample-events';
import { localeParams, resolveLocale } from '@/lib/page';
import type { EventStatus } from '@/lib/supabase/types';
import styles from './events.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Events — CRDB Konekt',
  robots: { index: false, follow: false },
};

interface EventRow {
  id: string;
  title_en: string;
  status: EventStatus;
  starts_at: string;
  venue_name: string;
  zone_code: string | null;
  capacity: number | null;
  registered_count: number;
}

/**
 * The events console.
 *
 * Every event a user may reach, newest first, with what it is doing right now.
 * Scope is the database's: `staff_can_reach` gives HQ everything, a zone
 * manager their zone and a branch officer their branch, from the same query.
 */
export default async function StaffEvents({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  let rows: EventRow[] = [];
  if (supabase && session.signedIn) {
    const { data } = await supabase
      .from('events' as never)
      .select('id, title_en, status, starts_at, venue_name, zone_code, capacity, registered_count')
      .order('starts_at', { ascending: false })
      .limit(100);
    rows = (data as unknown as EventRow[]) ?? [];
  }

  const when = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="events"
      nav={staffNav(locale, STAFF_LABELS)}
      title={STAFF_LABELS.events}
      scopeLabel={session.scopeLabel}
      user={session.user}
    >
      <Panel
        title="Programme"
        description="Everything in your scope. Open an event to approve it, publish it, work its waitlist, or record what it produced."
      >
        {!supabase ? (
          <PanelEmpty>
            No database is attached to this deployment. The public site is
            showing {sampleEvents.length} sample events, each labelled as a
            sample; nothing here is real until Supabase is configured and an
            event is created.
          </PanelEmpty>
        ) : !session.signedIn ? (
          <PanelEmpty>Sign in to see the events your role can reach.</PanelEmpty>
        ) : rows.length === 0 ? (
          <PanelEmpty>
            No events in your scope yet. Create the first one below — it starts
            as a draft and reaches the public site only after approval.
          </PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">When</th>
                  <th scope="col">Where</th>
                  <th scope="col">Registered</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <Link href={`/${locale}/staff/events/${row.id}`} className={styles.link}>
                        {row.title_en}
                      </Link>
                    </th>
                    <td className={styles.when}>{when.format(new Date(row.starts_at))}</td>
                    <td>
                      {row.venue_name}
                      {row.zone_code ? <span className={styles.zone}>{row.zone_code.replace(/_/g, ' ')}</span> : null}
                    </td>
                    <td className={styles.num}>
                      {row.registered_count}
                      {row.capacity ? <span className={styles.capacity}> / {row.capacity}</span> : null}
                    </td>
                    <td><span className={`${styles.status} ${styles[row.status] ?? ''}`}>{row.status.replace(/_/g, ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Add an event"
        description="Creates a draft. Nothing here reaches the public site until it has been approved and published on the event's own screen."
      >
        {session.signedIn ? (
          <EventForm locale={locale} />
        ) : (
          <PanelEmpty>Sign in to create an event.</PanelEmpty>
        )}
      </Panel>
    </StaffShell>
  );
}
