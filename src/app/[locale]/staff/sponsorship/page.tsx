import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../partners/partners.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Sponsorship — CRDB Konekt',
  robots: { index: false, follow: false },
};

interface RequestRow {
  id: string;
  title: string;
  status: string;
  amount_requested_tzs: number | null;
  created_at: string;
}

/**
 * Sponsorship requests.
 *
 * The queue a zone manager works through. Amounts and decisions live in
 * konekt.sponsorship_requests, which carries its own status workflow and an
 * approval trail; this screen is a view onto it, not a second place where the
 * decision is recorded.
 */
export default async function StaffSponsorship({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  let rows: RequestRow[] = [];
  if (supabase && session.signedIn) {
    const { data } = await supabase
      .from('sponsorship_requests' as never)
      .select('id, title, status, amount_requested_tzs, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    rows = (data as unknown as RequestRow[]) ?? [];
  }

  const money = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    style: 'currency', currency: 'TZS', maximumFractionDigits: 0,
  });

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="sponsorship"
      nav={staffNav(locale, STAFF_LABELS)}
      title={STAFF_LABELS.sponsorship}
      scopeLabel={session.scopeLabel}
      user={session.user}
    >
      <Panel
        title="Requests"
        description="Newest first. A request carries its own documents and approval trail; nothing is decided on this screen without being written to the record."
      >
        {rows.length === 0 ? (
          <PanelEmpty>
            {supabase
              ? 'No sponsorship requests yet, or none this account may read. The queue fills from konekt.sponsorship_requests.'
              : 'No database is attached to this deployment, so there is no queue to work. This screen reads konekt.sponsorship_requests under the signed-in user’s session.'}
          </PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Request</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.title}</th>
                    <td>{row.amount_requested_tzs == null ? '—' : money.format(row.amount_requested_tzs)}</td>
                    <td><span className={styles.live}>{row.status.replace(/_/g, ' ')}</span></td>
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
