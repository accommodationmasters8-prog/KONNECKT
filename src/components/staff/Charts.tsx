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

export interface TrendPoint {
  label: string;
  value: number;
}

/**
 * A trend over months.
 *
 * One series, drawn as an area with its line on top, because the question this
 * chart answers is "is it going up" and a second series would make the reader
 * work out which line is which before they can answer it. Where two measures
 * matter, two charts side by side beat one chart with two axes — an axis
 * nobody notices is a lie waiting to happen.
 *
 * The path is built from the points directly: no scale library, no layout
 * pass, and it renders on the server so the shape is in the HTML rather than
 * appearing a beat after the page does.
 */
export function TrendChart({
  points,
  title,
  format,
  tone = 'teal',
}: {
  points: TrendPoint[];
  title: string;
  /** How a value reads in the tooltip and on the axis. */
  format: (value: number) => string;
  tone?: 'teal' | 'green' | 'gold' | 'pink';
}) {
  if (points.length < 2) {
    return (
      <p className={styles.trendEmpty}>
        {points.length === 0
          ? 'Nothing reported yet. The first month of reports draws this.'
          : 'One month reported. A trend needs a second one.'}
      </p>
    );
  }

  const W = 720;
  const H = 220;
  const PAD_X = 8;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 28;

  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = (W - PAD_X * 2) / (points.length - 1);
  const y = (value: number) =>
    PAD_TOP + (1 - value / max) * (H - PAD_TOP - PAD_BOTTOM);

  const coords = points.map((p, i) => [PAD_X + i * stepX, y(p.value)] as const);
  const line = coords.map(([x, yy], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${yy.toFixed(1)}`).join(' ');
  const area = `${line} L${(PAD_X + (points.length - 1) * stepX).toFixed(1)} ${H - PAD_BOTTOM} L${PAD_X} ${H - PAD_BOTTOM} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  const change = first.value > 0
    ? Math.round(((last.value - first.value) / first.value) * 1000) / 10
    : null;

  return (
    <figure className={`${styles.trend} ${styles[tone]}`}>
      <figcaption className={styles.trendHead}>
        <span className={styles.trendValue}>{format(last.value)}</span>
        <span className={styles.trendMeta}>
          {last.label}
          {change === null ? null : (
            <span className={change >= 0 ? styles.trendUp : styles.trendDown}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% since {first.label}
            </span>
          )}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.trendSvg}
        role="img"
        aria-label={`${title}. ${points.map((p) => `${p.label}: ${format(p.value)}`).join('. ')}`}
        preserveAspectRatio="none"
      >
        <title>{title}</title>
        {/* Three guides, unlabelled. The figure above carries the number; a
            gridline here is for judging shape, not for reading values off. */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0} x2={W}
            y1={PAD_TOP + f * (H - PAD_TOP - PAD_BOTTOM)}
            y2={PAD_TOP + f * (H - PAD_TOP - PAD_BOTTOM)}
            className={styles.trendGuide}
          />
        ))}
        <path d={area} className={styles.trendArea} />
        <path d={line} className={styles.trendLine} />
        {coords.map(([x, yy], i) => (
          <circle key={points[i].label} cx={x} cy={yy} r={i === coords.length - 1 ? 5 : 3}
            className={styles.trendDot} />
        ))}
      </svg>

      <ol className={styles.trendAxis}>
        {points.map((p, i) => (
          <li key={p.label} aria-hidden={i % Math.ceil(points.length / 6) === 0 ? undefined : 'true'}>
            {i % Math.ceil(points.length / 6) === 0 ? p.label : ''}
          </li>
        ))}
      </ol>
    </figure>
  );
}
