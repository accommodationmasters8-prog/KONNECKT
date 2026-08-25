import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { AccountForm } from '@/components/staff/AccountForm';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { localeParams, resolveLocale } from '@/lib/page';
import staffStyles from '../staff.module.css';
import styles from '../partners/partners.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Accounts opened — CRDB Konekt',
  robots: { index: false, follow: false },
};

interface AccountRow {
  id: string;
  account_number: string;
  product_code: string;
  source: string;
  opened_on: string;
  freelancer_id: string | null;
}

/**
 * Accounts opened.
 *
 * This is the screen the whole reporting chain hangs off. An account recorded
 * here is scoped to the branch that recorded it, rolls up to its zone and to
 * HQ through the same rows rather than through a copy, feeds the cost per
 * account on the event that produced it, and counts towards a freelancer's
 * commission when one is named.
 *
 * Source attribution is structurally mandatory: `source` and `source_reference`
 * are both NOT NULL and event- or referral-sourced accounts must name the
 * event or the referrer, so an account with no traceable origin is rejected
 * rather than quietly double-counted in every report downstream.
 */
export default async function AccountsPanel({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const supabase = await getServerClient();
  const session = await getStaffSession();

  let products: { code: string; label_en: string }[] = [];
  let events: { id: string; title_en: string }[] = [];
  let freelancers: { id: string; full_name: string }[] = [];
  let branches: { id: string; name: string }[] = [];
  let recent: AccountRow[] = [];

  if (supabase) {
    const { data: productData } = await supabase
      .from('account_products' as never)
      .select('code, label_en')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    products = (productData as unknown as { code: string; label_en: string }[]) ?? [];

    if (session.signedIn) {
      const [eventData, freelancerData, branchData, accountData] = await Promise.all([
        supabase.from('events' as never)
          .select('id, title_en')
          .in('status', ['approved', 'published', 'live', 'completed'])
          .order('starts_at', { ascending: false })
          .limit(50),
        supabase.from('freelancers' as never)
          .select('id, full_name')
          .eq('status', 'active')
          .order('full_name', { ascending: true })
          .limit(200),
        supabase.from('branches' as never)
          .select('id, name')
          .eq('is_active', true)
          .order('name', { ascending: true })
          .limit(300),
        supabase.from('accounts_opened' as never)
          .select('id, account_number, product_code, source, opened_on, freelancer_id')
          .order('opened_on', { ascending: false })
          .limit(50),
      ]);

      events = (eventData.data as unknown as { id: string; title_en: string }[]) ?? [];
      freelancers = (freelancerData.data as unknown as { id: string; full_name: string }[]) ?? [];
      branches = (branchData.data as unknown as { id: string; name: string }[]) ?? [];
      recent = (accountData.data as unknown as AccountRow[]) ?? [];
    }
  }

  const now = new Date();
  const thisMonth = recent.filter((row) => {
    const d = new Date(row.opened_on);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const fromEvents = recent.filter((row) => row.source === 'event').length;
  const fromFreelancers = recent.filter((row) => row.freelancer_id).length;

  const day = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', { dateStyle: 'medium' });

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="accounts"
      nav={staffNav(locale, STAFF_LABELS)}
      title={STAFF_LABELS.accounts}
      scopeLabel={
        session.role === 'branch'
          ? 'Your branch. The same rows roll up to your zone and to HQ'
          : session.scopeLabel
      }
      user={session.user}
    >
      <div className={staffStyles.metrics}>
        <MetricCard tone="teal" label="Recorded (last 50)" value={String(recent.length)}
          note="Scoped by row level security, not by this page" source="konekt.accounts_opened" />
        <MetricCard tone="green" label="This month" value={String(thisMonth.length)}
          source="konekt.accounts_opened" />
        <MetricCard tone="gold" label="From an event" value={String(fromEvents)}
          note="Each traceable to the event that produced it" source="konekt.accounts_opened" />
        <MetricCard tone="ink" label="Sourced by a freelancer" value={String(fromFreelancers)}
          note="Counts towards their commission" source="konekt.accounts_opened" />
      </div>

      <Panel
        title="Record an account"
        description="Source attribution is mandatory. It is what lets an HQ analyst trace any account back to the event, coordinator, freelancer and referring member that produced it."
      >
        {!supabase ? (
          <PanelEmpty>
            No database is attached to this deployment, so nothing can be
            recorded. The fields are shaped by konekt.accounts_opened and its
            constraints — see docs/DATABASE.md.
          </PanelEmpty>
        ) : !session.signedIn ? (
          <PanelEmpty>Sign in to record an account against your branch.</PanelEmpty>
        ) : (
          <AccountForm
            products={products}
            events={events}
            freelancers={freelancers}
            branches={branches}
            needsBranch={session.role === 'hq' || session.role === 'zone'}
          />
        )}
      </Panel>

      <Panel
        title="Recently recorded"
        description="Scoped to what your role may read, by row level security rather than by this page."
      >
        {recent.length === 0 ? (
          <PanelEmpty>
            No accounts recorded yet. The first one recorded above appears here,
            in the audit log, and in the cost per account of the event that
            produced it.
          </PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Product</th>
                  <th scope="col">Source</th>
                  <th scope="col">Opened</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className={styles.file}>{row.account_number}</th>
                    <td>{row.product_code.replace(/_/g, ' ')}</td>
                    <td>
                      {row.source.replace(/_/g, ' ')}
                      {row.freelancer_id ? <span className={styles.file}>freelancer named</span> : null}
                    </td>
                    <td>{day.format(new Date(row.opened_on))}</td>
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
