import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { FoldPanel, Panel, PanelEmpty } from '@/components/staff/Panel';
import { BarTable, PieChart } from '@/components/staff/Charts';
import { CategoryForm } from '@/components/staff/CategoryForms';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { count, getCategories, money, type CategoryTotals } from '@/lib/tracker';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Categories — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * The categories, side by side.
 *
 * The comparison that decides where next quarter goes: which kind of place
 * CRDB has reached, and which kind it has barely started on. Coverage is the
 * column that matters — a category with 40,000 accounts and 2% coverage is a
 * bigger opportunity than one with 8,000 accounts and 60%.
 */
export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  const categories = await getCategories();

  let totals: CategoryTotals[] = [];
  if (supabase && session.signedIn) {
    const { data } = await supabase.from('category_totals' as never).select('*');
    totals = (data as unknown as CategoryTotals[]) ?? [];
  }
  const byId = new Map(totals.map((t) => [t.category_id, t]));

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="categories"
      nav={staffNav(locale, STAFF_LABELS)}
      title="Categories"
      scopeLabel={session.scopeLabel}
      user={session.user}
    >
      {!session.signedIn ? (
        <Panel title="Categories">
          <PanelEmpty>Sign in to see what is being tracked.</PanelEmpty>
        </Panel>
      ) : (
        <>

          <div className={styles.cardGrid}>
            {categories.map((category) => {
              const t = byId.get(category.id);
              return (
                <Link
                  key={category.id}
                  href={`/${locale}/staff/categories/${category.slug}`}
                  className={`${styles.categoryCard} ${styles[category.colour]}`}
                >
                  <span className={styles.categoryName}>{category.name_en}</span>
                  <span className={styles.categoryFigure}>
                    {t ? `${t.coverage_pct ?? 0}%` : '—'}
                  </span>
                  <span className={styles.categoryMeta}>
                    {t
                      ? `${count(t.stations, locale)} stations · ${count(t.accounts_opened, locale)} accounts · ${money(Number(t.deposits_tzs), locale, true)}`
                      : 'Nothing reported yet'}
                  </span>
                  <span className={styles.categoryMeta}>
                    {t
                      ? `${count(t.simbanking_activated, locale)} SimBanking · ${count(t.lipa_hapa_registered, locale)} Lipa Hapa · ${count(t.loans_count, locale)} loans`
                      : 'No channels recorded yet'}
                  </span>
                  <span className={styles.categoryNoun}>
                    counted in {category.member_noun_en}
                  </span>
                  <span className={styles.cardHint}>Click to open →</span>
                </Link>
              );
            })}
          </div>

          <FoldPanel
            title="Coverage, side by side"
            count={totals.length}
            note="Ranked against each other"
          >
            {totals.length === 0 ? (
              <PanelEmpty>No categories yet.</PanelEmpty>
            ) : (
              <BarTable
                caption="Coverage by category"
                unitLabel="Accounts"
                rows={totals.map((t) => ({
                  label: t.name_en,
                  value: t.accounts_opened,
                  secondary: t.portfolio > 0
                    ? `${t.coverage_pct ?? 0}% of ${count(t.portfolio, locale)} people`
                    : 'No portfolio reported',
                }))}
              />
            )}
          </FoldPanel>

          <FoldPanel
            title="Channels by category"
            count={totals.length}
            note="SimBanking, Lipa Hapa, cards and loans"
          >
            {totals.length === 0 ? (
              <PanelEmpty>No categories yet.</PanelEmpty>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col" className={styles.num}>Accounts</th>
                      <th scope="col" className={styles.num}>SimBanking</th>
                      <th scope="col" className={styles.num}>Cards</th>
                      <th scope="col" className={styles.num}>Lipa Hapa</th>
                      <th scope="col" className={styles.num}>Loans</th>
                      <th scope="col" className={styles.num}>Loan value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.map((t) => {
                      const share = (n: number) => t.accounts_opened > 0
                        ? `${Math.round((n / t.accounts_opened) * 1000) / 10}%`
                        : null;
                      return (
                        <tr key={t.category_id}>
                          <th scope="row">
                            <Link
                              href={`/${locale}/staff/categories/${t.slug}`}
                              className={styles.link}
                            >
                              {t.name_en}
                            </Link>
                            <span className={styles.sub}>click to open</span>
                          </th>
                          <td className={styles.num}>{count(t.accounts_opened, locale)}</td>
                          <td className={styles.num}>
                            {count(t.simbanking_activated, locale)}
                            {share(t.simbanking_activated)
                              ? <span className={styles.sub}>{share(t.simbanking_activated)} of accounts</span>
                              : null}
                          </td>
                          <td className={styles.num}>{count(t.cards_issued, locale)}</td>
                          <td className={styles.num}>
                            {count(t.lipa_hapa_registered, locale)}
                            {share(t.lipa_hapa_registered)
                              ? <span className={styles.sub}>{share(t.lipa_hapa_registered)} of accounts</span>
                              : null}
                          </td>
                          <td className={styles.num}>{count(t.loans_count, locale)}</td>
                          <td className={styles.num}>{money(Number(t.loans_value_tzs), locale, true)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </FoldPanel>

          {session.role === 'hq' ? (
            <Panel
              title="Add a category"
              description="A new kind of place to track. Stations are filed under it from the moment it exists, and its own loan types are added inside it."
            >
              <CategoryForm />
            </Panel>
          ) : null}
        </>
      )}
    </StaffShell>
  );
}
