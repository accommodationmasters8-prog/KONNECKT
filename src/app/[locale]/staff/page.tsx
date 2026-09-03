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

  /* One list, used by both the picker and the cards below, so the menu can
     never offer a card that is not there or miss one that is. */
  const CARDS = [
    { key: 'portfolio', label: 'Total portfolio' },
    { key: 'accounts', label: 'Accounts opened' },
    { key: 'deposits', label: 'Deposits mobilised' },
    { key: 'active', label: 'Active accounts' },
    { key: 'dormant', label: 'Dormant accounts' },
    { key: 'simbanking', label: 'SimBanking' },
    { key: 'lipahapa', label: 'Lipa Hapa' },
    { key: 'loans', label: 'Loans disbursed' },
    { key: 'bookings', label: 'Institutions booked' },
  ];
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
          <CardChooser options={CARDS} />
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

          {/* The nine the bank tracks, in the order it reads them. */}
          <div className={styles.metrics}>
            <MetricCard
              tone="teal"
              cardKey="portfolio"
              label="Total portfolio"
              value={dash(data.portfolio)}
              icon={<StationsIcon />}
              href={`/${locale}/staff/stations`}
              hint="Stations"
            />
            <MetricCard
              tone="green"
              cardKey="accounts"
              label="Accounts opened"
              value={dash(data.accountsOpened)}
              note={data.coveragePct === null ? undefined : `${data.coveragePct}% of portfolio`}
              icon={<AccountsIcon />}
              href={`/${locale}/staff/categories`}
              hint="By category"
            />
            <MetricCard
              tone="gold"
              cardKey="deposits"
              label="Deposits mobilised"
              value={nothingYet || data.deposits === 0 ? '—' : money(data.deposits, locale, true)}
              icon={<CategoriesIcon />}
              href={`/${locale}/staff/network`}
              hint="By zone"
            />
            <MetricCard
              tone="teal"
              cardKey="active"
              label="Active accounts"
              value={dash(data.activeAccounts)}
            />
            <MetricCard
              tone="pink"
              cardKey="dormant"
              label="Dormant accounts"
              value={dash(data.dormantAccounts)}
              note={data.dormancyPct === null ? undefined : `${data.dormancyPct}% dormant`}
            />
            <MetricCard
              tone="ink"
              cardKey="simbanking"
              label="SimBanking"
              value={dash(data.simbanking)}
            />
            <MetricCard
              tone="green"
              cardKey="lipahapa"
              label="Lipa Hapa"
              value={dash(data.lipaHapa)}
            />
            <MetricCard
              tone="gold"
              cardKey="loans"
              label="Loans disbursed"
              value={nothingYet || data.loansValue === 0 ? '—' : money(data.loansValue, locale, true)}
              note={data.loansCount > 0 ? `${count(data.loansCount, locale)} loans` : undefined}
            />
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
