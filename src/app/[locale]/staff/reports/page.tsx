import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { formatPeriod } from '@/lib/tracker';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Reports — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * Downloads.
 *
 * Every file here contains exactly what the person asking can already see on
 * screen — the export runs the same queries under the same session, so row
 * level security decides its contents rather than a second set of rules that
 * could drift from the first.
 *
 * CSV, not XLSX. It opens in Excel, in Sheets and in a text editor, needs no
 * dependency, and a branch officer on a slow connection gets tens of
 * kilobytes rather than hundreds.
 */
export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();
  const nav = staffNav(locale, STAFF_LABELS);

  if (!session.signedIn || !supabase) {
    return (
      <StaffShell
        locale={locale} role={session.role} active="reports" nav={nav}
        title="Reports" scopeLabel={session.scopeLabel} user={session.user}
      >
        <Panel title="Reports">
          <PanelEmpty>Sign in to download your figures.</PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  // The months that actually have something in them, newest first.
  const { data } = await supabase
    .from('station_reports' as never)
    .select('period_month')
    .order('period_month', { ascending: false })
    .limit(2000);

  const months = [...new Set(
    ((data as unknown as { period_month: string }[]) ?? []).map((r) => r.period_month),
  )].slice(0, 12);

  const reports = [
    {
      kind: 'reports',
      title: 'Monthly figures',
      body: 'Every month filed by every station you can reach — people, accounts, coverage, deposits and loans, one row per station per month. This is the one to take into a board pack.',
    },
    {
      kind: 'stations',
      title: 'Station register',
      body: 'Every station with its category, branch, zone, district, status and contact. No figures — this is the list of what is being tracked.',
    },
    {
      kind: 'events',
      title: 'Events and their KPIs',
      body: 'Every event with turnout, budget, actual spend, accounts opened and cost per account, past and upcoming.',
    },
    {
      kind: 'branches',
      title: 'Branches and zones',
      body: 'The branch list with the zone each is assigned to. Unassigned branches are named as such — they are the ones no zone manager can see.',
    },
  ];

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="reports"
      nav={nav}
      title="Reports"
      scopeLabel={`${session.scopeLabel} · downloads carry only what you can see`}
      user={session.user}
    >
      {reports.map((report) => (
        <Panel key={report.kind} title={report.title} description={report.body}>
          <div className={styles.downloadRow}>
            <a
              className="btn btn--primary btn--sm"
              href={`/api/reports/${report.kind}`}
              download
            >
              Download CSV
            </a>

            {report.kind === 'reports' && months.length > 0 ? (
              <span className={styles.downloadMonths}>
                or one month:
                {months.map((month) => (
                  <a
                    key={month}
                    className={styles.link}
                    href={`/api/reports/reports?month=${month}`}
                    download
                  >
                    {formatPeriod(month, locale)}
                  </a>
                ))}
              </span>
            ) : null}
          </div>
        </Panel>
      ))}

      <Panel title="What is in them">
        <p className={styles.plainNote}>
          These files are generated when you click, from the live database,
          under your own account. Two people downloading the same report at the
          same moment can get different files, and that is correct: a branch
          officer&rsquo;s copy contains their branch, and HQ&rsquo;s contains
          the country. Nothing here can show you more than the screens can.
        </p>
      </Panel>
    </StaffShell>
  );
}
