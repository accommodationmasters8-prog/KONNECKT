import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import {
  AddProduct, ProductTable, type ProductItem,
} from '@/components/staff/ProductLists';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
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

  const [accountsRes, loansRes] = await Promise.all([
    supabase.from('account_products' as never)
      .select('code, label_en, label_sw, is_active')
      .order('is_active', { ascending: false })
      .order('display_order', { ascending: true }),
    supabase.from('loan_products' as never)
      .select('code, label_en, label_sw, is_active')
      .order('is_active', { ascending: false })
      .order('display_order', { ascending: true }),
  ]);

  const accounts = (accountsRes.data as unknown as ProductItem[]) ?? [];
  const loans = (loansRes.data as unknown as ProductItem[]) ?? [];

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
      <Panel
        title="Account types"
        description="What a station's accounts can be broken down into when a month is filed. Retiring one takes it off the entry form; the months already filed against it keep their figures."
      >
        {accounts.length === 0 ? (
          <PanelEmpty>No account types yet.</PanelEmpty>
        ) : (
          <ProductTable kind="account" items={accounts} locale={locale} />
        )}
      </Panel>

      <Panel title="Add an account type">
        <AddProduct kind="account" noun="account type" />
      </Panel>

      <Panel
        title="Loan types"
        description="The categories a station's loans are split into."
      >
        {loans.length === 0 ? (
          <PanelEmpty>No loan types yet.</PanelEmpty>
        ) : (
          <ProductTable kind="loan" items={loans} locale={locale} />
        )}
      </Panel>

      <Panel title="Add a loan type">
        <AddProduct kind="loan" noun="loan type" />
      </Panel>
    </StaffShell>
  );
}
