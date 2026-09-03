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
      >
        <ImportForm
          canChooseZone={session.role === 'hq'}
          initialKind={kind === 'stations' ? 'stations' : 'branches'}
        />
      </Panel>

      {/* One line, not a second panel of rules.
          This screen is for a mixed file spanning several branches or
          categories; the common case is importing into one, and that lives on
          the branch and category pages where the answer is already known.
          Everything about matching is in the manual rather than repeated
          here. */}
      <p className={styles.note}>
        Importing into a single branch or a single category? Open that branch or
        category instead — the uploader is on the page, and the file then needs
        no branch or category column.{' '}
        <Link href={`/${locale}/staff/manual#import`} className={styles.link}>
          How matching works
        </Link>
      </p>

    </StaffShell>
  );
}
