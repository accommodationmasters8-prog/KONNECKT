import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { FreelancerEditor, type FreelancerRow } from '@/components/staff/FreelancerEditor';
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
  title: 'Freelancers — CRDB Konekt',
  robots: { index: false, follow: false },
};

/**
 * Freelancers, as a branch sees them.
 *
 * Scope is not this screen's doing: `freelancers_staff_read` and
 * `freelancers_staff_write` route every read and write through
 * `staff_can_reach`, so a branch officer sees their branch's, a zone manager
 * the zone's, and HQ everyone's — from the same query, with no filter written
 * here that could be forgotten.
 *
 * Their production rolls up the same way. An account they sourced names them
 * in konekt.accounts_opened, so what a freelancer is owed is derived from the
 * rows the branch already reconciles rather than typed into a spreadsheet.
 */
export default async function StaffFreelancers({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  let rows: FreelancerRow[] = [];
  let branches: { id: string; name: string }[] = [];
  const accountsByFreelancer = new Map<string, number>();

  if (supabase && session.signedIn) {
    const [list, branchList, accounts] = await Promise.all([
      supabase
        .from('freelancers' as never)
        .select('id, full_name, phone_e164, email, branch_id, zone_code, status, commission_tzs_per_account, notes')
        .order('registered_at', { ascending: false })
        .limit(200),
      supabase
        .from('branches' as never)
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(300),
      supabase
        .from('accounts_opened' as never)
        .select('freelancer_id')
        .not('freelancer_id', 'is', null)
        .limit(2000),
    ]);

    rows = (list.data as unknown as FreelancerRow[]) ?? [];
    branches = (branchList.data as unknown as { id: string; name: string }[]) ?? [];

    for (const row of (accounts.data as unknown as { freelancer_id: string }[]) ?? []) {
      accountsByFreelancer.set(
        row.freelancer_id,
        (accountsByFreelancer.get(row.freelancer_id) ?? 0) + 1,
      );
    }
  }

  const active = rows.filter((r) => r.status === 'active').length;
  const pending = rows.filter((r) => r.status === 'pending').length;
  const sourced = [...accountsByFreelancer.values()].reduce((a, b) => a + b, 0);

  const owed = rows.reduce((total, row) => {
    const count = accountsByFreelancer.get(row.id) ?? 0;
    return total + count * Number(row.commission_tzs_per_account ?? 0);
  }, 0);

  const money = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    style: 'currency', currency: 'TZS', maximumFractionDigits: 0,
  });

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="freelancers"
      nav={staffNav(locale, STAFF_LABELS)}
      title={STAFF_LABELS.freelancers}
      scopeLabel={
        session.role === 'branch'
          ? 'Registered by your branch, and your branch answers for them'
          : session.scopeLabel
      }
      user={session.user}
    >
      <div className={staffStyles.metrics}>
        <MetricCard tone="teal" label="Active freelancers" value={String(active)}
          note={`${pending} awaiting activation`} source="konekt.freelancers" />
        <MetricCard tone="green" label="Accounts they sourced" value={String(sourced)}
          note="Attributed on the account record itself" source="konekt.accounts_opened" />
        <MetricCard tone="gold" label="Commission earned" value={owed === 0 ? '—' : money.format(owed)}
          note="Accounts sourced x their own rate" source="derived" />
        <MetricCard tone="ink" label="Registered in total" value={String(rows.length)}
          note="Including suspended and ended" source="konekt.freelancers" />
      </div>

      <Panel
        title="Registered freelancers"
        description="Pending until the branch activates them. Suspending stops new production without erasing what they have already produced."
      >
        {!supabase ? (
          <PanelEmpty>
            No database is attached to this deployment. Freelancers, their
            branch and their commission live in konekt.freelancers, added in
            migration 0009.
          </PanelEmpty>
        ) : !session.signedIn ? (
          <PanelEmpty>Sign in to see the freelancers your branch is responsible for.</PanelEmpty>
        ) : rows.length === 0 ? (
          <PanelEmpty>
            None registered yet in your scope. Register the first below — they
            start as pending, and only an active freelancer earns commission.
          </PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Accounts</th>
                  <th scope="col">Rate</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      {row.full_name}
                      {row.zone_code ? <span className={styles.file}>{row.zone_code.replace(/_/g, ' ')}</span> : null}
                    </th>
                    <td className={styles.file}>{row.phone_e164}</td>
                    <td>{accountsByFreelancer.get(row.id) ?? 0}</td>
                    <td>
                      {row.commission_tzs_per_account
                        ? money.format(Number(row.commission_tzs_per_account))
                        : '—'}
                    </td>
                    <td>
                      <span className={row.status === 'active' ? styles.live : styles.hidden}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Register a freelancer"
        description="They are not staff: no console role, no member records, no scope over anyone else's data — only their own production, and a branch that answers for them."
      >
        {session.signedIn ? (
          <FreelancerEditor branches={branches} />
        ) : (
          <PanelEmpty>Sign in to register a freelancer.</PanelEmpty>
        )}
      </Panel>
    </StaffShell>
  );
}
