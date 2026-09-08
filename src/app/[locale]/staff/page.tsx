import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { MetricCard } from '@/components/staff/MetricCard';
import { BarTable } from '@/components/staff/Charts';
import { FoldPanel, Panel, PanelEmpty } from '@/components/staff/Panel';
import { FilingBar } from '@/components/staff/FilingBar';
import { CardChooser, CardStateScript } from '@/components/staff/CardChooser';
import {
  AccountsIcon, CategoriesIcon, EventsIcon, StationsIcon,
} from '@/components/staff/StaffIcons';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { count, formatPeriod, getTrackerOverview, money } from '@/lib/tracker';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from './staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Overview — Konekt',
  robots: { index: false, follow: false },
};

/**
 * The overview.
 *
 * Nine figures and the outstanding count. This screen used to carry three
 * paragraphs explaining what the figures were; the people who open it run the
 * bank's youth portfolio and already know. Every number is the sum of what
 * branches have filed, and a dash means nothing has been filed rather than a
 * measured zero.
 */
export default async function TrackerOverview({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const data = await getTrackerOverview();

  const nothingYet = data.stations === 0;

  /* The cards, and the menu that hides them, both read the same list — so the
     menu can never offer a card that is not there or miss one that is.
     
     That list is no longer written here. A figure is on this screen because
     some category tracks it, which is a decision HQ makes in Settings; adding
     one there puts it here, and dropping the last category that tracks it
     takes it away. The bookings card is appended because a visit is not a
     station figure — it belongs to the branch, not to a category. */
  const CARDS = [
    ...data.metrics.map((m) => ({ key: m.key, label: m.label })),
    { key: 'bookings', label: 'Institutions booked' },
  ];

  /* Colour cycles rather than being assigned: the set is HQ's now, so there is
     no fixed list to hand-colour. The first three keep the tones and the
     drill-through links the screen has always had for them. */
  /* The nine the bank reads, on by default. The other two — cards issued and
     loan value — are there to be switched on, not to be scrolled past every
     morning. Order comes from the metric itself, so portfolio is first,
     accounts opened second and deposits mobilised third wherever they appear. */
  const DEFAULT_CARDS = [
    'portfolio', 'accounts_opened', 'deposits_tzs', 'active_accounts',
    'dormant_accounts', 'simbanking_activated', 'lipa_hapa_registered',
    'loans_count', 'bookings',
  ];

  const TONES = ['teal', 'green', 'gold', 'pink', 'ink'] as const;
  const LINKS: Record<string, { href: string; hint: string } | undefined> = {
    portfolio: { href: `/${locale}/staff/stations`, hint: 'Stations' },
    accounts_opened: { href: `/${locale}/staff/categories`, hint: 'By category' },
    deposits_tzs: { href: `/${locale}/staff/network`, hint: 'By zone' },
  };
  const dash = (v: number) => (nothingYet || v === 0 ? '—' : count(v, locale));

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="overview"
      nav={staffNav(locale, STAFF_LABELS)}
      title="Overview"
      scopeLabel={session.scopeLabel}
      user={session.user}
      actions={
        session.signedIn ? (
          <>
          <CardStateScript />
          <CardChooser options={CARDS} defaults={DEFAULT_CARDS} />
          <Link
            href={
              session.role === 'branch' && session.branchId
                ? `/${locale}/staff/branches/${session.branchId}`
                : `/${locale}/staff/branches`
            }
            className="btn btn--primary btn--sm"
          >
            {session.role === 'branch' ? 'My branch' : 'Branches'}
          </Link>
          </>
        ) : null
      }
    >
      {!session.signedIn ? (
        <Panel title="Sign in">
          <PanelEmpty>Nothing is visible until you sign in.</PanelEmpty>
        </Panel>
      ) : (
        <>
          <FilingBar
            locale={locale}
            dueCount={data.dueCount}
            period={formatPeriod(new Date().toISOString(), locale)}
            total={data.activeStations}
          />

          <div className={styles.metrics}>
            {data.metrics.map((metric, i) => (
              <MetricCard
                key={metric.key}
                cardKey={metric.key}
                tone={TONES[i % TONES.length]}
                label={metric.label}
                value={
                  nothingYet || metric.total === 0
                    ? '—'
                    : metric.unit === 'money'
                      ? money(metric.total, locale, true)
                      : count(metric.total, locale)
                }
                note={
                  metric.categories === 1
                    ? 'One category'
                    : `${metric.categories} categories`
                }
                href={LINKS[metric.key]?.href}
                hint={LINKS[metric.key]?.hint}
              />
            ))}
            <MetricCard
              tone="teal"
              cardKey="bookings"
              label="Institutions booked"
              value={data.bookings === 0 ? '—' : count(data.bookings, locale)}
              note={
                data.bookings === 0
                  ? undefined
                  : `${count(data.leadsGot, locale)} of ${count(data.leadsExpected, locale)} leads`
              }
              icon={<EventsIcon />}
              href={`/${locale}/staff/engagements`}
              hint="Engagements"
            />
          </div>

          <FoldPanel title="Coverage by category" count={data.categories.length}>
            {data.categories.length === 0 ? (
              <PanelEmpty>No categories.</PanelEmpty>
            ) : (
              <BarTable
                caption="Coverage by category"
                unitLabel="Accounts"
                rows={data.categories.map((category) => ({
                  label: category.name_en,
                  value: category.accounts_opened,
                  secondary:
                    category.portfolio > 0
                      ? `${category.coverage_pct ?? 0}% · ${count(category.stations, locale)}`
                      : `${count(category.stations, locale)} stations`,
                }))}
              />
            )}
          </FoldPanel>

          <Panel
            title="Events"
            action={
              <Link href={`/${locale}/staff/events`} className={styles.panelLink}>
                All →
              </Link>
            }
          >
            {data.eventList.length === 0 ? (
              <PanelEmpty>None recorded.</PanelEmpty>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Event</th>
                      <th scope="col">When</th>
                      <th scope="col" className={styles.num}>Turnout</th>
                      <th scope="col" className={styles.num}>Accounts</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.eventList.map((event) => (
                      <tr key={event.id}>
                        <th scope="row">
                          <Link href={`/${locale}/staff/events/${event.id}`} className={styles.link}>
                            {event.name}
                          </Link>
                          <span className={styles.sub}>{event.venue}</span>
                        </th>
                        <td>
                          {new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          }).format(new Date(event.event_date))}
                        </td>
                        <td className={styles.num}>
                          {event.participants ? count(event.participants, locale) : '—'}
                        </td>
                        <td className={styles.num}>
                          {event.accounts_opened ? count(event.accounts_opened, locale) : '—'}
                        </td>
                        <td>
                          <span className={event.past ? styles.chip : styles.chipActive}>
                            {event.past ? 'Held' : 'Upcoming'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <FoldPanel title="Recent" count={data.recent.length}>
            {data.recent.length === 0 ? (
              <PanelEmpty>Nothing yet.</PanelEmpty>
            ) : (
              <ol className={styles.activity}>
                {data.recent.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className={styles.activityItem}>
                    <span className={`${styles.activityDot} ${styles[item.kind]}`} aria-hidden="true" />
                    <span className={styles.activityText}>
                      <strong>{item.title}</strong> {item.detail}
                    </span>
                    <time className={styles.activityAt} dateTime={item.at}>
                      {new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
                        day: 'numeric', month: 'short',
                      }).format(new Date(item.at))}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </FoldPanel>
        </>
      )}
    </StaffShell>
  );
}
