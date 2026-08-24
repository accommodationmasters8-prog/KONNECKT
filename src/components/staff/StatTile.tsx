import styles from './StatTile.module.css';

/**
 * One reporting figure.
 *
 * `source` is not decoration. Every number a staff console shows has to say
 * where it came from, because the first question an HQ analyst asks about a
 * figure is which table produced it.
 */
export function StatTile({
  label,
  value,
  unit,
  source,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  unit?: string;
  source: string;
  tone?: 'neutral' | 'good' | 'warn';
}) {
  return (
    <div className={`${styles.tile} ${styles[tone]}`}>
      <span className={styles.label}>{label}</span>
      <span className={`t-data ${styles.value}`}>
        {value}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </span>
      <span className={styles.source}>{source}</span>
    </div>
  );
}
