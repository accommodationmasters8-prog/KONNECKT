import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { FoldPanel, Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { AddBranchToZone, AddZone } from '@/components/staff/ZoneForms';
import { ImportForm } from '@/components/staff/ImportForm';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getBranchTree } from '@/lib/network';
import { getZones } from '@/lib/zones';
import { count, money } from '@/lib/tracker';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Branches — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * The tree, and the only one.
 *
 * A zone owns branches; a branch owns stations. That is not a presentation
 * choice — `stations.branch_id` is NOT NULL and the zone is copied from the
 * branch by trigger, so the database has always enforced it. The console did
 * not: it offered a flat list of every station alongside a separate
 * performance drill-down, so the same station could be reached by two routes
 * that implied different parents.
 *
 * This screen is where the structure is read and changed. Performance is the
 * other lens on the same tree — ranked, compared, read-only. A file browser
 * and a disk-usage analyser look at identical directories and are not the
 * same tool.
 */
export default async function BranchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const nav = staffNav(locale, STAFF_LABELS);

  if (!session.signedIn) {
    return (
      <StaffShell
        locale={locale} role={session.role} active="branches" nav={nav}
        title="Branches" scopeLabel={session.scopeLabel} user={session.user}
      >
        <Panel title="Branches">
          <PanelEmpty>Sign in to see the branches your role can reach.</PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  const [tree, allZones] = await Promise.all([getBranchTree(), getZones()]);

  // A zone with nothing in it yet still belongs on this screen. It is the one
  // a branch has to be added to, and a tree that only shows zones that already
  // have branches hides exactly the row somebody came here to fill.
  const seen = new Set(tree.map((z) => z.zone));
  const zones = [
    ...tree,
    ...allZones
      .filter((z) => !seen.has(z.code))
      .map((z) => ({
        zone: z.code, label: z.label, branches: [], stations: 0, deposits: 0,
      })),
  ].sort((a, b) => {
    if (a.zone === 'UNASSIGNED') return 1;
    if (b.zone === 'UNASSIGNED') return -1;
    return b.deposits - a.deposits || a.label.localeCompare(b.label);
  });

  // HQ maintains every zone; a zone manager maintains the branches inside
  // their own and nothing else. Row level security enforces both — this only
  // decides which forms are worth rendering.
  const canAddZone = session.role === 'hq';
  const canAddBranchIn = (zone: string) =>
    session.role === 'hq' ? zone !== 'UNASSIGNED' : session.role === 'zone' && session.zone === zone;

  const totalBranches = zones.reduce((a, z) => a + z.branches.length, 0);
  const totalStations = zones.reduce((a, z) => a + z.stations, 0);
  const totalDeposits = zones.reduce((a, z) => a + z.deposits, 0);
  const withStations = zones.reduce(
    (a, z) => a + z.branches.filter((b) => b.stations > 0).length, 0);

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="branches"
      nav={nav}
      title="Branches"
      scopeLabel={`${count(zones.length, locale)} zones · ${count(totalBranches, locale)} branches · ${count(totalStations, locale)} stations`}
      user={session.user}
      actions={
        <Link href={`/${locale}/staff/stations`} className={styles.link}>
          Find a station →
        </Link>
      }
    >
      <div className={styles.metrics}>
        <MetricCard tone="teal" label="Zones" value={count(zones.length, locale)}
          note="Each owns the branches below it" />
        <MetricCard tone="green" label="Branches" value={count(totalBranches, locale)}
          note={`${count(withStations, locale)} have at least one station`} />
        <MetricCard tone="gold" label="Stations" value={count(totalStations, locale)}
          note="Every one belongs to exactly one branch" />
        <MetricCard tone="ink" label="Deposits mobilised"
          value={totalDeposits > 0 ? money(totalDeposits, locale, true) : '—'}
          note="Newest period reported"
          href={`/${locale}/staff/network`} hint="Compare them" />
      </div>

      {zones.length === 0 ? (
        <Panel title="Nothing yet">
          <PanelEmpty>
            No branches are visible at your level. A branch appears here as
            soon as it exists and your role can reach it.
          </PanelEmpty>
        </Panel>
      ) : (
        zones.map((zone) => (
          <Panel
            key={zone.zone}
            title={zone.label}
            description={
              zone.zone === 'UNASSIGNED'
                ? 'These branches have no zone, so no zone manager can see them — or anything reporting through them. Assign one in Settings.'
                : `${count(zone.branches.length, locale)} branches · ${count(zone.stations, locale)} stations · ${money(zone.deposits, locale, true)}`
            }
            action={
              zone.zone === 'UNASSIGNED' ? (
                <Link href={`/${locale}/staff/settings`} className={styles.panelLink}>
                  Assign zones →
                </Link>
              ) : (
                <Link
                  href={`/${locale}/staff/network?zone=${zone.zone}`}
                  className={styles.panelLink}
                >
                  Compare this zone →
                </Link>
              )
            }
          >
            {zone.branches.length === 0 ? (
              <PanelEmpty>
                No branches in this zone yet. Add the first one below — every
                station it reports on will belong to it, and to this zone.
              </PanelEmpty>
            ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Branch</th>
                    <th scope="col" className={styles.num}>Stations</th>
                    <th scope="col" className={styles.num}>Reported</th>
                    <th scope="col" className={styles.num}>Accounts</th>
                    <th scope="col" className={styles.num}>Coverage</th>
                    <th scope="col" className={styles.num}>Deposits</th>
                  </tr>
                </thead>
                <tbody>
                  {zone.branches.map((branch) => (
                    <tr key={branch.id}>
                      <th scope="row">
                        <Link
                          href={`/${locale}/staff/branches/${branch.id}`}
                          className={styles.link}
                        >
                          {branch.name}
                        </Link>
                        <span className={styles.sub}>
                          {branch.stations === 0
                            ? 'no stations yet — click to add one'
                            : 'click to open its stations'}
                        </span>
                      </th>
                      <td className={styles.num}>{count(branch.stations, locale)}</td>
                      <td className={styles.num}>
                        {branch.stations === 0 ? '—'
                          : branch.reporting < branch.stations ? (
                            <span className={styles.chipWarn}>
                              {branch.reporting}/{branch.stations}
                            </span>
                          ) : (
                            <span className={styles.chipActive}>all in</span>
                          )}
                      </td>
                      <td className={styles.num}>{count(branch.accountsOpened, locale)}</td>
                      <td className={styles.num}>
                        {branch.coveragePct === null ? '—' : `${branch.coveragePct}%`}
                      </td>
                      <td className={styles.num}>{money(branch.deposits, locale, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}

            {canAddBranchIn(zone.zone) ? (
              <AddBranchToZone zone={zone.zone} zoneLabel={zone.label} />
            ) : null}
          </Panel>
        ))
      )}

      {canAddZone ? (
        <Panel
          title="Add a zone"
          description="The top of the tree: a zone owns branches, and branches own stations."
        >
          <AddZone />
        </Panel>
      ) : null}

      {/* The bulk door, on the screen the tree lives on. Folded, because most
          visits here are to read the tree rather than to rebuild it. */}
      {session.role === 'hq' || session.role === 'zone' ? (
        <FoldPanel
          title="Import a list"
          note="Branches, or zones, from Excel or CSV"
        >
          <ImportForm
            canChooseZone={session.role === 'hq'}
            initialKind="branches"
          />
        </FoldPanel>
      ) : null}
    </StaffShell>
  );
}
