import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { ProductEditor, type ProductRow } from '@/components/staff/ProductEditor';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../partners/partners.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Account types — CRDB Konekt',
  robots: { index: false, follow: false },
};

/**
 * The products a branch can record an account against.
 *
 * National, and HQ's to maintain: a branch inventing its own product name is
 * how "Scholar", "scholars acc" and "Schollar Account" end up in the same
 * report as three different things. Every account opened stores the code from
 * this table, so the list here is the vocabulary of every account report the
 * bank runs.
 */
export default async function StaffProducts({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  let rows: ProductRow[] = [];
  if (supabase) {
    const { data } = await supabase
      .from('account_products' as never)
      .select('code, label_en, label_sw, description_en, description_sw, min_age, max_age, requires_guardian, is_active, display_order')
      .order('display_order', { ascending: true });
    rows = (data as unknown as ProductRow[]) ?? [];
  }

  const canEdit = session.signedIn && session.role === 'hq';

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="products"
      nav={staffNav(locale, STAFF_LABELS)}
      title={STAFF_LABELS.products}
      scopeLabel="National. Every branch records accounts against this list"
      user={session.user}
    >
      <Panel
        title="Products"
        description="Retire a product by turning it off rather than deleting it — accounts opened on it still name it, and the record has to keep meaning what it meant."
      >
        {rows.length === 0 ? (
          <PanelEmpty>
            {supabase
              ? 'No account types yet. Migration 0009 seeds the seven CRDB products; add the first one below if this is a fresh database.'
              : 'No database is attached to this deployment. Account types moved out of a Postgres enum and into a table in migration 0009, so HQ can add one without a release.'}
          </PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Code</th>
                  <th scope="col">Ages</th>
                  <th scope="col">Guardian</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.code}>
                    <th scope="row">
                      {row.label_en}
                      <span className={styles.file}>{row.label_sw}</span>
                    </th>
                    <td className={styles.file}>{row.code}</td>
                    <td>
                      {row.min_age ?? '—'}–{row.max_age ?? '∞'}
                    </td>
                    <td>{row.requires_guardian ? 'Required' : 'No'}</td>
                    <td>
                      <span className={row.is_active ? styles.live : styles.hidden}>
                        {row.is_active ? 'Offered' : 'Retired'}
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
        title="Add or change a product"
        description="The code is what every account record stores, so it is fixed once the product exists."
      >
        {canEdit ? (
          <ProductEditor />
        ) : (
          <PanelEmpty>
            Account types are national. Sign in with an HQ account to change
            them — a branch inventing its own product names is how one product
            becomes three in reporting.
          </PanelEmpty>
        )}
      </Panel>
    </StaffShell>
  );
}
