import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './MetricCard.module.css';

export type MetricTone = 'teal' | 'green' | 'gold' | 'pink' | 'ink';

/**
 * A headline figure.
 *
 * The gradient is a two-stop ramp inside one hue, and the card's flat
 * background-color is set to the *lighter* stop — the worst case for the text
 * on it. That is deliberate: `npm run check:contrast` reads background-color,
 * so it audits the hardest part of the ramp rather than an average, and a
 * renderer that drops the gradient still shows a card that passes AA.
 *
 * `source` is not decoration. Every number a console shows has to say where it
 * came from, because the first question an analyst asks about a figure is
 * which table produced it. A figure with no live table behind it says so in
 * `note` instead of quietly showing a zero as though it were measured.
 *
 * Given an `href` the whole card becomes one link, with a visible cue rather
 * than a hover state — the second question after "what is this number" is
 * always "show me what is behind it", and on a touchscreen nobody discovers a
 * hover.
 */
export function MetricCard({
  label,
  value,
  unit,
  source,
  note,
  tone = 'teal',
  icon,
  href,
  hint = 'Open',
}: {
  label: string;
  value: string;
  unit?: string;
  source?: string;
  note?: string;
  tone?: MetricTone;
  icon?: ReactNode;
  /** Makes the whole card a link to the screen behind the figure. */
  href?: string;
  hint?: string;
}) {
  const body = (
    <>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
      </div>

      <p className={`t-data ${styles.value}`}>
        {value}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </p>

      {note ? <p className={styles.note}>{note}</p> : null}
      {source ? <p className={styles.source}>{source}</p> : null}
      {href ? <span className={styles.hint}>{hint} &rarr;</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${styles.card} ${styles.cardLink} ${styles[tone]}`}>
        {body}
      </Link>
    );
  }

  return <article className={`${styles.card} ${styles[tone]}`}>{body}</article>;
}
