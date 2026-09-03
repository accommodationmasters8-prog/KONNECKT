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
  const show = format ?? ((v: number) => v.toLocaleString());
  const peak = Math.max(1, ...rows.map((r) => r.value));

  // A round ceiling above the tallest bar, so the axis ticks are numbers a
  // person would say out loud rather than whatever the maximum happened to be.
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const ceiling = Math.ceil(peak / (magnitude / 2)) * (magnitude / 2) || 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * ceiling);

  return (
    <div className={styles.hbars}>
      <table className={styles.barTable}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{rowLabel}</th>
            <th scope="col" className={styles.barCol}>{unitLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className={styles.barLabelCell}>
                <span className={styles.barName}>{row.label}</span>
                {row.secondary ? (
                  <span className={styles.secondary}>{row.secondary}</span>
                ) : null}
              </th>
              <td className={styles.barCell}>
                {/* The gridlines sit behind every bar rather than under the
                    plot as a whole, which is what keeps them aligned when a
                    label wraps and changes the row's height. */}
                <span className={styles.barTrack}>
                  {ticks.slice(1, -1).map((t) => (
                    <span
                      key={t}
                      className={styles.hgrid}
                      style={{ insetInlineStart: `${(t / ceiling) * 100}%` }}
                      aria-hidden="true"
                    />
                  ))}
                  <span
                    className={styles.barFill}
                    style={{ inlineSize: `${Math.max(1.5, (row.value / ceiling) * 100).toFixed(1)}%` }}
                    aria-hidden="true"
                  />
                  {/* Always beside the bar, never inside it. A long bar used to
                      carry its own number in white, and white on the series
                      teal measures 4.16:1 — under AA, and there is no ink that
                      passes on that hue either. The track is sized to leave
                      room instead, so the number is always on a plain ground. */}
                  <span className={styles.barValue}>{show(row.value)}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* The scale, once, under the plot — not a number on every bar. */}
      <div className={styles.axis} aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className={styles.tick}>{show(t)}</span>
        ))}
      </div>
    </div>
  );
}

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
  const R_OUT = 94;
  const R_IN = 56;
  const GAP = 0.03; // radians trimmed from each end — the surface gap

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
    angle += sweep;

    const pt = (r: number, a: number) =>
      `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;

    const d =
      `M ${pt(R_OUT, a0)} ` +
      `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${pt(R_OUT, a1)} ` +
      `L ${pt(R_IN, a1)} ` +
      `A ${R_IN} ${R_IN} 0 ${large} 0 ${pt(R_IN, a0)} Z`;

    return { slice, d, share };
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

        {/* Drawn after the wedges so their stroke cannot bleed across it. */}
        <circle cx={C} cy={C} r={R_IN - 3} className={styles.pieHole} />

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
                    styles.colValue,
                    // An edge bar's label is anchored to that edge instead of
                    // centred, or half of it renders outside the plot.
                    i === 0 ? styles.colValueStart : '',
                    i === lastAt ? styles.colValueEnd : '',
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

      <div className={`${styles.barRow} ${styles.barLabels}`}>
        {points.map((point) => (
          <span key={point.label} className={styles.barLabel}>{point.label}</span>
        ))}
      </div>
    </figure>
  );
}
