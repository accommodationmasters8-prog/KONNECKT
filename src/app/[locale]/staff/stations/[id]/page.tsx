import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { Donut, TrendChart } from '@/components/staff/Charts';
import { DeleteReport, ReportForm, StationForm } from '@/components/staff/StationForms';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import {
  count, formatPeriod, getCategories, money,
  type StationReport, type StationRow,
} from '@/lib/tracker';
import { resolveLocale } from '@/lib/page';
import styles from '../../staff.module.css';

export const metadata: Metadata = {
  title: 'Station — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * One station: what it is, what it has produced, and the form that updates it.
 *
 * Analytics and data entry on the same screen deliberately. The person filing
 * March's figures is the person who can see that March looks wrong, and making
 * them navigate away to check is how a wrong number gets filed anyway.
 */
export default async function StationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await resolveLocale(params as Promise<{ locale: string }>);
  const { id } = await params;
  const session = await getStaffSession();
  const supabase = await getServerClient();
  const nav = staffNav(locale, STAFF_LABELS);

  if (!supabase || !session.signedIn) {
    return (
      <StaffShell
        locale={locale} role={session.role} active="stations" nav={nav}
        title="Station" scopeLabel={session.scopeLabel} user={session.user}
      >
        <Panel title="Station">
          <PanelEmpty>Sign in to open a station.</PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  const [stationRes, reportsRes, categories] = await Promise.all([
    supabase.from('stations' as never)
      .select('id, name, short_name, category_id, branch_id, zone_code, address, district_name, status, portfolio, last_report_month, contact_name, contact_phone, contact_email, contact_role, notes, created_at')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('station_reports' as never)
      .select('id, station_id, period_month, portfolio, accounts_opened, active_accounts, dormant_accounts, deposits_tzs, loans_count, loans_value_tzs, note, submitted_at')
      .eq('station_id', id)
      .order('period_month', { ascending: false })
      .limit(60),
    getCategories(),
  ]);

  const station = stationRes.data as unknown as StationRow | null;

  // Either it does not exist or this account may not reach it. The console
  // does not distinguish: saying "exists, but not yours" is itself a
  // disclosure about another branch's book.
  if (!station) notFound();

  const reports = ((reportsRes.data as unknown as StationReport[]) ?? []).map((r) => ({
    ...r,
    deposits_tzs: Number(r.deposits_tzs),
    loans_value_tzs: Number(r.loans_value_tzs),
  }));

  const newest = reports[0];
  const previous = reports[1];
  const category = categories.find((c) => c.id === station.category_id);
  const noun = locale === 'sw' ? category?.member_noun_sw : category?.member_noun_en;

  const coverage = newest && newest.portfolio > 0
    ? Math.round((newest.accounts_opened / newest.portfolio) * 1000) / 10
    : null;

  const depositsChange = newest && previous && Number(previous.deposits_tzs) > 0
    ? Math.round(((Number(newest.deposits_tzs) - Number(previous.deposits_tzs))
        / Number(previous.deposits_tzs)) * 1000) / 10
    : null;

  // Oldest first for the chart; the table below reads newest first.
  const series = reports.slice().reverse();
  const label = (period: string) =>
    formatPeriod(period, locale).replace(/\s\d{4}$/, '');

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="stations"
      nav={nav}
      title={station.name}
      scopeLabel={[
        category?.name_en,
        station.district_name ?? station.address,
        station.status,
      ].filter(Boolean).join(' · ')}
      user={session.user}
      actions={
        <Link href={`/${locale}/staff/stations`} className={styles.link}>← All stations</Link>
      }
    >
      <div className={styles.metrics}>
        <MetricCard
          tone="teal"
          label={`${noun ? noun[0].toUpperCase() + noun.slice(1) : 'People'} in it`}
          value={newest ? count(newest.portfolio, locale) : '—'}
          note={newest ? `as reported ${formatPeriod(newest.period_month, locale)}` : 'Nothing reported yet'}
        />
        <MetricCard
          tone="green"
          label="Accounts opened"
          value={newest ? count(newest.accounts_opened, locale) : '—'}
          note={coverage === null ? 'Coverage needs a headcount' : `${coverage}% coverage`}
        />
        <MetricCard
          tone="gold"
          label="Deposits mobilised"
          value={newest ? money(Number(newest.deposits_tzs), locale, true) : '—'}
          note={
            depositsChange === null
              ? 'One month on record'
              : `${depositsChange >= 0 ? '▲' : '▼'} ${Math.abs(depositsChange)}% on last month`
          }
        />
        <MetricCard
          tone="ink"
          label="Loans"
          value={newest ? count(newest.loans_count, locale) : '—'}
          note={newest ? money(Number(newest.loans_value_tzs), locale, true) : 'Nothing reported yet'}
        />
      </div>

      <div className={styles.split}>
        <Panel
          title="Deposits over time"
          description="Every month this station has reported."
        >
          <TrendChart
            points={series.map((r) => ({ label: label(r.period_month), value: Number(r.deposits_tzs) }))}
            title={`Deposits mobilised at ${station.name}`}
            format={(v) => money(v, locale, true)}
            tone="teal"
          />
        </Panel>

        <Panel
          title="Coverage"
          description="How much of this place actually banks with CRDB."
        >
          {!newest || newest.portfolio === 0 ? (
            <PanelEmpty>A headcount is needed before coverage means anything.</PanelEmpty>
          ) : (
            <Donut
              title="Accounts against people"
              total={coverage ?? 0}
              totalLabel="% covered"
              slices={[
                { label: 'With an account', value: newest.accounts_opened, tone: 'teal' },
                {
                  label: `${noun ?? 'People'} without one`,
                  value: Math.max(newest.portfolio - newest.accounts_opened, 0),
                  tone: 'slate',
                },
              ]}
            />
          )}
        </Panel>
      </div>

      <Panel
        title={newest ? 'File or correct a month' : 'File the first month'}
        description="One record per month. Saving a month that is already on record corrects it, and the audit log keeps what it said before."
      >
        <ReportForm
          stationId={station.id}
          months={reports.map((r) => r.period_month.slice(0, 7))}
          defaults={
            newest
              ? {
                  portfolio: newest.portfolio,
                  accounts_opened: newest.accounts_opened,
                  active_accounts: newest.active_accounts,
                  dormant_accounts: newest.dormant_accounts,
                  deposits_tzs: Number(newest.deposits_tzs),
                  loans_count: newest.loans_count,
                  loans_value_tzs: Number(newest.loans_value_tzs),
                }
              : station.portfolio !== null
                ? { portfolio: station.portfolio }
                : undefined
          }
        />
      </Panel>

      <Panel
        title="Every month on record"
        description="Newest first. Open a month in the form above by choosing it there."
      >
        {reports.length === 0 ? (
          <PanelEmpty>Nothing filed yet.</PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" className={styles.num}>People</th>
                  <th scope="col" className={styles.num}>Opened</th>
                  <th scope="col" className={styles.num}>Active</th>
                  <th scope="col" className={styles.num}>Dormant</th>
                  <th scope="col" className={styles.num}>Deposits</th>
                  <th scope="col" className={styles.num}>Loans</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <th scope="row">
                      {formatPeriod(report.period_month, locale)}
                      {report.note ? <span className={styles.sub}>{report.note}</span> : null}
                    </th>
                    <td className={styles.num}>{count(report.portfolio, locale)}</td>
                    <td className={styles.num}>{count(report.accounts_opened, locale)}</td>
                    <td className={styles.num}>{count(report.active_accounts, locale)}</td>
                    <td className={styles.num}>{count(report.dormant_accounts, locale)}</td>
                    <td className={styles.num}>{money(Number(report.deposits_tzs), locale, true)}</td>
                    <td className={styles.num}>{count(report.loans_count, locale)}</td>
                    <td>
                      <DeleteReport id={report.id} month={report.period_month} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="The station itself"
        description="Who it is, where it is, and who to call. Changing these does not touch any month already filed."
      >
        <StationForm
          locale={locale}
          categories={categories.map((c) => ({ id: c.id, name: c.name_en }))}
          branches={[]}
          needsBranch={false}
          station={station}
        />
      </Panel>
    </StaffShell>
  );
}
