import type { Dictionary } from '@/i18n';
import styles from './OpportunitiesStrip.module.css';

/**
 * Opportunities — the shape of the board, with an honest empty state.
 *
 * No listings are invented here. The filters are shown inert so the client can
 * see the eligibility model, but there is nothing behind them yet and the copy
 * says so. Nothing publishes to this board unverified, in this phase or any
 * later one.
 */
export function OpportunitiesStrip({ t }: { t: Dictionary }) {
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
        <div className="reveal-head">
          <p className="t-eyebrow" style={{ color: 'var(--konekt-green-deep)' }}>
            {t.opportunities.eyebrow}
          </p>
          <h2 id="opportunities-title" className="t-h2">
            {t.opportunities.title}
          </h2>
          <p className={`t-lead t-muted ${styles.lead}`}>{t.opportunities.lead}</p>
        </div>

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
