import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import {
  CampaignComposer, ApproveCampaign, ResolveAudience,
} from '@/components/staff/CampaignComposer';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { zoneStats } from '@/lib/seed';
import { localeParams, resolveLocale } from '@/lib/page';
import staffStyles from '../staff.module.css';
import styles from './communication.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Communication — CRDB Konekt',
  robots: { index: false, follow: false },
};

interface CampaignRow {
  id: string;
  name: string;
  channel: string;
  purpose: string;
  body_en: string;
  audience_tier: string | null;
  scope_zone_code: string | null;
  approved_at: string | null;
  queued_at: string | null;
  sent_at: string | null;
  created_at: string;
}

/**
 * Bulk messaging.
 *
 * The valuable part of this screen is the part that refuses to send. Consent
 * is recorded per purpose and per channel, suppression overrides everything,
 * and `konekt.build_campaign_audience` writes one row per member considered —
 * including every skip, with its reason — so a regulator's question about who
 * received what is answered from a table rather than from a recollection.
 *
 * Nothing here dispatches a message. No SMS gateway is configured in this
 * build; `sent_at` is left for whatever actually delivers to set, and the
 * screen says so rather than showing a Send button that quietly does nothing.
 */
export default async function StaffCommunication({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  let rows: CampaignRow[] = [];
  let considered = 0;
  let eligible = 0;

  if (supabase && session.signedIn) {
    const [campaigns, deliveries] = await Promise.all([
      supabase
        .from('campaigns' as never)
        .select('id, name, channel, purpose, body_en, audience_tier, scope_zone_code, approved_at, queued_at, sent_at, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('campaign_deliveries' as never)
        .select('was_eligible'),
    ]);

    rows = (campaigns.data as unknown as CampaignRow[]) ?? [];
    const all = (deliveries.data as unknown as { was_eligible: boolean }[]) ?? [];
    considered = all.length;
    eligible = all.filter((d) => d.was_eligible).length;
  }

  const when = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    dateStyle: 'medium',
  });

  const zones = zoneStats.map((z) => z.zone.replace(/ ZONE$/i, '').trim().toUpperCase().replace(/ /g, '_'));

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="communication"
      nav={staffNav(locale, STAFF_LABELS)}
      title={STAFF_LABELS.communication}
      scopeLabel="Bulk SMS and messaging, with consent checked per member"
      user={session.user}
    >
      <div className={staffStyles.metrics}>
        <MetricCard
          tone="teal"
          label="Campaigns"
          value={String(rows.length)}
          note="Drafted, approved or queued"
          source="konekt.campaigns"
        />
        <MetricCard
          tone="green"
          label="Members reachable"
          value={considered === 0 ? '—' : String(eligible)}
          note={considered === 0 ? 'No audience resolved yet' : `of ${considered} considered`}
          source="konekt.campaign_deliveries"
        />
        <MetricCard
          tone="gold"
          label="Skipped on consent"
          value={considered === 0 ? '—' : String(considered - eligible)}
          note="Each with a reason recorded"
          source="konekt.campaign_deliveries"
        />
        <MetricCard
          tone="ink"
          label="Delivered"
          value="0"
          note="No SMS gateway configured in this build"
          source="konekt.campaign_deliveries"
        />
      </div>

      <div className={styles.notice}>
        <span className="tri tri--live" aria-hidden="true" />
        <div>
          <strong>Nothing on this screen sends a message.</strong>
          <p>
            A campaign is written, approved by a second person, and its audience
            resolved against every member&rsquo;s recorded consent. Dispatch
            needs an SMS gateway, which this build does not have credentials
            for — so <code>sent_at</code> stays empty until something actually
            delivers, rather than being set by a button.
          </p>
        </div>
      </div>

      <Panel
        title="Campaigns"
        description="Newest first. A campaign cannot be approved by the person who wrote it, and cannot resolve an audience before it is approved — both refused by the database, not by this screen."
      >
        {!supabase ? (
          <PanelEmpty>
            No database is attached to this deployment, so there are no
            campaigns and no consent records to check against.
          </PanelEmpty>
        ) : !session.signedIn ? (
          <PanelEmpty>Sign in to see the campaigns in your scope.</PanelEmpty>
        ) : rows.length === 0 ? (
          <PanelEmpty>
            No campaigns yet. Write the first one below — it saves as a draft
            and needs a second person before it can go anywhere.
          </PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Campaign</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Audience</th>
                  <th scope="col">State</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      {row.name}
                      <span className={styles.preview}>{row.body_en.slice(0, 80)}</span>
                    </th>
                    <td>
                      {row.channel.toUpperCase()}
                      <span className={styles.sub}>{row.purpose.replace(/_/g, ' ')}</span>
                    </td>
                    <td>
                      {row.audience_tier ?? 'Every tier'}
                      <span className={styles.sub}>
                        {row.scope_zone_code?.replace(/_/g, ' ') ?? 'National'}
                      </span>
                    </td>
                    <td>
                      <span className={styles.state}>
                        {row.sent_at ? 'Sent'
                          : row.queued_at ? 'Audience resolved'
                            : row.approved_at ? 'Approved'
                              : 'Draft'}
                      </span>
                      <span className={styles.sub}>{when.format(new Date(row.created_at))}</span>
                    </td>
                    <td className={styles.actions}>
                      {!row.approved_at ? <ApproveCampaign id={row.id} /> : null}
                      {row.approved_at && !row.queued_at ? <ResolveAudience id={row.id} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Write a campaign"
        description="Both languages, every time. A bilingual platform that sends one language to everyone has chosen a language for its members."
      >
        {session.signedIn ? (
          <CampaignComposer zones={zones} />
        ) : (
          <PanelEmpty>Sign in to write a campaign.</PanelEmpty>
        )}
      </Panel>
    </StaffShell>
  );
}
