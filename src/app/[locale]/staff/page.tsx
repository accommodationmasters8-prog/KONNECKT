import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { MetricCard } from '@/components/staff/MetricCard';
import { BarTable } from '@/components/staff/Charts';
import { FoldPanel, Panel, PanelEmpty } from '@/components/staff/Panel';
import { FilingBar } from '@/components/staff/FilingBar';
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
  title: 'Overview — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * The overview.
 *
 * One screen that answers, in order: how much are we tracking, how much of it
 * have we actually reached, is it growing, and what has moved lately. Scope is
 * the database's — a branch officer opening this sees their branch's figures
 * from the same code that shows HQ the country's.
 *
 * Nothing here is a target or a projection. Every figure is the sum of what
 * branches have reported, and where nothing has been reported the card says so
 * rather than showing a zero that reads like a measurement.
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

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="overview"
      nav={staffNav(locale, STAFF_LABELS)}
      title="Overview"
      scopeLabel={
        session.signedIn
          ? `${session.scopeLabel} · reported figures only`
          : session.scopeLabel
      }
      user={session.user}
      actions={
        session.signedIn ? (
          /* A branch officer owns exactly one branch, so sending them to a
             tree of eight zones to find it is three clicks of a question they
             already know the answer to. Everyone above them needs the tree. */
          <Link
            href={
              session.role === 'branch' && session.branchId
                ? `/${locale}/staff/branches/${session.branchId}`
                : `/${locale}/staff/branches`
            }
            className="btn btn--primary btn--sm"
          >
            {session.role === 'branch' ? 'My branch' : 'Zones and branches'}
          </Link>
        ) : null
      }
    >
      {!session.signedIn ? (
        <Panel title="Sign in to see your figures">
          <PanelEmpty>
            The tracker shows what your branch, your zone or the whole country
            has reported, depending on the account you sign in with. Nothing is
            visible until you do.
          </PanelEmpty>
        </Panel>
      ) : (
        <>
          {/* The job before the summary. A branch officer opens this screen to
              file, not to read four totals about the filing they have not
              done — so the outstanding stations come first, named and linked. */}
          <FilingBar
            locale={locale}
            due={data.due}
            period={formatPeriod(new Date().toISOString(), locale)}
            total={data.activeStations}
          />

          <div className={styles.metrics}>
            <MetricCard
              tone="teal"
              label="People in the portfolio"
              value={nothingYet ? '—' : count(data.portfolio, locale)}
              note={
                nothingYet
                  ? 'No stations yet'
                  : `across ${count(data.activeStations, locale)} active stations`
              }
              icon={<StationsIcon />}
              href={`/${locale}/staff/stations`}
              hint="Every station"
            />
            <MetricCard
              tone="green"
              label="Accounts opened"
              value={nothingYet ? '—' : count(data.accountsOpened, locale)}
              note={
                data.coveragePct === null
                  ? 'Coverage needs a portfolio figure'
                  : `${data.coveragePct}% of the portfolio reached`
              }
              icon={<AccountsIcon />}
              href={`/${locale}/staff/categories`}
              hint="By category"
            />
            <MetricCard
              tone="gold"
              label="Deposits mobilised"
              value={nothingYet ? '—' : money(data.deposits, locale, true)}
              note={
                data.loansValue > 0
                  ? `${money(data.loansValue, locale, true)} in loans`
                  : 'No loans reported yet'
              }
              icon={<CategoriesIcon />}
              href={`/${locale}/staff/network`}
              hint="Who is producing it"
            />
            <MetricCard
              tone="ink"
              label="Events tracked"
              value={count(data.events.total, locale)}
              note={
                data.events.total === 0
                  ? 'Nothing recorded yet'
                  : `${data.events.past} past · ${data.events.upcoming} upcoming`
              }
              icon={<EventsIcon />}
              href={`/${locale}/staff/events`}
              hint="Every event"
            />
          </div>


          <FoldPanel
            title="Coverage by category"
            count={data.categories.length}
            note="How much of each category actually banks with CRDB"
          >
            {data.categories.length === 0 ? (
              <PanelEmpty>No categories yet.</PanelEmpty>
            ) : (
              <BarTable
                caption="Coverage by category"
                unitLabel="Accounts"
                rows={data.categories.map((category) => ({
                  label: category.name_en,
                  value: category.accounts_opened,
                  secondary:
                    category.portfolio > 0
                      ? `${category.coverage_pct ?? 0}% of ${count(category.portfolio, locale)} · ${category.stations} stations`
                      : `${category.stations} stations · no portfolio reported`,
                }))}
              />
            )}
          </FoldPanel>

          <Panel
            title="Events"
            description="The next three and the last three. Click one to open it; everything else is on the events screen."
            action={
              <Link href={`/${locale}/staff/events`} className={styles.panelLink}>
                All events →
              </Link>
            }
          >
            {data.eventList.length === 0 ? (
              <PanelEmpty>
                Nothing recorded yet. An event added by any branch you can
                reach appears here.
              </PanelEmpty>
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


          <Panel
            title="What has moved"
              description="Every station added, every report filed, every event recorded — newest first."
            >
              {data.recent.length === 0 ? (
                <PanelEmpty>
                  Nothing yet. Adding a station or filing a report puts it here,
                  and in the audit log.
                </PanelEmpty>
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
          </Panel>
        </>
      )}
    </StaffShell>
  );
}
