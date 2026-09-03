import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { Finder } from '@/components/staff/Finder';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import {
  count, currentPeriod, formatPeriod, getCategories, money,
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

interface Row {
  id: string;
  name: string;
  category_id: string;
  district_name: string | null;
  address: string | null;
  portfolio: number | null;
  last_report_month: string | null;
}

/**
 * Find an institution.
 *
 * This screen used to be the register printed out: the first thousand names
 * in alphabetical order, in a table, to be scrolled. With twenty-one thousand
 * institutions on the register that is not a slow way to find one — past
 * roughly "K" it is not a way to find one at all, because the answer was
 * never on the page.
 *
 * So the search is the screen. Under it are the only two lists worth keeping
 * standing: what has not been filed this period, which is work, and what was
 * touched most recently, which is where somebody probably left off. Both are
 * short on purpose. Everything else is a keyword away.
 */
export default async function StationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();
  const period = currentPeriod();

  const categories = await getCategories();
  const categoryName = new Map(categories.map((c) => [c.id, c.name_en]));

  /* Counts come from the views, which sum in Postgres. They used to be
     `stations.length` over whatever the thousand-row query returned, so this
     screen has been reporting a thousand institutions and the deposits of a
     thousand institutions for as long as the register has been bigger than
     that. */
  const [countsRes, totalsRes, dueRes, recentRes] = supabase && session.signedIn
    ? await Promise.all([
        supabase.from('station_counts' as never).select('*').maybeSingle(),
        supabase.from('overview_totals' as never).select('*').maybeSingle(),
        supabase.from('stations' as never)
          .select('id, name, category_id, district_name, address, portfolio, last_report_month')
          .eq('status', 'active')
          .or(`last_report_month.is.null,last_report_month.neq.${period}`)
          .order('last_report_month', { ascending: true, nullsFirst: true })
          .order('name', { ascending: true })
          .limit(25),
        supabase.from('stations' as never)
          .select('id, name, category_id, district_name, address, portfolio, last_report_month')
          .not('last_report_month', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(10),
      ])
    : [null, null, null, null];

  const counts = (countsRes?.data ?? {}) as Record<string, unknown>;
  const totals = (totalsRes?.data ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => Number(v ?? 0);

  const due = (dueRes?.data as unknown as Row[]) ?? [];
  const recent = (recentRes?.data as unknown as Row[]) ?? [];

  const tracked = n(counts.stations);
  const reported = n(counts.reported_this_period);

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
          <Panel title="Search">
            <Finder
              autoFocus
              label="Institution"
              placeholder="Type a name, a district or a region"
              href={(station) => `/${locale}/staff/stations/${station.id}`}
            />
          </Panel>

          <div className={styles.metrics}>
            <MetricCard tone="teal" label="Stations tracked" value={count(tracked, locale)}
              note={`${count(n(counts.active_stations), locale)} active`} />
            <MetricCard tone="green" label="Reported this month" value={count(reported, locale)}
              note={n(counts.due_this_period) === 0
                ? 'All in'
                : `${count(n(counts.due_this_period), locale)} outstanding`} />
            <MetricCard tone="gold" label="People covered" value={count(n(totals.portfolio), locale)}
              note="Sum of the newest report per station" />
            <MetricCard tone="ink" label="Deposits mobilised"
              value={money(n(totals.deposits_tzs), locale, true)}
              note="Newest report per station" />
          </div>

          <Panel title="Waiting on a report">
            {due.length === 0 ? (
              <PanelEmpty>Every station in your scope has filed this period.</PanelEmpty>
            ) : (
              <StationTable
                rows={due}
                locale={locale}
                categoryName={categoryName}
                period={period}
              />
            )}
          </Panel>

          <Panel title="Filed most recently">
            {recent.length === 0 ? (
              <PanelEmpty>Nothing has been filed yet.</PanelEmpty>
            ) : (
              <StationTable
                rows={recent}
                locale={locale}
                categoryName={categoryName}
                period={period}
              />
            )}
          </Panel>
        </>
      )}
    </StaffShell>
  );
}

function StationTable({
  rows, locale, categoryName, period,
}: {
  rows: Row[];
  locale: string;
  categoryName: Map<string, string>;
  period: string;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Station</th>
            <th scope="col">Category</th>
            <th scope="col" className={styles.num}>People</th>
            <th scope="col">Last report</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((station) => (
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
              <td>
                {station.last_report_month ? (
                  <span className={station.last_report_month === period
                    ? styles.chipActive : styles.chip}>
                    {formatPeriod(station.last_report_month, locale)}
                  </span>
                ) : (
                  <span className={styles.chipWarn}>never</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
