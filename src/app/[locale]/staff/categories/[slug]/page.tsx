import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StaffShell } from '@/components/staff/StaffShell';
import { FoldPanel, Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { BarTable } from '@/components/staff/Charts';
import { AddCategoryLoanType, DeleteCategory } from '@/components/staff/CategoryForms';
import { CategoryMetrics, type MetricOption } from '@/components/staff/CategoryMetrics';
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
/* The cards cycle through the tones rather than each having one assigned:
   the set is chosen by the bank now, so there is no fixed list to colour. */
const CARD_TONES = ['teal', 'green', 'gold', 'pink', 'ink'] as const;

/** Metrics the station ranking below can sort by, keyed by metric. */
const RANKABLE: Record<string, string | undefined> = {
  accounts_opened: 'accounts',
  portfolio: 'people',
  deposits_tzs: 'deposits',
  loans_value_tzs: 'loans',
  simbanking_activated: 'simbanking',
  lipa_hapa_registered: 'lipahapa',
};

interface TrackedMetric {
  metric_id: string;
  key: string;
  label: string;
  unit: 'count' | 'money' | 'percent';
  total: number;
  reporting: number;
}

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

  const { data: stationRows } = await supabase
    .from('stations' as never)
    .select('id, name, short_name, category_id, branch_id, zone_code, address, district_name, status, portfolio, last_report_month, contact_name, contact_phone, contact_email, contact_role, notes, created_at')
    .eq('category_id', category.id)
    .order('name', { ascending: true })
    .limit(1000);

  const stations = (stationRows as unknown as StationRow[]) ?? [];
  const ids = stations.map((s) => s.id);

  const [latestRes, loanTypesRes, trackedRes, allMetricsRes] = await Promise.all([
    ids.length
      ? supabase.from('station_latest' as never).select('*').in('station_id', ids)
      : Promise.resolve({ data: [] }),
    supabase.from('loan_products' as never)
      .select('code, label_en, label_sw, category_id, is_active')
      .or(`category_id.eq.${category.id},category_id.is.null`)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    /* Summed in Postgres over every institution in the category. The totals
       above it were reduced in JavaScript from the thousand rows this page
       had loaded, so a category with sixteen thousand primary schools was
       reporting the figures of one thousand of them. */
    supabase.from('category_metric_totals' as never)
      .select('metric_id, key, label, unit, total, reporting, display_order')
      .eq('category_id', category.id)
      .order('display_order', { ascending: true }),
    supabase.from('metrics' as never)
      .select('id, key, label, unit, column_name')
      .eq('is_active', true)
      .order('column_name', { ascending: true, nullsFirst: true })
      .order('label', { ascending: true }),
  ]);

  const tracked = (trackedRes.data as unknown as TrackedMetric[]) ?? [];

  const allMetrics: MetricOption[] = ((allMetricsRes.data as unknown as {
    id: string; key: string; label: string;
    unit: 'count' | 'money' | 'percent'; column_name: string | null;
  }[]) ?? []).map((m) => ({
    id: m.id, key: m.key, label: m.label, unit: m.unit,
    builtIn: m.column_name !== null,
  }));

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
      {/* The cards this category tracks — its own set, not a fixed nine.
          A university and a boda stand do not measure the same things, and
          the bank decides which is which in Settings. Adding one there makes
          it appear here and on the filing form, which is what lets the set
          grow without a deploy. */}
      <div className={styles.metrics}>
        {tracked.length === 0 ? (
          <p className={styles.sub}>
            This category is not tracking anything yet.{' '}
            <Link href={`/${locale}/staff/categories`} className={styles.link}>
              Choose what it tracks
            </Link>.
          </p>
        ) : (
          tracked.map((metric, i) => (
            <MetricCard
              key={metric.metric_id}
              tone={CARD_TONES[i % CARD_TONES.length]}
              label={metric.label}
              value={
                metric.unit === 'money'
                  ? money(Number(metric.total), locale, true)
                  : metric.unit === 'percent'
                    ? `${Math.round(Number(metric.total) * 10) / 10}%`
                    : count(Number(metric.total), locale)
              }
              note={
                metric.reporting > 0
                  ? `${count(metric.reporting, locale)} filed`
                  : 'Nothing filed yet'
              }
              href={RANKABLE[metric.key]
                ? `/${locale}/staff/categories/${category.slug}?by=${RANKABLE[metric.key]}`
                : undefined}
              hint={RANKABLE[metric.key] ? 'Rank stations by it' : undefined}
            />
          ))
        )}
      </div>

      {session.role === 'hq' ? (
        <FoldPanel
          title="What this category tracks"
          count={tracked.length}
          note="Changes the cards above, and the form its stations file"
        >
          <CategoryMetrics
            categoryId={category.id}
            all={allMetrics}
            chosen={tracked.map((t) => t.metric_id)}
          />
        </FoldPanel>
      ) : null}

      <FoldPanel
        title={`Stations ranked by ${MEASURES[measure].label.toLowerCase()}`}
        count={ranked.length}
        note="Top 20 on their newest report"
      >
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

        {ranked.length === 0 ? (
          <PanelEmpty>
            No stations in this category yet. Add one below.
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
      </FoldPanel>

      <FoldPanel
        title="Loan types here"
        count={loanTypes.length}
        note="What a station here files loans against"
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
      </FoldPanel>

      <Panel
        title={`Add a station to ${category.name_en}`}
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
        >
          <ImportForm
            canChooseZone={session.role === 'hq'}
            fixedCategory={{ slug: category.slug, name: category.name_en }}
          />
        </Panel>
      ) : null}

      <FoldPanel
        title="Every station in this category"
        count={stations.length}
        note="Including the ones that have never reported"
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
      </FoldPanel>
      {session.role === 'hq' ? (
        <Panel
          title="Remove this category"
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
