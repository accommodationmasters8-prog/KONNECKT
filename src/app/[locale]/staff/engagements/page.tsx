import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty, FoldPanel } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { count, money } from '@/lib/tracker';
import { localeParams, resolveLocale } from '@/lib/page';
import { EngagementForm } from './EngagementForm';
import styles from '../staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Engagements — Konekt',
  robots: { index: false, follow: false },
};

interface Row {
  id: string;
  institution: string;
  engaged_on: string;
  branch_id: string;
  leads_expected: number;
  leads_got: number;
  accounts_opened: number;
  accounts_activated: number;
  simbanking_activated: number;
  lipa_hapa_registered: number;
  deposits_tzs: number;
}

/**
 * Visits a branch books on an institution.
 *
 * Separate from events, which are one-off and carry a budget. This is the
 * routine calling — a branch goes to a school, expects thirty leads, comes
 * back with nineteen. Expected against got is the whole point of the screen.
 */
export default async function EngagementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  let rows: Row[] = [];
  let branches: { id: string; name: string }[] = [];
  let categories: { id: string; name_en: string }[] = [];
  let totals = { bookings: 0, leads_expected: 0, leads_got: 0, accounts_opened: 0,
    accounts_activated: 0, simbanking_activated: 0, lipa_hapa_registered: 0, deposits_tzs: 0 };

  if (supabase && session.signedIn) {
    const [listRes, totalRes, branchRes, catRes] = await Promise.all([
      supabase.from('engagements' as never)
        .select('id, institution, engaged_on, branch_id, leads_expected, leads_got, accounts_opened, accounts_activated, simbanking_activated, lipa_hapa_registered, deposits_tzs')
        .order('engaged_on', { ascending: false })
        .limit(200),
      supabase.from('engagement_totals' as never).select('*').maybeSingle(),
      supabase.from('branches' as never).select('id, name').eq('is_active', true)
        .order('name').limit(500),
      supabase.from('tracker_categories' as never).select('id, name_en').order('name_en'),
    ]);
    rows = (listRes.data as unknown as Row[]) ?? [];
    if (totalRes.data) totals = { ...totals, ...(totalRes.data as typeof totals) };
    branches = (branchRes.data as unknown as { id: string; name: string }[]) ?? [];
    categories = (catRes.data as unknown as { id: string; name_en: string }[]) ?? [];
  }

  const branchName = new Map(branches.map((b) => [b.id, b.name] as const));
  const n = (v: number) => Number(v ?? 0);
  const conversion = n(totals.leads_expected) > 0
    ? Math.round((n(totals.leads_got) / n(totals.leads_expected)) * 100)
    : null;

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="engagements"
      nav={staffNav(locale, STAFF_LABELS)}
      title="Engagements"
      scopeLabel={session.scopeLabel}
      user={session.user}
    >
      {!session.signedIn ? (
        <Panel title="Sign in">
          <PanelEmpty>Nothing is visible until you sign in.</PanelEmpty>
        </Panel>
      ) : (
        <>
          <div className={styles.metrics}>
            <MetricCard tone="teal" label="Institutions booked"
              value={totals.bookings === 0 ? '—' : count(n(totals.bookings), locale)} />
            <MetricCard tone="gold" label="Leads expected"
              value={n(totals.leads_expected) === 0 ? '—' : count(n(totals.leads_expected), locale)} />
            <MetricCard tone="green" label="Leads got"
              value={n(totals.leads_got) === 0 ? '—' : count(n(totals.leads_got), locale)}
              note={conversion === null ? undefined : `${conversion}%`} />
            <MetricCard tone="teal" label="Accounts opened"
              value={n(totals.accounts_opened) === 0 ? '—' : count(n(totals.accounts_opened), locale)} />
            <MetricCard tone="teal" label="Accounts activated"
              value={n(totals.accounts_activated) === 0 ? '—' : count(n(totals.accounts_activated), locale)} />
            <MetricCard tone="ink" label="SimBanking"
              value={n(totals.simbanking_activated) === 0 ? '—' : count(n(totals.simbanking_activated), locale)} />
            <MetricCard tone="green" label="Lipa Hapa"
              value={n(totals.lipa_hapa_registered) === 0 ? '—' : count(n(totals.lipa_hapa_registered), locale)} />
            <MetricCard tone="gold" label="Deposits"
              value={n(totals.deposits_tzs) === 0 ? '—' : money(n(totals.deposits_tzs), locale, true)} />
          </div>

          <FoldPanel title="Record a visit" open={rows.length === 0}>
            <EngagementForm
              branches={branches}
              categories={categories}
              fixedBranch={session.role === 'branch' ? session.branchId : null}
            />
          </FoldPanel>

          <Panel title="Visits" >
            {rows.length === 0 ? (
              <PanelEmpty>None recorded.</PanelEmpty>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Institution</th>
                      <th scope="col">Branch</th>
                      <th scope="col">Date</th>
                      <th scope="col" className={styles.num}>Expected</th>
                      <th scope="col" className={styles.num}>Got</th>
                      <th scope="col" className={styles.num}>Accounts</th>
                      <th scope="col" className={styles.num}>SimBanking</th>
                      <th scope="col" className={styles.num}>Lipa Hapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <th scope="row">{r.institution}</th>
                        <td>{branchName.get(r.branch_id) ?? '—'}</td>
                        <td>
                          {new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          }).format(new Date(r.engaged_on))}
                        </td>
                        <td className={styles.num}>{count(n(r.leads_expected), locale)}</td>
                        <td className={styles.num}>{count(n(r.leads_got), locale)}</td>
                        <td className={styles.num}>{count(n(r.accounts_opened), locale)}</td>
                        <td className={styles.num}>{count(n(r.simbanking_activated), locale)}</td>
                        <td className={styles.num}>{count(n(r.lipa_hapa_registered), locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </StaffShell>
  );
}
