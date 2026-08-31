import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { PieChart } from '@/components/staff/Charts';
import { StationForm } from '@/components/staff/StationForms';
import { BranchForm } from '@/components/staff/BranchForms';
import { FilingBar } from '@/components/staff/FilingBar';
import { ImportForm } from '@/components/staff/ImportForm';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import {
  getAccountTypeBreakdown, getBranchStations, getCategoryBreakdown, zoneWording,
} from '@/lib/network';
import { getZones } from '@/lib/zones';
import { count, formatPeriod, getCategories, money } from '@/lib/tracker';
import { resolveLocale } from '@/lib/page';
import styles from '../../staff.module.css';

/* The categorical order, fixed. A series keeps its colour when the list is
   filtered — colour follows the entity, never its rank — and gold sits
   between crimson and green because those two collapse into each other under
   deuteranopia when placed side by side. */
const SERIES = ['teal', 'indigo', 'pink', 'gold', 'green'] as const;

export const metadata: Metadata = {
  title: 'Branch — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * One branch, and everything it owns.
 *
 * This is where a station is added, because a station cannot exist without a
 * branch — `branch_id` is NOT NULL — and the old flat "add a station" form
 * asked for the branch as a dropdown, which is a question with exactly one
 * right answer whenever you arrived from the branch itself. Coming here first
 * makes that field disappear.
 */
export default async function BranchPage({
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
        locale={locale} role={session.role} active="branches" nav={nav}
        title="Branch" scopeLabel={session.scopeLabel} user={session.user}
      >
        <Panel title="Branch">
          <PanelEmpty>Sign in to open a branch.</PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  const [branchRes, stations, byCategory, categories, zones, byAccountType] = await Promise.all([
    supabase.from('branches' as never)
      .select('id, name, zone_code, year_established, year_refurbished, is_active, notes')
      .eq('id', id)
      .maybeSingle(),
    getBranchStations(id),
    getCategoryBreakdown({ branchId: id }),
    getCategories(),
    getZones(),
    getAccountTypeBreakdown({ branchId: id }),
  ]);

  const branch = branchRes.data as unknown as {
    id: string; name: string; zone_code: string | null;
    year_established: number | null; year_refurbished: number | null;
    is_active: boolean; notes: string | null;
  } | null;

  if (!branch) notFound();

  const totals = stations.reduce(
    (a, s) => ({
      portfolio: a.portfolio + s.portfolio,
      accounts: a.accounts + s.accountsOpened,
      deposits: a.deposits + s.deposits,
      reporting: a.reporting + (s.lastReport ? 1 : 0),
    }),
    { portfolio: 0, accounts: 0, deposits: 0, reporting: 0 },
  );

  const coverage = totals.portfolio > 0
    ? Math.round((totals.accounts / totals.portfolio) * 1000) / 10
    : null;

  const openedByType = byAccountType.reduce((a, t) => a + t.opened, 0);

  const channels = stations.reduce(
    (a, s) => ({
      simbanking: a.simbanking + s.simbanking,
      cards: a.cards + s.cards,
      lipaHapa: a.lipaHapa + s.lipaHapa,
      loans: a.loans + s.loans,
      loanValue: a.loanValue + s.loanValue,
    }),
    { simbanking: 0, cards: 0, lipaHapa: 0, loans: 0, loanValue: 0 },
  );

  // What is still to file, at this branch, this period.
  //
  // A branch officer opening their own branch is here to record, not to read
  // four totals about the recording they have not done — so the outstanding
  // stations come first and are named, because a count is a status and a name
  // is the next click.
  const period = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const due = stations
    .filter((s) => !s.lastReport || !s.lastReport.startsWith(period))
    .map((s) => ({
      id: s.id,
      name: s.name,
      lastReport: s.lastReport ? formatPeriod(s.lastReport, locale) : null,
    }));

  // HQ edits any branch; a zone manager edits the ones in their own zone.
  // Row level security says the same thing underneath — this decides whether
  // the form is worth rendering, not whether the write is allowed.
  const canEdit = session.role === 'hq'
    || (session.role === 'zone' && session.zone !== null && session.zone === branch.zone_code);

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="branches"
      nav={nav}
      title={branch.name}
      scopeLabel={[
        branch.zone_code ? `${zoneWording(branch.zone_code)} zone` : 'No zone assigned',
        `${count(stations.length, locale)} stations`,
        branch.year_established ? `since ${branch.year_established}` : null,
      ].filter(Boolean).join(' · ')}
      user={session.user}
      actions={
        <>
          {branch.zone_code ? (
            <Link
              href={`/${locale}/staff/network?zone=${branch.zone_code}&branch=${branch.id}`}
              className={styles.link}
            >
              Compare in zone
            </Link>
          ) : null}
          <Link href={`/${locale}/staff/branches`} className={styles.link}>
            ← All branches
          </Link>
        </>
      }
    >
      <FilingBar
        locale={locale}
        due={due}
        period={formatPeriod(new Date().toISOString(), locale)}
        total={stations.length}
      />

      <div className={styles.metrics}>
        <MetricCard tone="teal" label="Stations" value={count(stations.length, locale)}
          note={`${count(totals.reporting, locale)} have reported at least once`} />
        <MetricCard tone="green" label="Accounts opened"
          value={totals.accounts > 0 ? count(totals.accounts, locale) : '—'}
          note={coverage === null ? 'Coverage needs a headcount' : `${coverage}% coverage`} />
        <MetricCard tone="gold" label="Deposits mobilised"
          value={totals.deposits > 0 ? money(totals.deposits, locale, true) : '—'}
          note="Newest period from each station" />
        <MetricCard tone="ink" label="Youth reached"
          value={totals.portfolio > 0 ? count(totals.portfolio, locale) : '—'}
          note="Across every station here" />
      </div>

      {/* The channels, for this branch. An account opened and never activated
          is a number on a form, and the total above cannot tell you which. */}
      <div className={styles.metrics}>
        <MetricCard tone="teal" label="SimBanking activated"
          value={channels.simbanking > 0 ? count(channels.simbanking, locale) : '—'}
          note={totals.accounts > 0
            ? `${Math.round((channels.simbanking / totals.accounts) * 1000) / 10}% of accounts opened here`
            : 'Nothing opened yet'} />
        <MetricCard tone="green" label="Lipa Hapa registered"
          value={channels.lipaHapa > 0 ? count(channels.lipaHapa, locale) : '—'}
          note={totals.accounts > 0
            ? `${Math.round((channels.lipaHapa / totals.accounts) * 1000) / 10}% of accounts opened here`
            : 'Nothing opened yet'} />
        <MetricCard tone="gold" label="Cards issued"
          value={channels.cards > 0 ? count(channels.cards, locale) : '—'}
          note={totals.accounts > 0
            ? `${Math.round((channels.cards / totals.accounts) * 1000) / 10}% of accounts opened here`
            : 'Nothing opened yet'} />
        <MetricCard tone="pink" label="Loans given"
          value={channels.loans > 0 ? count(channels.loans, locale) : '—'}
          note={channels.loanValue > 0
            ? `${money(channels.loanValue, locale, true)} lent`
            : 'No loans reported here'} />
      </div>

      <Panel
        title="Accounts opened, by type"
        description="What the total above is actually made of. A branch opening everything on one product has a different conversation ahead of it from one spread across five."
      >
        {byAccountType.length === 0 ? (
          <PanelEmpty>
            No account-type split filed yet. The total is recorded on the
            station&rsquo;s report; the split is entered underneath it, and HQ
            decides which types belong to which category in Settings.
          </PanelEmpty>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Account type</th>
                    <th scope="col" className={styles.num}>Opened</th>
                    <th scope="col" className={styles.num}>Share</th>
                    <th scope="col" className={styles.num}>Active</th>
                    <th scope="col" className={styles.num}>Dormant</th>
                    <th scope="col" className={styles.num}>Deposits</th>
                  </tr>
                </thead>
                <tbody>
                  {byAccountType.map((type) => (
                    <tr key={type.code}>
                      <th scope="row">{type.label}</th>
                      <td className={styles.num}>{count(type.opened, locale)}</td>
                      <td className={styles.num}>
                        {openedByType > 0
                          ? `${Math.round((type.opened / openedByType) * 1000) / 10}%`
                          : '—'}
                      </td>
                      <td className={styles.num}>{count(type.active, locale)}</td>
                      <td className={styles.num}>{count(type.dormant, locale)}</td>
                      <td className={styles.num}>{money(type.deposits, locale, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {openedByType < totals.accounts ? (
              <p className={styles.sub}>
                {count(totals.accounts - openedByType, locale)} of the{' '}
                {count(totals.accounts, locale)} accounts opened here have no
                type recorded against them yet.
              </p>
            ) : null}
          </>
        )}
      </Panel>

      <Panel
        title="Stations at this branch"
        description="Everything this branch reports on. Click a station to open its history or file a period."
      >
        {stations.length === 0 ? (
          <PanelEmpty>
            No stations here yet. Add the first one below — it belongs to this
            branch from the moment it is created.
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
                {stations.map((station) => (
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
        )}
      </Panel>

      {byCategory.length > 0 ? (
        <Panel
          title="What this branch is made of"
          description="Its stations by category. A branch with everything in one category is a different plan from one spread evenly."
        >
          <PieChart
            title={`Deposits by category at ${branch.name}`}
            format={(v) => money(v, locale, true)}
            slices={byCategory.slice(0, 5).map((c, i) => ({
              label: c.name,
              value: c.deposits,
              tone: SERIES[i % SERIES.length],
            }))}
          />
        </Panel>
      ) : null}

      {/* The bulk door, at the branch it fills.
          Every row lands here, so the file needs no branch column — which is
          the column most likely to be misspelt, and the one that sends a
          station to the wrong branch when it is. */}
      {session.role === 'hq' || session.role === 'zone' ? (
        <Panel
          title={`Add many stations to ${branch.name}`}
          description="Upload the list you already have, in Excel or CSV. Check it first: you get a line-by-line list of what will be added and what will be skipped, before anything is written."
        >
          <ImportForm
            canChooseZone={session.role === 'hq'}
            fixedBranch={{ id: branch.id, name: branch.name }}
          />
        </Panel>
      ) : null}

      {canEdit ? (
        <Panel
          title={`Edit ${branch.name}`}
          description="The branch's own details. Its zone is the field that matters most: a branch with no zone is invisible to every zone manager, and so is every station reporting through it."
        >
          <BranchForm
            branch={{
              id: branch.id,
              name: branch.name,
              zone_code: branch.zone_code,
              year_established: branch.year_established,
              year_refurbished: branch.year_refurbished,
              is_active: branch.is_active,
              notes: branch.notes,
            }}
            zones={zones}
            lockedZone={session.role === 'zone' ? session.zone : null}
          />
        </Panel>
      ) : null}

      <Panel
        title={`Add a station to ${branch.name}`}
        description="It belongs to this branch from the moment it is created, and everything it reports counts towards this branch, its zone and HQ."
      >
        <StationForm
          locale={locale}
          categories={categories.map((c) => ({ id: c.id, name: c.name_en }))}
          branches={[{ id: branch.id, name: branch.name }]}
          needsBranch={false}
          fixedBranchId={branch.id}
        />
      </Panel>
    </StaffShell>
  );
}
