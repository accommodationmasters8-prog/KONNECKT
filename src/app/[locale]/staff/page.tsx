import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { MetricCard } from '@/components/staff/MetricCard';
import { BarTable, Donut } from '@/components/staff/Charts';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import {
  AccountsIcon, EventsIcon, MembersIcon, VerificationIcon,
} from '@/components/staff/StaffIcons';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { nationalStats, zoneStats } from '@/lib/seed';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from './staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Dashboard — CRDB Konekt',
  // A staff console has no business in a search index.
  robots: { index: false, follow: false },
};

/**
 * The dashboard.
 *
 * With no signed-in session this shows the register figures that are genuinely
 * known — 252 branches, 54 institutions, 21 barracks, and the geocoding
 * backlog — and says plainly that the operational counts need a live database
 * and a session. It does not invent a cost-per-account, and no card here shows
 * a zero dressed up as a measurement.
 */
export default async function StaffOverview({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  const session = await getStaffSession();
  const { role, user, scopeLabel, signedIn } = session;

  const pendingPins = nationalStats.institutions + nationalStats.barracks;

  return (
    <StaffShell
      locale={locale}
      role={role}
      active="overview"
      nav={staffNav(locale, STAFF_LABELS)}
      title="Dashboard"
      scopeLabel={scopeLabel}
      user={user}
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

      <div className={styles.metrics}>
        <MetricCard
          tone="teal"
          label="CRDB branches"
          value={String(nationalStats.branches)}
          source="konekt.branches"
          icon={<AccountsIcon />}
        />
        <MetricCard
          tone="green"
          label="Universities and colleges"
          value={String(nationalStats.institutions)}
          note={`${nationalStats.childInstitutions} are campuses of another`}
          source="konekt.institutions"
          icon={<MembersIcon />}
        />
        <MetricCard
          tone="gold"
          label="Locations awaiting a verified pin"
          value={String(pendingPins)}
          note="No pin goes on the map unverified"
          source="konekt.locations"
          icon={<VerificationIcon />}
        />
        <MetricCard
          tone="ink"
          label="JKT barracks"
          value={String(nationalStats.barracks)}
          source="konekt.institutions"
          icon={<EventsIcon />}
        />
      </div>

      <div className={styles.split}>
        <Panel
          title="Coverage by zone"
          description="Campuses the register places in each zone. Mothers are counted separately so a campus of another institution is not counted twice."
        >
          <BarTable
            caption="Campuses per CRDB zone"
            unitLabel="Campuses"
            rows={zoneStats.map((z) => ({
              label: z.zone,
              value: z.institutions,
              secondary: `${z.motherInstitutions} mothers · ${z.regions} regions`,
            }))}
          />
        </Panel>

        <Panel
          title="What the register holds"
          description="Every row seeded from the CRDB register, by kind."
        >
          <Donut
            title="Register composition: branches, campuses and barracks"
            total={
              nationalStats.branches + nationalStats.institutions + nationalStats.barracks
            }
            totalLabel="records"
            slices={[
              { label: 'Branches', value: nationalStats.branches, tone: 'teal' },
              { label: 'Campuses', value: nationalStats.institutions, tone: 'green' },
              { label: 'JKT barracks', value: nationalStats.barracks, tone: 'gold' },
            ]}
          />
        </Panel>
      </div>

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
