import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { SiteFooter } from '@/components/SiteFooter';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { getServerClient } from '@/lib/supabase/server';
import type { OpportunityRow } from '@/lib/supabase/types';
import { localeParams, resolveLocale } from '@/lib/page';
import { getDictionary, isLocale } from '@/i18n';
import styles from './opportunities.module.css';

export function generateStaticParams() {
  return localeParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: `${t.pages.opportunities.title} — CRDB Konekt`,
    description: t.pages.opportunities.lead,
  };
}

/**
 * The opportunities board.
 *
 * Nothing publishes unverified — the database refuses to set published_at
 * without a named verifier — so this page is empty until real listings exist.
 * It says that plainly rather than padding itself out.
 */
export default async function OpportunitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  const supabase = await getServerClient();

  let listings: OpportunityRow[] = [];
  if (supabase) {
    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .not('published_at', 'is', null)
      .order('deadline_at', { ascending: true, nullsFirst: false })
      .limit(50);
    listings = (data as OpportunityRow[] | null) ?? [];
  }

  const filters = [
    t.opportunities.filterAge,
    t.opportunities.filterEducation,
    t.opportunities.filterRegion,
    t.opportunities.filterField,
  ];

  const df = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <AppShell locale={locale} t={t} active="opportunities">
      <PageHeader
        eyebrow={t.opportunities.eyebrow}
        accent="green"
        title={t.pages.opportunities.title}
        lead={t.pages.opportunities.lead}
      />

      <div className={`section ${styles.body}`}>
        <div className="shell">
          <h2 className={`t-micro ${styles.filtersLabel}`} id="opportunity-filters">
            {t.opportunities.filtersLabel}
          </h2>
          <ul className={styles.filters} aria-labelledby="opportunity-filters">
            {filters.map((f) => (
              <li key={f} className={styles.filter}>{f}</li>
            ))}
          </ul>

          {listings.length === 0 ? (
            <EmptyState
              title={t.opportunities.emptyTitle}
              body={t.opportunities.emptyBody}
            />
          ) : (
            <ul className={styles.grid}>
              {listings.map((o) => (
                <li key={o.id} className={`card ${styles.item}`}>
                  <span className={styles.kind}>{o.kind}</span>
                  <h3 className={`t-h3 ${styles.itemTitle}`}>
                    {locale === 'sw' ? o.title_sw : o.title_en}
                  </h3>
                  <p className={styles.org}>{o.organisation}</p>
                  {o.deadline_at ? (
                    <p className={styles.deadline}>
                      <span className="tri tri--place" aria-hidden="true" />
                      {df.format(new Date(o.deadline_at))}
                    </p>
                  ) : null}
                  {/* Source attribution is never optional, here or anywhere. */}
                  <p className={styles.source}>{o.source_name}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <SiteFooter locale={locale} t={t} />
    </AppShell>
  );
}
