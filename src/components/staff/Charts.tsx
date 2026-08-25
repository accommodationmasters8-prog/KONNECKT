import styles from './Charts.module.css';

/**
 * Console charts.
 *
 * Both of these are the data itself, styled — not a canvas painted beside it.
 * The bar chart *is* a table, with the bar drawn in the cell, so it reads to a
 * screen reader as rows of numbers and to everyone else as a chart; and the
 * donut carries its own legend with the real figures next to each slice. No
 * chart library ships: the whole file is under 2KB and renders on the server,
 * which matters more here than in most consoles because a zone manager on a
 * branch connection pays for every kilobyte twice.
 */

export interface Slice {
  label: string;
  value: number;
  tone: 'teal' | 'green' | 'gold' | 'pink' | 'slate';
}

export function BarTable({
  caption,
  unitLabel,
  rows,
}: {
  caption: string;
  /** Column header for the number, e.g. "Campuses". */
  unitLabel: string;
  rows: { label: string; value: number; secondary?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <table className={styles.barTable}>
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Zone</th>
          <th scope="col" className={styles.barCol}>{unitLabel}</th>
          <th scope="col" className={styles.numCol}>{unitLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">
              {row.label}
              {row.secondary ? <span className={styles.secondary}>{row.secondary}</span> : null}
            </th>
            <td className={styles.barCell}>
              {/* aria-hidden: the number in the next cell is the accessible
                  value, and a bar announced as well would read it twice. */}
              <span className={styles.barTrack} aria-hidden="true">
                <span
                  className={styles.barFill}
                  style={{ inlineSize: `${Math.round((row.value / max) * 100)}%` }}
                />
              </span>
            </td>
            <td className={styles.numCol}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * A donut. Drawn with one circle per slice and stroke-dasharray offsets, so
 * there is no path arithmetic and no arc-flag edge case at 50%.
 */
export function Donut({
  slices,
  total,
  totalLabel,
  title,
}: {
  slices: Slice[];
  total: number;
  totalLabel: string;
  title: string;
}) {
  const sum = slices.reduce((n, s) => n + s.value, 0) || 1;
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 160 160" className={styles.donut} role="img" aria-label={title}>
        <title>{title}</title>
        <circle cx="80" cy="80" r={R} className={styles.donutTrack} />
        {slices.map((slice) => {
          const length = (slice.value / sum) * C;
          const dash = `${length} ${C - length}`;
          const el = (
            <circle
              key={slice.label}
              cx="80"
              cy="80"
              r={R}
              className={`${styles.donutSlice} ${styles[slice.tone]}`}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return el;
        })}
        <text x="80" y="76" className={styles.donutValue} textAnchor="middle">
          {total}
        </text>
        <text x="80" y="94" className={styles.donutLabel} textAnchor="middle">
          {totalLabel}
        </text>
      </svg>

      <ul className={styles.legend}>
        {slices.map((slice) => (
          <li key={slice.label} className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles[slice.tone]}`} aria-hidden="true" />
            <span className={styles.legendLabel}>{slice.label}</span>
            <span className={styles.legendValue}>{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
