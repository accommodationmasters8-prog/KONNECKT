import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { BarChart, BarTable, PieChart } from '@/components/staff/Charts';
import { AddCategoryLoanType, DeleteCategory } from '@/components/staff/CategoryForms';
import { StationForm } from '@/components/staff/StationForms';
import { ImportForm } from '@/components/staff/ImportForm';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import {
  count, formatPeriod, getCategories, money,
  type StationLatest, type StationRow,
} from '@/lib/tracker';
import { resolveLocale } from '@/lib/page';
import styles from '../../staff.module.css';

export const metadata: Metadata = {
  title: 'Category — Konekt tracker',
  robots: { index: false, follow: false },
};

/** What the category can be ranked and charted by. */
const MEASURES = {
  accounts: { label: 'Accounts opened', kind: 'count' as const },
  people: { label: 'People in the portfolio', kind: 'count' as const },
  deposits: { label: 'Deposits mobilised', kind: 'money' as const },
  loans: { label: 'Loan value', kind: 'money' as const },
  coverage: { label: 'Coverage', kind: 'percent' as const },
  simbanking: { label: 'SimBanking activated', kind: 'count' as const },
  lipahapa: { label: 'Lipa Hapa registered', kind: 'count' as const },
};

type MeasureKey = keyof typeof MEASURES;

/**
 * One category, analysed.
 *
 * The measure is chosen with a link rather than a dropdown: it is in the URL,
 * so a zone manager can send "look at this category by deposits" to HQ and HQ
 * opens the same screen. A dropdown holds that choice in a component nobody
 * else can see.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ by?: string }>;
}) {
  const { locale } = await resolveLocale(params as Promise<{ locale: string }>);
  const { slug } = await params;
  const { by } = await searchParams;
  const session = await getStaffSession();
  const supabase = await getServerClient();
  const nav = staffNav(locale, STAFF_LABELS);

  const measure: MeasureKey = (by && by in MEASURES ? by : 'accounts') as MeasureKey;

  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  if (!supabase || !session.signedIn) {
    return (
      <StaffShell
        locale={locale} role={session.role} active="categories" nav={nav}
        title={category.name_en} scopeLabel={session.scopeLabel} user={session.user}
      >
        <Panel title={category.name_en}>
          <PanelEmpty>Sign in to see this category&rsquo;s figures.</PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  const since = new Date();
  since.setMonth(since.getMonth() - 11);
  const from = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-01`;

  const { data: stationRows } = await supabase
    .from('stations' as never)
    .select('id, name, short_name, category_id, branch_id, zone_code, address, district_name, status, portfolio, last_report_month, contact_name, contact_phone, contact_email, contact_role, notes, created_at')
    .eq('category_id', category.id)
    .order('name', { ascending: true })
    .limit(1000);

  const stations = (stationRows as unknown as StationRow[]) ?? [];
  const ids = stations.map((s) => s.id);

  const [latestRes, trendRes, loanTypesRes, splitRes] = await Promise.all([
    ids.length
      ? supabase.from('station_latest' as never).select('*').in('station_id', ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('station_reports' as never)
          .select('period_month, deposits_tzs, accounts_opened, portfolio, station_id, simbanking_activated, cards_issued, lipa_hapa_registered')
          .in('station_id', ids)
          .gte('period_month', from)
          .limit(5000)
      : Promise.resolve({ data: [] }),
    supabase.from('loan_products' as never)
      .select('code, label_en, label_sw, category_id, is_active')
      .or(`category_id.eq.${category.id},category_id.is.null`)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    // The account-type split across this category's newest reports, which is
    // the pie: what kind of account the category's book is actually made of.
    ids.length
      ? supabase.from('station_report_accounts' as never)
          .select('product_code, opened, deposits_tzs, report_id')
          .limit(20000)
      : Promise.resolve({ data: [] }),
  ]);

  const { data: branchData } = await supabase
    .from('branches' as never)
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(1000);
  const branchOptions = (branchData as unknown as { id: string; name: string }[]) ?? [];

  const loanTypes = (loanTypesRes.data as unknown as {
    code: string; label_en: string; label_sw: string;
    category_id: string | null; is_active: boolean;
  }[]) ?? [];

  const latest = new Map(
    ((latestRes.data as unknown as StationLatest[]) ?? []).map((r) => [r.station_id, r]),
  );

  const totals = [...latest.values()].reduce(
    (acc, r) => ({
      portfolio: acc.portfolio + Number(r.portfolio ?? 0),
      accounts: acc.accounts + Number(r.accounts_opened ?? 0),
      active: acc.active + Number(r.active_accounts ?? 0),
      dormant: acc.dormant + Number(r.dormant_accounts ?? 0),
      deposits: acc.deposits + Number(r.deposits_tzs ?? 0),
      loans: acc.loans + Number(r.loans_value_tzs ?? 0),
      loanCount: acc.loanCount + Number(r.loans_count ?? 0),
      simbanking: acc.simbanking + Number(
        (r as unknown as { simbanking_activated?: number }).simbanking_activated ?? 0),
      cards: acc.cards + Number(
        (r as unknown as { cards_issued?: number }).cards_issued ?? 0),
      lipaHapa: acc.lipaHapa + Number(
        (r as unknown as { lipa_hapa_registered?: number }).lipa_hapa_registered ?? 0),
    }),
    {
      portfolio: 0, accounts: 0, active: 0, dormant: 0, deposits: 0, loans: 0,
      loanCount: 0, simbanking: 0, cards: 0, lipaHapa: 0,
    },
  );

  const coverage = totals.portfolio > 0
    ? Math.round((totals.accounts / totals.portfolio) * 1000) / 10
    : null;

  // The trend, by the chosen measure.
  const byMonth = new Map<string, number>();
  for (const row of (trendRes.data as unknown as
    { period_month: string; deposits_tzs: number; accounts_opened: number; portfolio: number }[]) ?? []) {
    const key = row.period_month.slice(0, 7);
    const r = row as unknown as Record<string, number | undefined>;
    const value = measure === 'deposits' ? Number(row.deposits_tzs)
      : measure === 'people' ? Number(row.portfolio)
        : measure === 'simbanking' ? Number(r.simbanking_activated ?? 0)
          : measure === 'lipahapa' ? Number(r.lipa_hapa_registered ?? 0)
            : Number(row.accounts_opened);
    byMonth.set(key, (byMonth.get(key) ?? 0) + value);
  }

  const trend = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      label: formatPeriod(`${month}-01`, locale).replace(/\s\d{4}$/, ''),
      value,
    }));

  const valueOf = (station: StationRow) => {
    const l = latest.get(station.id);
    if (!l) return 0;
    switch (measure) {
      case 'people': return Number(l.portfolio);
      case 'deposits': return Number(l.deposits_tzs);
      case 'loans': return Number(l.loans_value_tzs);
      case 'coverage': return Number(l.coverage_pct ?? 0);
      case 'simbanking':
        return Number((l as unknown as { simbanking_activated?: number }).simbanking_activated ?? 0);
      case 'lipahapa':
        return Number((l as unknown as { lipa_hapa_registered?: number }).lipa_hapa_registered ?? 0);
      default: return Number(l.accounts_opened);
    }
  };

  const format = (value: number) =>
    MEASURES[measure].kind === 'money' ? money(value, locale, true)
      : MEASURES[measure].kind === 'percent' ? `${value}%`
        : count(value, locale);

  const ranked = stations
    .slice()
    .sort((a, b) => valueOf(b) - valueOf(a))
    .slice(0, 20);

  const noun = locale === 'sw' ? category.member_noun_sw : category.member_noun_en;

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="categories"
      nav={nav}
      title={category.name_en}
      scopeLabel={`${count(stations.length, locale)} stations · counted in ${noun} · ${session.scopeLabel}`}
      user={session.user}
      actions={
        <Link href={`/${locale}/staff/categories`} className={styles.link}>← All categories</Link>
      }
    >
      <div className={styles.metrics}>
        <MetricCard
          tone="teal"
          label={`${noun[0].toUpperCase()}${noun.slice(1)} in the portfolio`}
          value={count(totals.portfolio, locale)}
          note={`${count(stations.length, locale)} stations`}
        />
        <MetricCard
          tone="green"
          label="Accounts opened"
          value={count(totals.accounts, locale)}
          note={coverage === null ? 'No portfolio reported' : `${coverage}% coverage`}
        />
        <MetricCard
          tone="gold"
          label="Deposits mobilised"
          value={money(totals.deposits, locale, true)}
          note={totals.loans > 0 ? `${money(totals.loans, locale, true)} in loans` : 'No loans reported'}
        />
        <MetricCard
          tone="pink"
          label="Active accounts"
          value={count(totals.active, locale)}
          note={
            totals.accounts > 0
              ? `${Math.round((totals.active / totals.accounts) * 1000) / 10}% of what was opened`
              : 'Nothing opened yet'
          }
        />
        <MetricCard
          tone="ink"
          label="Dormant accounts"
          value={count(totals.dormant, locale)}
          note={
            totals.accounts > 0
              ? `${Math.round((totals.dormant / totals.accounts) * 1000) / 10}% gone quiet — the number to attack`
              : 'Nothing opened yet'
          }
        />
      </div>

      {/* The three channels, for this category alone. An account opened at a
          bodaboda stand and never activated on SimBanking is a number on a
          form, not a customer — and until these were carried per category
          there was no way to tell which kind of place that happens in. */}
      <div className={styles.metrics}>
        <MetricCard
          tone="teal"
          label="SimBanking activated"
          value={count(totals.simbanking, locale)}
          note={
            totals.accounts > 0
              ? `${Math.round((totals.simbanking / totals.accounts) * 1000) / 10}% of the accounts opened here`
              : 'Nothing opened yet'
          }
          href={`/${locale}/staff/categories/${category.slug}?by=simbanking`}
          hint="Rank stations by it"
        />
        <MetricCard
          tone="green"
          label="Lipa Hapa registered"
          value={count(totals.lipaHapa, locale)}
          note={
            totals.accounts > 0
              ? `${Math.round((totals.lipaHapa / totals.accounts) * 1000) / 10}% of the accounts opened here`
              : 'Nothing opened yet'
          }
          href={`/${locale}/staff/categories/${category.slug}?by=lipahapa`}
          hint="Rank stations by it"
        />
        <MetricCard
          tone="gold"
          label="Cards issued"
          value={count(totals.cards, locale)}
          note={
            totals.accounts > 0
              ? `${Math.round((totals.cards / totals.accounts) * 1000) / 10}% of the accounts opened here`
              : 'Nothing opened yet'
          }
        />
        <MetricCard
          tone="pink"
          label="Loans given"
          value={count(totals.loanCount, locale)}
          note={
            totals.loans > 0
              ? `${money(totals.loans, locale, true)} lent`
              : 'No loans reported in this category'
          }
          href={`/${locale}/staff/categories/${category.slug}?by=loans`}
          hint="Rank stations by value"
        />
      </div>

      {/* The measure switch. Links, not a dropdown: the choice is in the URL,
          so it can be sent to somebody else. */}
      <nav className={styles.measureBar} aria-label="Analyse by">
        <span className={styles.measureLabel}>Analyse by</span>
        {(Object.keys(MEASURES) as MeasureKey[]).map((key) => (
          <Link
            key={key}
            href={`/${locale}/staff/categories/${category.slug}?by=${key}`}
            className={key === measure ? styles.measureOn : styles.measureOff}
            aria-current={key === measure ? 'true' : undefined}
          >
            {MEASURES[key].label}
          </Link>
        ))}
      </nav>

      <div className={styles.split}>
        <Panel
          title={`${MEASURES[measure].label} over time`}
          description="The sum across every station in this category that reported that month."
        >
          <BarChart
            points={trend}
            title={`${MEASURES[measure].label} for ${category.name_en}`}
            format={format}
            tone={category.colour === 'ink' ? 'teal' : category.colour}
          />
        </Panel>

        <Panel
          title="How much of it is reached"
          description="Everyone in these stations, split by whether they hold an account."
        >
          {totals.portfolio === 0 ? (
            <PanelEmpty>No headcount reported yet, so there is no share to show.</PanelEmpty>
          ) : (
            <PieChart
              title="Coverage of the category"
              format={(v) => count(v, locale)}
              slices={[
                { label: 'With an account', value: totals.accounts, tone: 'teal' },
                {
                  label: `${noun} without one`,
                  value: Math.max(totals.portfolio - totals.accounts, 0),
                  tone: 'slate',
                },
              ]}
            />
          )}
        </Panel>
      </div>

      <Panel
        title={`Stations by ${MEASURES[measure].label.toLowerCase()}`}
        description="Ranked on the newest report from each. Click a station to see its full history or file a month."
      >
        {ranked.length === 0 ? (
          <PanelEmpty>
            No stations in this category yet. Add one from the stations screen.
          </PanelEmpty>
        ) : (
          <BarTable
            caption={`Stations ranked by ${MEASURES[measure].label}`}
            unitLabel={MEASURES[measure].label}
            rows={ranked.map((station) => {
              const l = latest.get(station.id);
              return {
                label: station.short_name || station.name,
                value: Math.round(valueOf(station)),
                secondary: l
                  ? `${l.coverage_pct ?? 0}% of ${count(l.portfolio, locale)} · ${formatPeriod(l.period_month, locale)}`
                  : 'Nothing reported yet',
              };
            })}
          />
        )}
      </Panel>

      <Panel
        title="Loan types in this category"
        description="What a station here can record its loans against. Types with no category are CRDB products offered everywhere; the rest belong to this category alone."
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Loan type</th>
                <th scope="col">Where it applies</th>
              </tr>
            </thead>
            <tbody>
              {loanTypes.map((lt) => (
                <tr key={lt.code}>
                  <th scope="row">{locale === 'sw' ? lt.label_sw : lt.label_en}</th>
                  <td>
                    {lt.category_id
                      ? <span className={styles.chipActive}>{category.name_en} only</span>
                      : <span className={styles.chip}>Everywhere</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {session.role === 'hq' ? (
          <div className={styles.formBelowTable}>
            <AddCategoryLoanType categoryId={category.id} />
          </div>
        ) : null}
      </Panel>

      <Panel
        title={`Add a station to ${category.name_en}`}
        description="It is filed under this category from the moment it is added, and starts reporting on whatever rhythm suits it."
      >
        <StationForm
          locale={locale}
          categories={[{ id: category.id, name: category.name_en }]}
          branches={branchOptions}
          needsBranch={session.role !== 'branch'}
        />
      </Panel>

      {/* The bulk door, on the screen the list belongs to.
          Somebody opening Hospitals with a spreadsheet of hospitals should not
          have to go to a general import screen and then answer "which
          category" — the screen they are standing on already knows, so the
          file needs no category column at all. */}
      {session.role === 'hq' || session.role === 'zone' ? (
        <Panel
          title={`Add many ${category.name_en.toLowerCase()} at once`}
          description="Upload the list you already have, in Excel or CSV. Check it first: you get a line-by-line list of what will be added and what will be skipped, before anything is written."
        >
          <ImportForm
            canChooseZone={session.role === 'hq'}
            fixedCategory={{ slug: category.slug, name: category.name_en }}
          />
        </Panel>
      ) : null}

      <Panel
        title="Every station in this category"
        description="Including the ones that have never reported — those are the gap. Click a station to open it, file a month or correct one."
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Station</th>
                <th scope="col" className={styles.num}>People</th>
                <th scope="col" className={styles.num}>Accounts</th>
                <th scope="col" className={styles.num}>Coverage</th>
                <th scope="col" className={styles.num}>Deposits</th>
                <th scope="col">Last report</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((station) => {
                const l = latest.get(station.id);
                return (
                  <tr key={station.id}>
                    <th scope="row">
                      <Link href={`/${locale}/staff/stations/${station.id}`} className={styles.link}>
                        {station.name}
                      </Link>
                      <span className={styles.sub}>{station.district_name ?? '—'}</span>
                    </th>
                    <td className={styles.num}>{l ? count(l.portfolio, locale) : '—'}</td>
                    <td className={styles.num}>{l ? count(l.accounts_opened, locale) : '—'}</td>
                    <td className={styles.num}>{l?.coverage_pct == null ? '—' : `${l.coverage_pct}%`}</td>
                    <td className={styles.num}>{l ? money(Number(l.deposits_tzs), locale, true) : '—'}</td>
                    <td>
                      {station.last_report_month
                        ? <span className={styles.chip}>{formatPeriod(station.last_report_month, locale)}</span>
                        : <span className={styles.chipWarn}>never</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      {session.role === 'hq' ? (
        <Panel
          title="Remove this category"
          description="Everything filed under it goes too. Retiring the stations one by one is almost always the better move."
        >
          <DeleteCategory
            id={category.id}
            name={category.name_en}
            stations={stations.length}
          />
        </Panel>
      ) : null}
    </StaffShell>
  );
}
