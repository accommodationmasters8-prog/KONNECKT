import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { StatTile } from '@/components/staff/StatTile';
import { staffNav } from '@/lib/staff-nav';
import { getServerClient } from '@/lib/supabase/server';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';
import local from './checkin.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Check-in — CRDB Konekt',
  robots: { index: false, follow: false },
};

const LABELS = {
  overview: 'Overview', events: 'Events', checkin: 'Check-in',
  accounts: 'Accounts opened', verification: 'Pin verification',
  sponsorship: 'Sponsorship', members: 'Members', audit: 'Audit log',
};

/**
 * Event check-in.
 *
 * The one staff screen built for a phone rather than a desk, because it is
 * used standing at a venue door. It has to work with the venue's WiFi off:
 * the attendee list is cached before the event, ticket signatures are
 * validated locally, and scans queue until the network comes back.
 *
 * Two rules it must hold, both already enforced in the database:
 *   * a QR carries an HMAC over the ticket nonce, never a plain ticket ID, so
 *     a forged code fails signature validation before it ever reaches a query
 *   * one check-in per registration, so a double scan is rejected rather than
 *     overwriting the real arrival time — first scanned_at wins
 */
export default async function CheckInPanel({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const supabase = await getServerClient();

  return (
    <StaffShell
      locale={locale}
      role="field_agent"
      active="checkin"
      nav={staffNav(locale, LABELS)}
      title={LABELS.checkin}
      scopeLabel={supabase ? 'Assigned events only' : 'Not connected'}
    >
      <div className={styles.notice}>
        <span className="tri tri--live" aria-hidden="true" />
        <div>
          <strong>Built to run with the venue WiFi switched off.</strong>
          <p>
            The attendee list is cached before the event starts. Ticket
            signatures are checked on the device, so a forged QR is rejected
            without a network round trip. Scans queue locally and sync when the
            connection returns; conflicts resolve to the first scan time.
          </p>
        </div>
      </div>

      <div className={styles.tiles}>
        <StatTile label="Cached attendees" value="0" source="service worker cache" />
        <StatTile label="Scanned" value="0" source="konekt.check_ins" tone="good" />
        <StatTile label="Queued to sync" value="0" source="local queue" tone="warn" />
        <StatTile label="Rejected signatures" value="0" source="local HMAC check" tone="warn" />
      </div>

      <Panel
        title="Scanner"
        description="Point the camera at an attendee's ticket. The signature is checked before anything is written."
      >
        <div className={local.scanner}>
          <div className={local.viewfinder} aria-hidden="true">
            <span className={local.corner} />
            <span className={local.corner} />
            <span className={local.corner} />
            <span className={local.corner} />
          </div>
          <p className={local.scannerNote}>
            {supabase
              ? 'Assign yourself to an event to start scanning. Field agent access is scoped to one event and expires with it.'
              : 'The scanner needs the live database and a signed-in field agent session.'}
          </p>
        </div>
      </Panel>

      <Panel title="Recent scans" description="Newest first, device time.">
        <PanelEmpty>No scans yet.</PanelEmpty>
      </Panel>
    </StaffShell>
  );
}
