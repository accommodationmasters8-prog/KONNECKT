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

/**
 * A series colour, named by the brand hue it comes from.
 *
 * The five categorical slots are `teal indigo pink gold green`, in that fixed
 * order. `slate` is not one of them — it is the neutral residual ("everyone
 * else", "not yet reached") and is only correct where the slice carries its
 * own label saying so.
 */
export type SeriesTone = 'teal' | 'indigo' | 'pink' | 'gold' | 'green' | 'slate';

export interface Slice {
  label: string;
  value: number;
  tone: SeriesTone;
}

export function BarTable({
  caption,
  unitLabel,
  rows,
  rowLabel = 'Name',
  format,
}: {
  caption: string;
  /** Column header for the number, e.g. "Accounts". */
  unitLabel: string;
  rows: { label: string; value: number; secondary?: string }[];
  /** What the first column is. It said "Zone" on every screen, including the
   *  ones ranking stations and categories. */
  rowLabel?: string;
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const show = format ?? ((v: number) => v.toLocaleString());

  return (
    <table className={styles.barTable}>
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{rowLabel}</th>
          <th scope="col" className={styles.barCol}>{unitLabel}</th>
          <th scope="col" className={styles.numCol}>{unitLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
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
                  className={`${styles.barFill} ${i === 0 ? styles.barFillLead : ''}`}
                  style={{ inlineSize: `${Math.max(1.5, (row.value / max) * 100).toFixed(1)}%` }}
                />
              </span>
            </td>
            <td className={styles.numCol}>{show(row.value)}</td>
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

/**
 * A pie, drawn as real wedges rather than a stroked ring.
 *
 * The donut above answers "how much of the whole is this one thing"; a pie
 * answers "how does the whole divide", which is the question a category screen
 * asks about its account types and its loan types. Different question, so a
 * different mark rather than the same ring relabelled.
 *
 * Wedges are paths, not dash offsets: a dashed ring cannot render a slice
 * under about two degrees without the stroke caps eating it, and a category
 * with one account type at 0.4% is exactly the case worth seeing.
 */
export function PieChart({
  title,
  slices,
  format,
  centreLabel,
}: {
  title: string;
  slices: Slice[];
  format?: (value: number) => string;
  /** What the number in the hole is. Defaults to "total". */
  centreLabel?: string;
}) {
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  if (total <= 0) {
    return <p className={styles.trendEmpty}>Nothing reported to divide up yet.</p>;
  }

  const show = format ?? ((v: number) => v.toLocaleString());

  // A ring, not a disc. The hole carries the total, which is the number
  // everybody reads first and which a pie makes you sum the legend to find.
  const C = 100;
  const R_OUT = 92;
  const R_IN = 58;
  const GAP = 0.022; // radians trimmed from each end — the 2px surface gap

  const live = slices.filter((s) => s.value > 0);
  let angle = -Math.PI / 2; // twelve o'clock

  const wedges = live.map((slice) => {
    const share = slice.value / total;
    const sweep = share * Math.PI * 2;

    // Trim both ends so neighbouring wedges never touch. A slice smaller than
    // the gap itself would invert, so the trim shrinks with the slice.
    const trim = Math.min(GAP, sweep / 3);
    const a0 = angle + trim;
    const a1 = angle + sweep - trim;
    const mid = angle + sweep / 2;
    angle += sweep;

    const pt = (r: number, a: number) =>
      `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;

    const d =
      `M ${pt(R_OUT, a0)} ` +
      `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${pt(R_OUT, a1)} ` +
      `L ${pt(R_IN, a1)} ` +
      `A ${R_IN} ${R_IN} 0 ${large} 0 ${pt(R_IN, a0)} Z`;

    // Direct labels only where the wedge can hold one. A number on every
    // slice turns the ring into a scatter of digits, and the legend below
    // already carries every figure.
    const labelR = (R_OUT + R_IN) / 2;
    return {
      slice,
      d,
      share,
      showLabel: share >= 0.08,
      lx: C + labelR * Math.cos(mid),
      ly: C + labelR * Math.sin(mid),
    };
  });

  return (
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 200 200" className={styles.pie} role="img" aria-label={title}>
        <title>{title}</title>

        {wedges.map((w) => (
          <path
            key={w.slice.label}
            d={w.d}
            className={`${styles.pieWedge} ${styles[w.slice.tone]}`}
          />
        ))}

        {wedges.map((w) =>
          w.showLabel ? (
            <text
              key={`${w.slice.label}-pct`}
              x={w.lx}
              y={w.ly + 4}
              className={styles.wedgeLabel}
              textAnchor="middle"
            >
              {Math.round(w.share * 100)}%
            </text>
          ) : null,
        )}

        <text x={C} y={C - 2} className={styles.holeValue} textAnchor="middle">
          {show(total)}
        </text>
        <text x={C} y={C + 18} className={styles.holeLabel} textAnchor="middle">
          {centreLabel ?? 'total'}
        </text>
      </svg>

      <ul className={styles.legend}>
        {slices.map((slice) => (
          <li key={slice.label} className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles[slice.tone]}`} aria-hidden="true" />
            <span className={styles.legendLabel}>{slice.label}</span>
            <span className={styles.legendValue}>
              {show(slice.value)}
              <span className={styles.legendShare}>
                {` · ${Math.round((slice.value / total) * 1000) / 10}%`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Vertical bars over a run of periods.
 *
 * BarTable above compares named things, where the label needs room to be read.
 * This compares one thing across time, where the shape of the run is the point.
 *
 * It was a row of floating blocks with a number over each: no baseline, no
 * scale, nothing to read a height against, which is what made it look drawn
 * rather than measured. Now it has a zero line the bars sit on, two recessive
 * gridlines, the scale stated once at the top, and values only on the bars
 * worth calling out — the tallest and the newest. A number over every bar is
 * a table pretending to be a chart.
 */
export function BarChart({
  title,
  points,
  format,
  tone = 'teal',
}: {
  title: string;
  points: { label: string; value: number }[];
  format?: (value: number) => string;
  tone?: 'teal' | 'green' | 'gold' | 'pink' | 'indigo';
}) {
  if (points.length === 0) {
    return <p className={styles.trendEmpty}>Nothing reported yet.</p>;
  }

  const show = format ?? ((v: number) => v.toLocaleString());
  const peak = Math.max(1, ...points.map((p) => p.value));

  // A round ceiling above the tallest bar, so the top gridline is a number a
  // person would say out loud rather than whatever the maximum happened to be.
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const ceiling = Math.ceil(peak / (magnitude / 2)) * (magnitude / 2) || 1;

  const peakAt = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const lastAt = points.length - 1;

  return (
    <figure className={styles.bars} aria-label={title}>
      <div className={styles.barPlot}>
        {/* Recessive: the gridlines exist to read a height against, not to be
            looked at. Each carries its own number, on the line it belongs to —
            a scale printed in a row above the plot names two values and
            attaches neither of them to anything. */}
        <span className={styles.gridline} style={{ insetBlockStart: '0%' }} aria-hidden="true">
          <span className={styles.gridValue}>{show(ceiling)}</span>
        </span>
        <span className={styles.gridline} style={{ insetBlockStart: '50%' }} aria-hidden="true">
          <span className={styles.gridValue}>{show(ceiling / 2)}</span>
        </span>

        <div className={styles.barRow}>
          {points.map((point, i) => (
            <div key={point.label} className={styles.barItem}>
              {i === peakAt || i === lastAt ? (
                <span
                  className={[
                    styles.barValue,
                    // An edge bar's label is anchored to that edge instead of
                    // centred, or half of it renders outside the plot.
                    i === 0 ? styles.barValueStart : '',
                    i === lastAt ? styles.barValueEnd : '',
                  ].filter(Boolean).join(' ')}
                  style={{ insetBlockEnd: `calc(${((point.value / ceiling) * 100).toFixed(1)}% + 6px)` }}
                >
                  {show(point.value)}
                </span>
              ) : null}
              <div
                className={`${styles.barColumn} ${styles[tone]} ${i === lastAt ? styles.barColumnNow : ''}`}
                /* Floored at 2% so a near-zero period is still a visible mark
                   rather than a gap that reads as missing data. */
                style={{ blockSize: `${Math.max(2, (point.value / ceiling) * 100).toFixed(1)}%` }}
              />
            </div>
          ))}
        </div>

        <span className={styles.baseline} aria-hidden="true" />
      </div>

      <div className={styles.barRow}>
        {points.map((point) => (
          <span key={point.label} className={styles.barLabel}>{point.label}</span>
        ))}
      </div>
    </figure>
  );
}
