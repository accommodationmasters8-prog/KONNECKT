import { SectionHead } from './SectionHead';
import type { Dictionary, Locale } from '@/i18n';
import styles from './OpportunitiesStrip.module.css';

/**
 * Opportunities — the shape of the board, with an honest empty state.
 *
 * No listings are invented here. The filters are shown inert so the client can
 * see the eligibility model, but there is nothing behind them yet and the copy
 * says so. Nothing publishes to this board unverified, in this phase or any
 * later one.
 */
export function OpportunitiesStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const filters = [
    t.opportunities.filterAge,
    t.opportunities.filterEducation,
    t.opportunities.filterRegion,
    t.opportunities.filterField,
  ];

  return (
    <section
      id="opportunities"
      className={`section chev-edge-top ${styles.section}`}
      aria-labelledby="opportunities-title"
    >
      <div className="shell">
        <SectionHead
          id="opportunities-title"
          eyebrow={t.opportunities.eyebrow}
          accent="green"
          title={t.opportunities.title}
          lead={t.opportunities.lead}
          action={{ href: `/${locale}/opportunities`, label: t.common.seeAll }}
        />

        <div className={styles.board}>
          {/* These are shown so the eligibility model is legible, and they are
              inert until the first verified listing lands. They are not
              aria-hidden: a sighted visitor learns what the board will filter
              on, and so should everyone else. The label says plainly that
              nothing is wired up yet. */}
          <h3 className={`t-micro ${styles.filtersLabel}`} id="opportunity-filters">
            {t.opportunities.filtersLabel}
          </h3>
          <ul className={styles.filters} aria-labelledby="opportunity-filters">
            {filters.map((filter) => (
              <li key={filter} className={styles.filter}>
                {filter}
              </li>
            ))}
          </ul>

          <div className={styles.empty}>
            <h3 className={`t-h3 ${styles.emptyTitle}`}>
              {t.opportunities.emptyTitle}
            </h3>
            <p className={`t-caption ${styles.emptyBody}`}>
              {t.opportunities.emptyBody}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
