import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { StatTile } from '@/components/staff/StatTile';
import { staffNav } from '@/lib/staff-nav';
import { getServerClient } from '@/lib/supabase/server';
import { institutions, branches, nationalStats } from '@/lib/seed';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';
import local from './verification.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Pin verification — CRDB Konekt',
  robots: { index: false, follow: false },
};

const LABELS = {
  overview: 'Overview', events: 'Events', checkin: 'Check-in',
  accounts: 'Accounts opened', verification: 'Pin verification',
  sponsorship: 'Sponsorship', members: 'Members', audit: 'Audit log',
};

/**
 * The geocoding verification queue.
 *
 * This is the screen the whole "never place an unverified pin on the map" rule
 * depends on. A branch officer sees the address the register holds, the
 * coordinate the geocoder proposed, and confirms or rejects it. Until they
 * confirm, the row level security policy on konekt.locations makes that pin
 * invisible to the public API — so nothing can leak onto a customer map by
 * mistake.
 *
 * With no database attached this shows the real backlog from the register,
 * which is every location, because not one supplied record has a coordinate.
 */
export default async function VerificationQueue({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const supabase = await getServerClient();

  const queue = institutions.slice(0, 25).map((i) => ({
    name: i.name,
    address: [i.street, i.ward, i.district, i.region].filter(Boolean).join(', '),
    branch: i.coordinating_branch,
    status: 'not_attempted' as const,
  }));

  return (
    <StaffShell
      locale={locale}
      role="branch"
      active="verification"
      nav={staffNav(locale, LABELS)}
      title={LABELS.verification}
      scopeLabel={supabase ? 'Your branch' : 'Register figures only'}
    >
      <div className={styles.notice}>
        <span className="tri tri--live" aria-hidden="true" />
        <div>
          <strong>Nothing on this list has a coordinate yet.</strong>
          <p>
            Not one of the {nationalStats.institutions + nationalStats.barracks + branches.length}{' '}
            records CRDB supplied carries a latitude or longitude. Geocoding
            proposes a pin from the ward, district and region below; a branch
            officer confirms it. Until someone does, the pin cannot appear on
            any public map — that is enforced by the database, not by this
            screen.
          </p>
        </div>
      </div>

      <div className={styles.tiles}>
        <StatTile
          label="Awaiting a proposed pin"
          value={String(nationalStats.institutions + nationalStats.barracks + branches.length)}
          source="locations.geocode_status = not_attempted"
          tone="warn"
        />
        <StatTile label="Proposed, low confidence" value="0" source="geocoded_low_confidence" />
        <StatTile label="Confirmed by a branch officer" value="0" source="verified" tone="good" />
        <StatTile label="Visible on the public map" value="0" source="verified_locations" tone="good" />
      </div>

      <Panel
        title="Queue"
        description="The address the register holds for each record. Confirming a pin needs a person who knows the place — that is why this screen exists rather than a script."
      >
        {queue.length === 0 ? (
          <PanelEmpty>Nothing waiting.</PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Institution</th>
                  <th scope="col">Address in the register</th>
                  <th scope="col">Coordinating branch</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((row) => (
                  <tr key={row.name}>
                    <th scope="row">{row.name}</th>
                    <td className={local.address}>{row.address || '—'}</td>
                    <td>{row.branch || <span className={local.gap}>not resolved</span>}</td>
                    <td>
                      <span className={local.status}>awaiting geocode</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </StaffShell>
  );
}
