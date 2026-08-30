import Link from 'next/link';
import styles from './FilingBar.module.css';

export interface DueStation {
  id: string;
  name: string;
  lastReport: string | null;
}

/**
 * What still needs filing, above everything else.
 *
 * The overview used to open with four totals. Totals are what a branch reads
 * once a month; filing is what a branch does once a month, and the screen was
 * ordered the wrong way round — the job came fourth, after three charts
 * summarising a job that had not been done.
 *
 * So this sits above the metrics for anyone who files, and names the stations
 * rather than counting them. "6 stations await a report" is a status; six
 * links each landing on the form is the work.
 *
 * HQ sees it too, because HQ chasing a number is HQ chasing the wrong thing:
 * the useful question is always which station, at which branch.
 */
export function FilingBar({
  locale,
  due,
  period,
  total,
}: {
  locale: string;
  due: DueStation[];
  period: string;
  total: number;
}) {
  if (total === 0) return null;

  const done = total - due.length;

  if (due.length === 0) {
    return (
      <div className={styles.barDone}>
        <span className={styles.tick} aria-hidden="true">✓</span>
        <span>
          All {total} stations have reported {period}. Nothing is outstanding.
        </span>
      </div>
    );
  }

  return (
    <section className={styles.bar} aria-labelledby="filing-title">
      <div className={styles.head}>
        <h2 id="filing-title" className={styles.title}>
          {due.length} of {total} still to report {period}
        </h2>
        <span className={styles.progress}>
          {done} in
          <span className={styles.track} aria-hidden="true">
            <span
              className={styles.fill}
              style={{ inlineSize: `${Math.round((done / total) * 100)}%` }}
            />
          </span>
        </span>
      </div>

      <ul className={styles.list}>
        {due.slice(0, 8).map((station) => (
          <li key={station.id}>
            <Link href={`/${locale}/staff/stations/${station.id}`} className={styles.chip}>
              {station.name}
              <span className={styles.chipMeta}>
                {station.lastReport ? `last ${station.lastReport}` : 'never filed'}
              </span>
            </Link>
          </li>
        ))}
        {due.length > 8 ? (
          <li>
            <Link href={`/${locale}/staff/stations`} className={styles.chipMore}>
              and {due.length - 8} more →
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
