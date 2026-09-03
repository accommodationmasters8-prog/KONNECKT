import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { BarChart, PieChart } from '@/components/staff/Charts';
import {
  DeleteReport, DeleteStation, ReportForm, StationForm,
} from '@/components/staff/StationForms';
import {
  AccountBreakdownForm, LoanBreakdownForm,
  type AccountRow, type LoanRow, type ProductOption,
} from '@/components/staff/BreakdownForms';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import {
  count, formatPeriod, getCategories, money,
  type StationReport, type StationRow,
} from '@/lib/tracker';
import { resolveLocale } from '@/lib/page';
import styles from '../../staff.module.css';

/* The ten that are columns on `station_reports`. Anything else the bank
   tracks is filed against the report instead, and submitted under `m_<id>`. */
const BUILT_IN_KEYS = new Set([
  'portfolio', 'accounts_opened', 'active_accounts', 'dormant_accounts',
  'deposits_tzs', 'loans_count', 'loans_value_tzs', 'simbanking_activated',
  'cards_issued', 'lipa_hapa_registered',
]);

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
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ chart?: string }>;
}) {
  const { locale } = await resolveLocale(params as Promise<{ locale: string }>);
  const { id } = await params;
  const { chart } = await searchParams;
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
      .select('id, station_id, period_month, period_kind, portfolio, accounts_opened, active_accounts, dormant_accounts, deposits_tzs, loans_count, loans_value_tzs, simbanking_activated, cards_issued, lipa_hapa_registered, note, submitted_at')
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

  // The types this station may actually file against.
  //
  // Every type used to be offered everywhere, so a bodaboda stand scrolled
  // past six kinds of account its riders cannot hold — and a list you scroll
  // past is a list you eventually tick the wrong row in. HQ scopes a type to a
  // category in Settings; this is where that scoping finally has an effect.
  // A type with no category is a CRDB product offered everywhere and stays on
  // every station's list.
  const [accountTypes, loanTypes, scopeRes, trackedRes] = await Promise.all([
    supabase.from('account_products' as never)
      .select('code, label_en, label_sw')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase.from('loan_products' as never)
      .select('code, label_en, label_sw')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase.from('product_categories' as never)
      .select('kind, product_code, category_id').limit(5000),
    /* What this station's category tracks. The filing form is generated from
       it, so a category that does not track loans does not ask about them. */
    supabase.from('category_metric_totals' as never)
      .select('metric_id, key, label, unit, help, display_order')
      .eq('category_id', station.category_id)
      .order('display_order', { ascending: true }),
  ]);

  // Which types this station may file against.
  //
  // A type with no categories at all is a CRDB-wide product and stays on every
  // list. A type with categories is offered only where it belongs — and it can
  // belong to several, which is why this is a set rather than a column
  // comparison.
  const scopedTo = new Map<string, Set<string>>();
  for (const row of (scopeRes.data as unknown as
    { kind: string; product_code: string; category_id: string }[]) ?? []) {
    const key = `${row.kind}:${row.product_code}`;
    if (!scopedTo.has(key)) scopedTo.set(key, new Set());
    scopedTo.get(key)!.add(row.category_id);
  }

  const offeredHere = (kind: 'account' | 'loan') => (row: { code: string }) => {
    const set = scopedTo.get(`${kind}:${row.code}`);
    return !set || set.size === 0 || set.has(station.category_id);
  };

  const reports = ((reportsRes.data as unknown as StationReport[]) ?? []).map((r) => ({
    ...r,
    deposits_tzs: Number(r.deposits_tzs),
    loans_value_tzs: Number(r.loans_value_tzs),
  }));

  // Where this station sits. A station page with no trail back to its branch
  // is a leaf with no tree, and the branch is the thing that owns it.
  const { data: branchData } = await supabase
    .from('branches' as never)
    .select('id, name, zone_code')
    .eq('id', station.branch_id)
    .maybeSingle();

  const branch = branchData as unknown as
    { id: string; name: string; zone_code: string | null } | null;

  /* The filing form's boxes. A built-in figure keeps its own column name, so
     the action that saves it does not change; anything the bank added since
     is submitted as `m_<id>` and stored per report. */
  const BUILT_IN_HELP: Record<string, string> = {
    portfolio: 'The denominator for coverage.',
    accounts_opened: 'Total ever opened here, not just this month.',
    dormant_accounts: 'Active plus dormant cannot exceed accounts opened.',
    simbanking_activated: 'Of the accounts here, how many switched it on.',
  };

  const trackedFields = ((trackedRes.data as unknown as {
    metric_id: string; key: string; label: string;
    unit: 'count' | 'money' | 'percent'; help: string | null;
  }[]) ?? []).map((m) => ({
    key: m.key,
    name: BUILT_IN_KEYS.has(m.key) ? m.key : `m_${m.metric_id}`,
    label: m.label,
    unit: m.unit,
    help: m.help ?? BUILT_IN_HELP[m.key] ?? null,
  }));

  const newest = reports[0];
  const previous = reports[1];

  /* Whatever was filed against the added metrics on the newest report, so
     correcting a month shows what is already there rather than blanks. */
  const filedValues = new Map<string, number>();
  if (newest) {
    const { data: valueRows } = await supabase
      .from('station_report_values' as never)
      .select('metric_id, value')
      .eq('report_id', newest.id);
    for (const row of (valueRows as unknown as
      { metric_id: string; value: number }[]) ?? []) {
      filedValues.set(`m_${row.metric_id}`, Number(row.value));
    }
  }

  // The split for the newest month only. Older months keep theirs, and it
  // shows in the history table; editing one is a matter of correcting that
  // month, which is what the form above already does.
  const [accountSplitRes, loanSplitRes] = newest
    ? await Promise.all([
        supabase.from('station_report_accounts' as never)
          .select('product_code, opened, active, dormant, deposits_tzs')
          .eq('report_id', newest.id),
        supabase.from('station_report_loans' as never)
          .select('loan_code, count, value_tzs')
          .eq('report_id', newest.id),
      ])
    : [{ data: [] }, { data: [] }];

  const productOption = (
    row: { code: string; label_en: string; label_sw: string },
  ): ProductOption => ({
    code: row.code,
    label: locale === 'sw' ? row.label_sw : row.label_en,
  });

  const accountOptions = ((accountTypes.data as unknown as
    { code: string; label_en: string; label_sw: string }[]) ?? [])
    .filter(offeredHere('account')).map(productOption);
  const loanOptions = ((loanTypes.data as unknown as
    { code: string; label_en: string; label_sw: string }[]) ?? [])
    .filter(offeredHere('loan')).map(productOption);

  const accountSplit = (accountSplitRes.data as unknown as AccountRow[]) ?? [];
  const loanSplit = (loanSplitRes.data as unknown as LoanRow[]) ?? [];
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

  /* Which figure the run of periods is drawn for. The choice is in the URL
     rather than in a dropdown, so a branch officer can send somebody the
     chart they are looking at rather than the page it lives on. Only the
     figures this category tracks are offered — and only the ones that are
     columns, since an added figure is filed per report and has no run yet. */
  const CHARTABLE = trackedFields.filter((f) => BUILT_IN_KEYS.has(f.key));
  const drawn = CHARTABLE.find((f) => f.key === chart) ?? CHARTABLE.find(
    (f) => f.key === 'deposits_tzs') ?? CHARTABLE[0];
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
        branch ? (
          <nav className={styles.crumbs} aria-label="Where this station sits">
            {branch.zone_code ? (
              <Link href={`/${locale}/staff/network?zone=${branch.zone_code}`} className={styles.link}>
                {branch.zone_code.replace(/_/g, ' ')}
              </Link>
            ) : null}
            <span aria-hidden="true">›</span>
            <Link href={`/${locale}/staff/branches/${branch.id}`} className={styles.link}>
              {branch.name}
            </Link>
            <span aria-hidden="true">›</span>
            <span className={styles.crumbHere}>{station.name}</span>
          </nav>
        ) : (
          <Link href={`/${locale}/staff/branches`} className={styles.link}>← All branches</Link>
        )
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
        <Panel title={drawn ? `${drawn.label} over time` : 'Over time'}>
          {CHARTABLE.length > 1 ? (
            <nav className={styles.measureBar} aria-label="Draw">
              <span className={styles.measureLabel}>Draw</span>
              {CHARTABLE.map((field) => (
                <Link
                  key={field.key}
                  href={`/${locale}/staff/stations/${station.id}?chart=${field.key}`}
                  className={field.key === drawn?.key ? styles.measureOn : styles.measureOff}
                  aria-current={field.key === drawn?.key ? 'true' : undefined}
                  scroll={false}
                >
                  {field.label}
                </Link>
              ))}
            </nav>
          ) : null}

          {drawn ? (
            <BarChart
              points={series.map((r) => ({
                label: label(r.period_month),
                value: Number((r as unknown as Record<string, number | null>)[drawn.key] ?? 0),
              }))}
              title={`${drawn.label} at ${station.name}`}
              format={(v) => (drawn.unit === 'money' ? money(v, locale, true) : count(v, locale))}
              tone="teal"
            />
          ) : (
            <PanelEmpty>This category is not tracking anything to draw.</PanelEmpty>
          )}
        </Panel>

        <Panel
          title="Coverage"
        >
          {!newest || newest.portfolio === 0 ? (
            <PanelEmpty>A headcount is needed before coverage means anything.</PanelEmpty>
          ) : (
            <PieChart
              title="Accounts against people"
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
      >
        <ReportForm
          fields={trackedFields.map((f) => ({
            ...f,
            value: BUILT_IN_KEYS.has(f.key) && newest
              ? (newest as unknown as Record<string, number | null>)[f.key] ?? ''
              : filedValues.get(f.name) ?? '',
          }))}
          stationId={station.id}
          defaultKind={(station as unknown as { reporting_kind?: 'daily' | 'weekly' | 'monthly' }).reporting_kind ?? 'monthly'}
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
                  simbanking_activated: newest.simbanking_activated,
                  cards_issued: newest.cards_issued,
                  lipa_hapa_registered: newest.lipa_hapa_registered,
                }
              : station.portfolio !== null
                ? { portfolio: station.portfolio }
                : undefined
          }
        />
      </Panel>

      {newest ? (
        <>
          <Panel
            title={`Accounts by type — ${formatPeriod(newest.period_month, locale)}`}
          >
            {accountOptions.length === 0 ? (
              <PanelEmpty>No account types are set up yet.</PanelEmpty>
            ) : (
              <AccountBreakdownForm
                reportId={newest.id}
                stationId={station.id}
                products={accountOptions}
                rows={accountSplit}
                totals={{
                  opened: newest.accounts_opened,
                  active: newest.active_accounts,
                  dormant: newest.dormant_accounts,
                  deposits: Number(newest.deposits_tzs),
                }}
              />
            )}
          </Panel>

          <Panel
            title={`Loans by type — ${formatPeriod(newest.period_month, locale)}`}
          >
            {loanOptions.length === 0 ? (
              <PanelEmpty>No loan types are set up yet.</PanelEmpty>
            ) : (
              <LoanBreakdownForm
                reportId={newest.id}
                stationId={station.id}
                products={loanOptions}
                rows={loanSplit}
                totals={{
                  count: newest.loans_count,
                  value: Number(newest.loans_value_tzs),
                }}
              />
            )}
          </Panel>
        </>
      ) : null}

      <Panel
        title="Every month on record"
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
      >
        <StationForm
          locale={locale}
          categories={categories.map((c) => ({ id: c.id, name: c.name_en }))}
          branches={[]}
          needsBranch={false}
          station={station}
        />
      </Panel>

      <Panel
        title="Remove this station"
      >
        <DeleteStation id={station.id} name={station.name} />
      </Panel>
    </StaffShell>
  );
}
