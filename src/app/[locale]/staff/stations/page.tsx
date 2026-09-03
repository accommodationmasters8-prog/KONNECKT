import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import {
  count, formatPeriod, getCategories, getStationLatest, getStations, money,
} from '@/lib/tracker';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Stations — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * Every station in scope, with where it stands.
 *
 * The list is deliberately a table rather than cards: this is the screen a
 * branch officer opens to find the one place they need to update, and forty
 * cards is forty things to read before finding it.
 */
export default async function StationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  const [stations, latest, categories] = await Promise.all([
    getStations(),
    getStationLatest(),
    getCategories(),
  ]);

  let branches: { id: string; name: string }[] = [];
  if (supabase && session.signedIn && session.role !== 'branch') {
    const { data } = await supabase
      .from('branches' as never)
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(300);
    branches = (data as unknown as { id: string; name: string }[]) ?? [];
  }

  const categoryName = new Map(categories.map((c) => [c.id, c.name_en]));
  const thisMonth = new Date().toISOString().slice(0, 7);

  const reported = stations.filter(
    (s) => s.last_report_month?.slice(0, 7) === thisMonth,
  ).length;

  const totalPortfolio = [...latest.values()].reduce((n, r) => n + Number(r.portfolio ?? 0), 0);
  const totalDeposits = [...latest.values()].reduce((n, r) => n + Number(r.deposits_tzs ?? 0), 0);

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="stations"
      nav={staffNav(locale, STAFF_LABELS)}
      title="Find a station"
      scopeLabel={session.scopeLabel}
      user={session.user}
      actions={
        <>
          {session.role === 'hq' || session.role === 'zone' ? (
            <Link href={`/${locale}/staff/import?kind=stations`} className={styles.link}>
              Import a list
            </Link>
          ) : null}
          <Link href={`/${locale}/staff/branches`} className={styles.link}>
            ← The tree: zones, branches, stations
          </Link>
        </>
      }
    >
      {!session.signedIn ? (
        <Panel title="Find a station">
          <PanelEmpty>Sign in to see the stations your role can reach.</PanelEmpty>
        </Panel>
      ) : (
        <>
          <div className={styles.metrics}>
            <MetricCard tone="teal" label="Stations tracked" value={count(stations.length, locale)}
              note={`${count(stations.filter((s) => s.status === 'active').length, locale)} active`} />
            <MetricCard tone="green" label="Reported this month" value={count(reported, locale)}
              note={reported === stations.length ? 'All in' : `${stations.length - reported} outstanding`} />
            <MetricCard tone="gold" label="People covered" value={count(totalPortfolio, locale)}
              note="Sum of the newest report per station" />
            <MetricCard tone="ink" label="Deposits mobilised" value={money(totalDeposits, locale, true)}
              note="Newest report per station" />
          </div>

          <Panel
            title="Every station you can reach"
          >
            {stations.length === 0 ? (
              <PanelEmpty>
                Nothing tracked yet. Add the first station below — an
                institution, organisation, school or group your branch works
                with.
              </PanelEmpty>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Station</th>
                      <th scope="col">Category</th>
                      <th scope="col" className={styles.num}>People</th>
                      <th scope="col" className={styles.num}>Accounts</th>
                      <th scope="col" className={styles.num}>Coverage</th>
                      <th scope="col" className={styles.num}>Deposits</th>
                      <th scope="col">Last report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stations.map((station) => {
                      const l = latest.get(station.id);
                      const isCurrent = station.last_report_month?.slice(0, 7) === thisMonth;
                      return (
                        <tr key={station.id}>
                          <th scope="row">
                            <Link href={`/${locale}/staff/stations/${station.id}`} className={styles.link}>
                              {station.name}
                            </Link>
                            <span className={styles.sub}>
                              {station.district_name ?? station.address ?? '—'}
                            </span>
                          </th>
                          <td>{categoryName.get(station.category_id) ?? '—'}</td>
                          <td className={styles.num}>
                            {station.portfolio === null ? '—' : count(station.portfolio, locale)}
                          </td>
                          <td className={styles.num}>
                            {l ? count(l.accounts_opened, locale) : '—'}
                          </td>
                          <td className={styles.num}>
                            {l?.coverage_pct === null || l === undefined ? '—' : `${l.coverage_pct}%`}
                          </td>
                          <td className={styles.num}>
                            {l ? money(Number(l.deposits_tzs), locale, true) : '—'}
                          </td>
                          <td>
                            {station.last_report_month ? (
                              <span className={isCurrent ? styles.chipActive : styles.chip}>
                                {formatPeriod(station.last_report_month, locale)}
                              </span>
                            ) : (
                              <span className={styles.chipWarn}>never</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

        </>
      )}
    </StaffShell>
  );
}
