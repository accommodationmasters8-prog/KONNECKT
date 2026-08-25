import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from './audit.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Audit log — CRDB Konekt',
  robots: { index: false, follow: false },
};

interface AuditRow {
  id: number;
  occurred_at: string;
  actor_kind: string;
  action: string;
  table_name: string;
  record_id: string | null;
  staff_users: { full_name: string | null; email: string | null } | null;
}

/**
 * The audit log.
 *
 * Append-only by construction: `audit_log_immutable` refuses an UPDATE or a
 * DELETE on this table, and `write_audit` fires after every insert, update and
 * delete on every table a staff user can write. So this page is not a summary
 * of what happened — it is what happened, and nobody, including HQ, can edit
 * it after the fact.
 *
 * HQ only. An audit log that the people it audits can read selectively is not
 * much of an audit log, and scoping it by zone would let a zone manager see
 * exactly which of their own actions were recorded.
 */
export default async function StaffAudit({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  let rows: AuditRow[] = [];
  let error: string | null = null;

  if (supabase && session.signedIn) {
    const { data, error: queryError } = await supabase
      .from('audit_log' as never)
      .select('id, occurred_at, actor_kind, action, table_name, record_id, staff_users(full_name, email)')
      .order('occurred_at', { ascending: false })
      .limit(100);

    rows = (data as unknown as AuditRow[]) ?? [];
    error = queryError?.message ?? null;
  }

  const stamp = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="audit"
      nav={staffNav(locale, STAFF_LABELS)}
      title={STAFF_LABELS.audit}
      scopeLabel="Append-only. Every staff write, with actor, table and time"
      user={session.user}
    >
      <Panel
        title="The last 100 writes"
        description="Recorded by a database trigger on every table a staff user can write, including the before and after state of the row. The table itself cannot be updated or deleted — the database refuses it."
      >
        {!supabase ? (
          <PanelEmpty>
            No database is attached to this deployment, so nothing has been
            written and nothing has been logged. The trigger that fills this
            table is created in migration 0003 and attached in 0005, 0007 and
            0008.
          </PanelEmpty>
        ) : !session.signedIn ? (
          <PanelEmpty>
            Sign in to read the audit log. It is HQ-only: an audit trail that
            the people it audits can read selectively is not an audit trail.
          </PanelEmpty>
        ) : error ? (
          <PanelEmpty>
            The database declined to return the audit log for this account.
            That is the row level security policy doing its job — only HQ can
            read it.
          </PanelEmpty>
        ) : rows.length === 0 ? (
          <PanelEmpty>
            Nothing written yet. The first staff action — adding a partner,
            saving a setting, recording an account — appears here immediately
            after it commits.
          </PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Action</th>
                  <th scope="col">Table</th>
                  <th scope="col">Record</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.when}>{stamp.format(new Date(row.occurred_at))}</td>
                    <td>
                      {row.staff_users?.full_name
                        ?? row.staff_users?.email
                        ?? <span className={styles.system}>{row.actor_kind}</span>}
                    </td>
                    <td><span className={styles.action}>{row.action}</span></td>
                    <td className={styles.mono}>{row.table_name}</td>
                    <td className={styles.mono}>{row.record_id ?? '—'}</td>
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
