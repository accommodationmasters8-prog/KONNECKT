import Link from 'next/link';
import styles from './FilingBar.module.css';

export interface DueStation {
  id: string;
  name: string;
  lastReport: string | null;
}

/**
 * What still needs filing.
 *
 * This used to name every outstanding station. That was right at ninety
 * institutions and wrong at sixteen thousand: the list was the slowest thing
 * on the page and nobody read past the first line. One figure, one link.
 */
export function FilingBar({
  locale,
  dueCount,
  period,
  total,
}: {
  locale: string;
  dueCount: number;
  period: string;
  total: number;
}) {
  if (total === 0) return null;

  const done = total - dueCount;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (dueCount === 0) {
    return (
      <div className={styles.barDone}>
        <span className={styles.tick} aria-hidden="true">✓</span>
        <span>All {total.toLocaleString()} reported · {period}</span>
      </div>
    );
  }

  return (
    <Link href={`/${locale}/staff/stations?due=1`} className={styles.bar}>
      <span className={styles.count}>{dueCount.toLocaleString()}</span>
      <span className={styles.label}>to report · {period}</span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ inlineSize: `${pct}%` }} />
      </span>
      <span className={styles.pct}>{pct}%</span>
      <span className={styles.go} aria-hidden="true">→</span>
    </Link>
  );
}
