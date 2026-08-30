import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { BarChart, PieChart } from '@/components/staff/Charts';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import {
  getBranchStations, getCategoryBreakdown, getNetwork, zoneWording,
} from '@/lib/network';
import { count, formatPeriod, money } from '@/lib/tracker';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Performance — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * Who is doing well, and who is not.
 *
 * One screen that changes what it compares depending on who opens it: HQ
 * compares zones, a zone manager compares the branches beneath them, a branch
 * officer sees their own row against the same KPIs their zone is reading. The
 * `?zone=` parameter is the drill-down — HQ opens the country, picks a zone,
 * and the same table redraws as that zone's branches.
 *
 * Ranked by deposits mobilised, because that is the figure the bank is
 * actually managing. Coverage is shown beside it and often disagrees, which is
 * the point: the biggest book and the best-worked catchment are rarely the
 * same place, and a table that only showed one of them would hide that.
 */
export default async function NetworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ zone?: string; branch?: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const { zone, branch } = await searchParams;
  const session = await getStaffSession();
  const nav = staffNav(locale, STAFF_LABELS);

  if (!session.signedIn) {
    return (
      <StaffShell
        locale={locale} role={session.role} active="network" nav={nav}
        title="Performance" scopeLabel={session.scopeLabel} user={session.user}
      >
        <Panel title="Performance">
          <PanelEmpty>Sign in to compare what your role can reach.</PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  const [view, byCategory, branchStations] = await Promise.all([
    getNetwork(session.role, zone),
    // The snapshot below the table: what this zone or branch is made of.
    getCategoryBreakdown({ zone, branchId: branch }),
    // The bottom of the trail: the actual places inside one branch.
    branch ? getBranchStations(branch) : Promise.resolve([]),
  ]);

  const openBranch = branch
    ? view.rows.find((r) => r.key === branch) ?? null
    : null;
  const isZoneTable = view.level === 'zone';
  const noun = isZoneTable ? 'zone' : 'branch';

  const best = view.rows[0];
  const worst = view.rows.length > 1 ? view.rows[view.rows.length - 1] : null;
  const bestCoverage = view.rows
    .filter((r) => r.coveragePct !== null)
    .sort((a, b) => (b.coveragePct ?? 0) - (a.coveragePct ?? 0))[0];

  const gap = view.totals ? view.totals.stations - view.totals.reporting : 0;

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="network"
      nav={nav}
      title={
        openBranch ? openBranch.name
          : zone ? `${zoneWording(zone)} zone`
            : 'Performance'
      }
      scopeLabel={[
        `${count(view.rows.length, locale)} ${noun}${view.rows.length === 1 ? '' : 's'}`,
        view.latestMonth ? formatPeriod(view.latestMonth, locale) : 'nothing reported',
        session.scopeLabel,
      ].join(' · ')}
      user={session.user}
      actions={
        branch && zone ? (
          <Link href={`/${locale}/staff/network?zone=${zone}`} className={styles.link}>
            ← Back to {zoneWording(zone)}
          </Link>
        ) : zone || branch ? (
          <Link href={`/${locale}/staff/network`} className={styles.link}>
            ← All zones
          </Link>
        ) : null
      }
    >
      <div className={styles.metrics}>
        <MetricCard
          tone="teal"
          label="Deposits mobilised"
          value={view.totals ? money(view.totals.deposits, locale, true) : '—'}
          note={view.latestMonth ? formatPeriod(view.latestMonth, locale) : 'Nothing reported'}
        />
        <MetricCard
          tone="green"
          label={`Best ${noun}`}
          value={best ? best.name : '—'}
          note={best ? money(best.deposits, locale, true) : 'Nothing to rank'}
        />
        <MetricCard
          tone="gold"
          label="Best coverage"
          value={bestCoverage ? `${bestCoverage.coveragePct}%` : '—'}
          note={bestCoverage ? bestCoverage.name : 'Needs a headcount'}
        />
        <MetricCard
          tone="ink"
          label="Yet to report"
          value={count(gap, locale)}
          note={
            view.totals
              ? `of ${count(view.totals.stations, locale)} stations`
              : 'No stations'
          }
        />
      </div>

      {view.rows.length === 0 ? (
        <Panel title="Nothing to compare">
          <PanelEmpty>
            No stations are visible at your level yet. They appear here as soon
            as a branch adds one.
          </PanelEmpty>
        </Panel>
      ) : (
        <>
          <div className={styles.split}>
            <Panel
              title={`Deposits by ${noun}`}
              description="Newest month reported. The bar is the book; the table below adds coverage, which often disagrees."
            >
              <BarChart
                title={`Deposits mobilised by ${noun}`}
                points={view.rows.slice(0, 8).map((r) => ({
                  label: r.name.length > 12 ? `${r.name.slice(0, 11)}…` : r.name,
                  value: r.deposits,
                }))}
                format={(v) => money(v, locale, true)}
                tone="teal"
              />
            </Panel>

            <Panel
              title="How the book divides"
              description={`Share of deposits across every ${noun} that reported.`}
            >
              <PieChart
                title={`Share of deposits by ${noun}`}
                format={(v) => money(v, locale, true)}
                slices={view.rows.slice(0, 5).map((r, i) => ({
                  label: r.name,
                  value: r.deposits,
                  tone: (['teal', 'green', 'gold', 'pink', 'slate'] as const)[i],
                }))}
              />
            </Panel>
          </div>

          <Panel
            title={isZoneTable ? 'Every zone' : 'Every branch'}
            description={
              isZoneTable
                ? 'Ranked by deposits. Click a zone to open the branches inside it.'
                : 'Ranked by deposits. Coverage is what is left to win.'
            }
            /* Performance ranks; the tree changes. Missing a zone or a branch
               here means it does not exist yet, and this is the one click to
               where it is created — rather than a second create form sitting
               inside a comparison, disagreeing with the first. */
            action={
              <Link href={`/${locale}/staff/branches`} className={styles.panelLink}>
                {isZoneTable ? 'Add a zone or branch →' : 'Add a branch →'}
              </Link>
            }
          >
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{isZoneTable ? 'Zone' : 'Branch'}</th>
                    <th scope="col" className={styles.num}>Stations</th>
                    <th scope="col" className={styles.num}>Reported</th>
                    <th scope="col" className={styles.num}>People</th>
                    <th scope="col" className={styles.num}>Accounts</th>
                    <th scope="col" className={styles.num}>Coverage</th>
                    <th scope="col" className={styles.num}>Deposits</th>
                    <th scope="col" className={styles.num}>vs last month</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">
                        {isZoneTable ? (
                          <Link
                            href={`/${locale}/staff/network?zone=${row.key}`}
                            className={styles.link}
                          >
                            {row.name}
                          </Link>
                        ) : (
                          <Link
                            href={`/${locale}/staff/network?${zone ? `zone=${zone}&` : ''}branch=${row.key}`}
                            className={styles.link}
                          >
                            {row.name}
                          </Link>
                        )}
                        {row.branches !== null ? (
                          <span className={styles.sub}>
                            {count(row.branches, locale)} branches
                          </span>
                        ) : null}
                      </th>
                      <td className={styles.num}>{count(row.stations, locale)}</td>
                      <td className={styles.num}>
                        {row.reporting < row.stations ? (
                          <span className={styles.chipWarn}>
                            {row.reporting}/{row.stations}
                          </span>
                        ) : (
                          <span className={styles.chipActive}>all in</span>
                        )}
                      </td>
                      <td className={styles.num}>{count(row.portfolio, locale)}</td>
                      <td className={styles.num}>{count(row.accountsOpened, locale)}</td>
                      <td className={styles.num}>
                        {row.coveragePct === null ? '—' : `${row.coveragePct}%`}
                      </td>
                      <td className={styles.num}>{money(row.deposits, locale, true)}</td>
                      <td className={styles.num}>
                        {row.momPct === null ? '—' : (
                          <span className={row.momPct >= 0 ? styles.up : styles.down}>
                            {row.momPct >= 0 ? '▲' : '▼'} {Math.abs(row.momPct)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {view.totals ? (
                  <tfoot>
                    <tr>
                      <th scope="row">All</th>
                      <td className={styles.num}>{count(view.totals.stations, locale)}</td>
                      <td className={styles.num}>
                        {view.totals.reporting}/{view.totals.stations}
                      </td>
                      <td className={styles.num}>{count(view.totals.portfolio, locale)}</td>
                      <td className={styles.num}>{count(view.totals.accountsOpened, locale)}</td>
                      <td className={styles.num}>
                        {view.totals.coveragePct === null ? '—' : `${view.totals.coveragePct}%`}
                      </td>
                      <td className={styles.num}>{money(view.totals.deposits, locale, true)}</td>
                      <td className={styles.num}>—</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </Panel>

          {branch && branchStations.length > 0 ? (
            <Panel
              title={`Stations in ${openBranch?.name ?? 'this branch'}`}
              description="Every place this branch reports on, ranked by deposits. Click one to open its full history or file a period."
            >
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
                    {branchStations.map((station) => (
                      <tr key={station.id}>
                        <th scope="row">
                          <Link href={`/${locale}/staff/stations/${station.id}`} className={styles.link}>
                            {station.name}
                          </Link>
                          <span className={styles.sub}>click to open</span>
                        </th>
                        <td>{station.category}</td>
                        <td className={styles.num}>{count(station.portfolio, locale)}</td>
                        <td className={styles.num}>{count(station.accountsOpened, locale)}</td>
                        <td className={styles.num}>
                          {station.coveragePct === null ? '—' : `${station.coveragePct}%`}
                        </td>
                        <td className={styles.num}>{money(station.deposits, locale, true)}</td>
                        <td>
                          {station.lastReport
                            ? <span className={styles.chip}>{formatPeriod(station.lastReport, locale)}</span>
                            : <span className={styles.chipWarn}>never</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {byCategory.length > 0 ? (
            <Panel
              title="By category"
              description="What the book here is actually made of. A branch with most of its deposits in one category is a different problem from one spread evenly, and the ranking above cannot tell them apart."
            >
              <div className={styles.split}>
                <PieChart
                  title="Deposits by category"
                  format={(v) => money(v, locale, true)}
                  slices={byCategory.slice(0, 5).map((c, i) => ({
                    label: c.name,
                    value: c.deposits,
                    tone: (['teal', 'green', 'gold', 'pink', 'slate'] as const)[i],
                  }))}
                />

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col" className={styles.num}>Stations</th>
                        <th scope="col" className={styles.num}>People</th>
                        <th scope="col" className={styles.num}>Accounts</th>
                        <th scope="col" className={styles.num}>Coverage</th>
                        <th scope="col" className={styles.num}>Deposits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byCategory.map((c) => (
                        <tr key={c.key}>
                          <th scope="row">{c.name}</th>
                          <td className={styles.num}>{count(c.stations, locale)}</td>
                          <td className={styles.num}>{count(c.portfolio, locale)}</td>
                          <td className={styles.num}>{count(c.accountsOpened, locale)}</td>
                          <td className={styles.num}>
                            {c.coveragePct === null ? '—' : `${c.coveragePct}%`}
                          </td>
                          <td className={styles.num}>{money(c.deposits, locale, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          ) : null}

          {worst ? (
            <Panel
              title="Where the attention goes"
              description="Not a league table for its own sake — the bottom of it is the plan."
            >
              <p className={styles.plainNote}>
                <strong>{worst.name}</strong> is last on deposits with{' '}
                {money(worst.deposits, locale, true)} across{' '}
                {count(worst.stations, locale)} stations
                {worst.coveragePct !== null
                  ? ` and ${worst.coveragePct}% coverage`
                  : ' and no headcount reported'}
                . {best ? (
                  <>
                    {best.name} is doing {
                      worst.deposits > 0
                        ? `${Math.round((best.deposits / worst.deposits) * 10) / 10}×`
                        : 'all'
                    } the volume.
                  </>
                ) : null}
              </p>
            </Panel>
          ) : null}
        </>
      )}
    </StaffShell>
  );
}
