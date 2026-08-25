import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { PartnerEditor, DeletePlacement, type PlacementRow } from '@/components/staff/PartnerEditor';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { INDICATIVE_PARTNERS } from '@/lib/partners';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from './partners.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Partners — CRDB Konekt',
  robots: { index: false, follow: false },
};

/**
 * Partner administration.
 *
 * This is where the partner strip on the landing page comes from. Until a
 * partner is added here with its use cleared, the site shows the committed
 * indicative list as typographic plates — which is the honest state of a
 * partnership that Marketing and Legal have not signed off.
 */
export default async function StaffPartners({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  let rows: PlacementRow[] = [];
  if (supabase) {
    const { data } = await supabase
      .from('brand_placements' as never)
      .select('id, name, placement, website_url, logo_path, display_order, is_active, usage_approved_by')
      .order('placement', { ascending: true })
      .order('display_order', { ascending: true });
    rows = (data as unknown as PlacementRow[]) ?? [];
  }

  const canEdit = session.signedIn && session.role === 'hq';

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="partners"
      nav={staffNav(locale, STAFF_LABELS)}
      title={STAFF_LABELS.partners}
      scopeLabel="The partner strip on the landing page, and who cleared each mark"
      user={session.user}
    >
      <Panel
        title="Published placements"
        description="Live on the site now. A placement cannot be active without a named person recorded as having cleared the use of that mark."
      >
        {!supabase ? (
          <PanelEmpty>
            No database is attached to this deployment, so the site is showing
            the committed indicative list: {INDICATIVE_PARTNERS.map((p) => p.name).join(', ')}.
            Attach Supabase and this table takes over.
          </PanelEmpty>
        ) : rows.length === 0 ? (
          <PanelEmpty>
            No partners added yet. The landing page is showing the committed
            indicative list as typographic plates, labelled pending Marketing
            and Legal — which is what those partnerships are until one is added
            here.
          </PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Partner</th>
                  <th scope="col">Placement</th>
                  <th scope="col">Logo</th>
                  <th scope="col">Cleared by</th>
                  <th scope="col">Status</th>
                  {canEdit ? <th scope="col"><span className="visually-hidden">Actions</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.name}</th>
                    <td>{row.placement.replace(/_/g, ' ')}</td>
                    <td className={styles.file}>{row.logo_path ?? '—'}</td>
                    <td>{row.usage_approved_by ?? <span className={styles.missing}>not cleared</span>}</td>
                    <td>
                      <span className={row.is_active ? styles.live : styles.hidden}>
                        {row.is_active ? 'On the site' : 'Hidden'}
                      </span>
                    </td>
                    {canEdit ? (
                      <td><DeletePlacement id={row.id} name={row.name} /></td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {canEdit ? (
        <Panel
          title="Add a partner"
          description="Upload the partner's own logo file. Never a redrawn version — another company's mark is their trademark, and an approximation is a misrepresentation rather than a placeholder."
        >
          <PartnerEditor />
        </Panel>
      ) : (
        <Panel title="Add a partner">
          <PanelEmpty>
            The partner strip is national, so only an HQ administrator can
            change it. Sign in with an HQ account to add or remove partners.
          </PanelEmpty>
        </Panel>
      )}
    </StaffShell>
  );
}
