import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import {
  AddProduct, ProductTable, type ProductItem,
} from '@/components/staff/ProductLists';
import { BranchZones, type BranchRow } from '@/components/staff/BranchZones';
import { BranchForm, ClearDemoData } from '@/components/staff/BranchForms';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { getZones } from '@/lib/zones';
import { localeParams, resolveLocale } from '@/lib/page';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Settings — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * The two lists everything else is recorded against.
 *
 * Account types and loan types are not settings in the sense of preferences —
 * they are the vocabulary every branch files against, and every month already
 * filed is keyed on their codes. That is why nothing here deletes: a type is
 * retired, which takes it off the entry forms and leaves five years of history
 * still readable.
 *
 * HQ only, because a zone adding an account type would be inventing a word the
 * rest of the country then has to file against.
 */
export default async function StaffSettings({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();
  const nav = staffNav(locale, STAFF_LABELS);

  const isHq = session.signedIn && session.role === 'hq';

  if (!isHq || !supabase) {
    return (
      <StaffShell
        locale={locale} role={session.role} active="settings" nav={nav}
        title="Settings" scopeLabel={session.scopeLabel} user={session.user}
      >
        <Panel title="Account and loan types">
          <PanelEmpty>
            {session.signedIn
              ? 'These lists are maintained by HQ, because every branch files against them.'
              : 'Sign in as HQ to maintain these lists.'}
          </PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  const [accountsRes, loansRes, branchesRes, sampleRes, catRes, zones, scopeRes] = await Promise.all([
    supabase.from('account_products' as never)
      .select('code, label_en, label_sw, is_active, category_id')
      .order('is_active', { ascending: false })
      .order('display_order', { ascending: true }),
    supabase.from('loan_products' as never)
      .select('code, label_en, label_sw, is_active, category_id')
      .order('is_active', { ascending: false })
      .order('display_order', { ascending: true }),
    supabase.from('branches' as never)
      .select('id, name, zone_code')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(1000),
    supabase.from('station_reports' as never)
      .select('id', { count: 'exact', head: true })
      .like('note', 'Sample figure%'),
    supabase.from('tracker_categories' as never)
      .select('id, name_en').eq('is_active', true)
      .order('display_order', { ascending: true }).limit(100),
    getZones(),
    supabase.from('product_categories' as never)
      .select('kind, product_code, category_id').limit(5000),
  ]);

  const sampleReports = sampleRes.count ?? 0;
  const categoryOptions = ((catRes.data as unknown as
    { id: string; name_en: string }[]) ?? [])
    .map((c) => ({ id: c.id, name: c.name_en }));

  // Every product's categories, gathered once and attached to its row.
  const scopes = new Map<string, string[]>();
  for (const row of (scopeRes.data as unknown as
    { kind: string; product_code: string; category_id: string }[]) ?? []) {
    const key = `${row.kind}:${row.product_code}`;
    scopes.set(key, [...(scopes.get(key) ?? []), row.category_id]);
  }

  const withScope = (items: ProductItem[], kind: 'account' | 'loan') =>
    items.map((item) => ({
      ...item,
      category_ids: scopes.get(`${kind}:${item.code}`) ?? [],
    }));

  const accounts = withScope((accountsRes.data as unknown as ProductItem[]) ?? [], 'account');
  const loans = withScope((loansRes.data as unknown as ProductItem[]) ?? [], 'loan');

  // Unzoned first: those are the ones nobody above the branch can see.
  const branches = ((branchesRes.data as unknown as BranchRow[]) ?? [])
    .slice()
    .sort((a, b) => Number(Boolean(a.zone_code)) - Number(Boolean(b.zone_code)));
  const unzoned = branches.filter((b) => !b.zone_code).length;

  const live = (rows: ProductItem[]) => rows.filter((r) => r.is_active).length;

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="settings"
      nav={nav}
      title="Settings"
      scopeLabel={`${live(accounts)} account types · ${live(loans)} loan types in use`}
      user={session.user}
    >
      {sampleReports > 0 ? (
        <Panel
          title="Sample data is loaded"
        >
          <ClearDemoData sampleReports={sampleReports} />
        </Panel>
      ) : null}

      {/* First, because it is the one list that decides who can see what. */}
      <Panel
        title="Branches and their zones"
      >
        {branches.length === 0 ? (
          <PanelEmpty>No branches loaded.</PanelEmpty>
        ) : (
          <BranchZones branches={branches} zones={zones} />
        )}
      </Panel>

      <Panel
        title="Account types"
      >
        {accounts.length === 0 ? (
          <PanelEmpty>No account types yet.</PanelEmpty>
        ) : (
          <ProductTable kind="account" items={accounts} locale={locale} categories={categoryOptions} />
        )}
      </Panel>

      <Panel title="Add an account type">
        <AddProduct kind="account" noun="account type" />
      </Panel>

      <Panel
        title="Loan types"
      >
        {loans.length === 0 ? (
          <PanelEmpty>No loan types yet.</PanelEmpty>
        ) : (
          <ProductTable kind="loan" items={loans} locale={locale} categories={categoryOptions} />
        )}
      </Panel>

      <Panel title="Add a loan type">
        <AddProduct kind="loan" noun="loan type" />
      </Panel>

      <Panel
        title="Add a branch"
      >
        <BranchForm zones={zones} />
      </Panel>
    </StaffShell>
  );
}
