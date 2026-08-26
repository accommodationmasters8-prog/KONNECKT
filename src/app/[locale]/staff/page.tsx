import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { MetricCard } from '@/components/staff/MetricCard';
import { BarChart, BarTable, PieChart } from '@/components/staff/Charts';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
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

  const trendPoints = data.trend.map((point) => ({
    label: formatPeriod(`${point.month}-01`, locale).replace(/\s\d{4}$/, ''),
    value: point.deposits,
  }));

  const accountsTrend = data.trend.map((point) => ({
    label: formatPeriod(`${point.month}-01`, locale).replace(/\s\d{4}$/, ''),
    value: point.accounts,
  }));

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
          <Link href={`/${locale}/staff/stations`} className="btn btn--primary btn--sm">
            Add a station
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
            />
          </div>

          {/* The reporting gap, stated before any chart. A dashboard that
              charts three branches out of forty and does not say so is worse
              than one that shows nothing. */}
          <div className={styles.reportingBar}>
            <span className={styles.reportingCount}>
              {data.reportedThisMonth} of {data.activeStations}
            </span>
            <span className={styles.reportingLabel}>
              active stations have reported {formatPeriod(new Date().toISOString(), locale)}
              {data.awaitingReport > 0
                ? ` — ${data.awaitingReport} still to come in`
                : ' — all in'}
            </span>
            <Link href={`/${locale}/staff/stations`} className={styles.reportingLink}>
              Update a station →
            </Link>
          </div>

          <div className={styles.split}>
            <Panel
              title="Deposits mobilised"
              description="The sum of what every station reported that month. A month with fewer reports in it shows a lower figure — the bar above says how many are in."
            >
              <BarChart
                points={trendPoints}
                title="Deposits mobilised by month"
                format={(v) => money(v, locale, true)}
                tone="teal"
              />
            </Panel>

            <Panel
              title="Where the accounts stand"
              description="Of everything opened, how much is still being used."
            >
              {data.accountsOpened === 0 ? (
                <PanelEmpty>
                  No accounts reported yet. This splits active from dormant as
                  soon as the first station reports.
                </PanelEmpty>
              ) : (
                <PieChart
                  title="Active against dormant accounts"
                  slices={[
                    { label: 'Active', value: data.activeAccounts, tone: 'green' },
                    { label: 'Dormant', value: data.dormantAccounts, tone: 'gold' },
                    {
                      label: 'Neither reported',
                      value: Math.max(
                        data.accountsOpened - data.activeAccounts - data.dormantAccounts, 0),
                      tone: 'slate',
                    },
                  ]}
                />
              )}
            </Panel>
          </div>

          <Panel
            title="Coverage by category"
            description="How much of each category's people actually bank with CRDB. The number that decides where next month goes."
            action={
              <Link href={`/${locale}/staff/categories`} className={styles.panelLink}>
                Open categories →
              </Link>
            }
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
          </Panel>

          <div className={styles.split}>
            <Panel
              title="Accounts opened by month"
              description="Reported, not projected."
            >
              <BarChart
                points={accountsTrend}
                title="Accounts opened by month"
                format={(v) => count(v, locale)}
                tone="green"
              />
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
          </div>
        </>
      )}
    </StaffShell>
  );
}
