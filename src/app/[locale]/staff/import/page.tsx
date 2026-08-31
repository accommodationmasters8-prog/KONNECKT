import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { ImportForm } from '@/components/staff/ImportForm';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';

export const metadata: Metadata = {
  title: 'Import — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * Bring a spreadsheet in.
 *
 * The register arrived as four workbooks and every branch keeps its own list;
 * typing 252 branches into a form one at a time is how a system gets abandoned
 * in week two. This is the door for the lists that already exist.
 *
 * Branch officers are not offered it. A branch has a handful of stations and
 * adds them from its own page in less time than exporting a file takes — and
 * the failure mode of bulk import at that level is one person pasting the
 * whole national register into their own branch.
 */
export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const { kind } = await searchParams;
  const session = await getStaffSession();
  const nav = staffNav(locale, STAFF_LABELS);

  const allowed = session.signedIn && (session.role === 'hq' || session.role === 'zone');

  if (!allowed) {
    return (
      <StaffShell
        locale={locale} role={session.role} active="import" nav={nav}
        title="Import" scopeLabel={session.scopeLabel} user={session.user}
      >
        <Panel title="Import a spreadsheet">
          <PanelEmpty>
            {session.signedIn
              ? 'Bulk import is for HQ and zone managers. Add your stations from your branch page — it is quicker than exporting a file.'
              : 'Sign in to import.'}
          </PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="import"
      nav={nav}
      title="Import a spreadsheet"
      scopeLabel={session.scopeLabel}
      user={session.user}
      actions={
        <Link href={`/${locale}/staff/branches`} className={styles.link}>
          Zones and branches →
        </Link>
      }
    >
      <Panel
        title="Upload branches or stations"
        description="Check the file first — you get a line-by-line list of what will be added, what will be updated and what will be skipped, before anything is written."
      >
        <ImportForm
          canChooseZone={session.role === 'hq'}
          initialKind={kind === 'stations' ? 'stations' : 'branches'}
        />
      </Panel>

      <Panel
        title="How matching works"
        description="Nothing is duplicated and nothing is silently overwritten."
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Situation</th>
                <th scope="col">What happens</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">The name is not in the system</th>
                <td>A new record is created.</td>
              </tr>
              <tr>
                <th scope="row">The name is already there</th>
                <td>That record is updated with the columns your file carries. Nothing filed against it is touched.</td>
              </tr>
              <tr>
                <th scope="row">The same name twice in one file</th>
                <td>The first is used and the rest are skipped by line number.</td>
              </tr>
              <tr>
                <th scope="row">A station names a branch that does not exist</th>
                <td>Skipped, and told which branch it was looking for. Import the branches first.</td>
              </tr>
              <tr>
                <th scope="row">A row is outside your zone</th>
                <td>Refused by the database and reported by name. Your own rows still import.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </StaffShell>
  );
}
