import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { ReportBuilder } from '@/components/staff/ReportBuilder';
import { ZONE_CODES, zoneWording } from '@/lib/access-scope';
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

  const [branchRes, catRes, eventRes] = await Promise.all([
    supabase.from('branches' as never)
      .select('id, name').eq('is_active', true)
      .order('name', { ascending: true }).limit(1000),
    supabase.from('tracker_categories' as never)
      .select('id, name_en').eq('is_active', true)
      .order('display_order', { ascending: true }).limit(100),
    supabase.from('tracked_events' as never)
      .select('id, name, event_date')
      .order('event_date', { ascending: false })
      .limit(300),
  ]);

  const branches = ((branchRes.data as unknown as { id: string; name: string }[]) ?? [])
    .map((b) => ({ value: b.id, label: b.name }));
  const categories = ((catRes.data as unknown as { id: string; name_en: string }[]) ?? [])
    .map((c) => ({ value: c.id, label: c.name_en }));
  const zones = ZONE_CODES.map((z) => ({ value: z, label: zoneWording(z) }));
  const events = ((eventRes.data as unknown as
    { id: string; name: string; event_date: string }[]) ?? [])
    .map((e) => ({ value: e.id, label: `${e.name} — ${e.event_date}` }));

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
      <Panel
        title="Build a report"
      >
        <ReportBuilder
          locale={locale}
          zones={zones}
          branches={branches}
          categories={categories}
          events={events}
        />
      </Panel>

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
