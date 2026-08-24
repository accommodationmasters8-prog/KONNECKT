import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { StatTile } from '@/components/staff/StatTile';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { staffNav } from '@/lib/staff-nav';
import { getServerClient } from '@/lib/supabase/server';
import { nationalStats, zoneStats } from '@/lib/seed';
import { localeParams, resolveLocale } from '@/lib/page';
import type { StaffRole } from '@/lib/supabase/types';
import styles from './staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Staff console — CRDB Konekt',
  // A staff console has no business in a search index.
  robots: { index: false, follow: false },
};

const LABELS = {
  overview: 'Overview',
  events: 'Events',
  checkin: 'Check-in',
  accounts: 'Accounts opened',
  verification: 'Pin verification',
  sponsorship: 'Sponsorship',
  members: 'Members',
  audit: 'Audit log',
};

/**
 * Staff overview.
 *
 * With no Supabase project attached this shows the register figures that are
 * genuinely known — 252 branches, 54 institutions, 21 barracks, and the
 * geocoding backlog — and says plainly that the operational counts need the
 * live database. It does not invent a cost-per-account.
 */
export default async function StaffOverview({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  const supabase = await getServerClient();

  let role: StaffRole = 'hq';
  let scopeLabel = 'Not signed in — showing register figures only';
  let signedIn = false;

  if (supabase) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      const { data } = await supabase
        .from('staff_users' as never)
        .select('role, zone_code, branch_id')
        .limit(1)
        .maybeSingle();
      const staff = data as { role: StaffRole; zone_code: string | null } | null;
      if (staff) {
        role = staff.role;
        scopeLabel = staff.zone_code ?? 'National';
        signedIn = true;
      }
    }
  }

  const pendingPins = nationalStats.institutions + nationalStats.barracks;

  return (
    <StaffShell
      locale={locale}
      role={role}
      active="overview"
      nav={staffNav(locale, LABELS)}
      title={LABELS.overview}
      scopeLabel={scopeLabel}
    >
      {!signedIn ? (
        <div className={styles.notice}>
          <span className="tri tri--live" aria-hidden="true" />
          <div>
            <strong>{t.common.notConnected}</strong>
            <p>
              Operational figures — accounts opened, cost per account, conversion
              by stage — need the live database and a signed-in staff session.
              Everything below is from the committed CRDB register, which is real
              but static.
            </p>
          </div>
        </div>
      ) : null}

      <div className={styles.tiles}>
        <StatTile
          label="CRDB branches"
          value={String(nationalStats.branches)}
          source="konekt.branches"
        />
        <StatTile
          label="Universities and colleges"
          value={String(nationalStats.institutions)}
          source="konekt.institutions"
        />
        <StatTile
          label="Of which campuses of another"
          value={String(nationalStats.childInstitutions)}
          source="institution_rollup"
          tone="warn"
        />
        <StatTile
          label="JKT barracks"
          value={String(nationalStats.barracks)}
          source="konekt.institutions"
        />
        <StatTile
          label="Locations awaiting a verified pin"
          value={String(pendingPins)}
          source="konekt.locations"
          tone="warn"
        />
        <StatTile
          label="Locations with a coordinate"
          value="0"
          source="konekt.locations"
          tone="warn"
        />
      </div>

      <Panel
        title="Coverage by zone"
        description="Campuses the register places in each zone, and how many are mothers rather than campuses of another institution. Count mothers to avoid double-counting."
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Zone</th>
                <th scope="col" className={styles.num}>Campuses</th>
                <th scope="col" className={styles.num}>Mothers</th>
                <th scope="col" className={styles.num}>Regions</th>
              </tr>
            </thead>
            <tbody>
              {zoneStats.map((z) => (
                <tr key={z.zone}>
                  <th scope="row">{z.zone}</th>
                  <td className={styles.num}>{z.institutions}</td>
                  <td className={styles.num}>{z.motherInstitutions}</td>
                  <td className={styles.num}>{z.regions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Cost per account"
        description="Ranked nationally, by event. Needs accounts_opened and event budget lines."
      >
        <PanelEmpty>
          No accounts recorded yet. This report reads konekt.accounts_opened,
          where source and source_reference are NOT NULL — so every account it
          counts is traceable to the event, coordinator, agent and referring
          member that produced it.
        </PanelEmpty>
      </Panel>
    </StaffShell>
  );
}
