import styles from './KonektMark.module.css';

/**
 * The Konekt mark.
 *
 * A teal arrow with a yellow triangle above and a pink triangle below.
 * Every edge in it runs at the brand's single angle: 42 units of rise for
 * every 26.25 across, which is tan(58deg) exactly. Nothing else on the site
 * introduces a second angle.
 *
 * Pure SVG geometry, ~1KB inline. The assembly runs on three CSS keyframe
 * groups — no animation library, no runtime cost, and it disappears entirely
 * under prefers-reduced-motion.
 */
export function KonektMark({
  title,
  animate = false,
  className,
}: {
  /** Accessible name. Omit entirely for a decorative instance. */
  title?: string;
  animate?: boolean;
  className?: string;
}) {
  const decorative = !title;
  return (
    <svg
      viewBox="0 0 120 120"
      className={[styles.mark, animate ? styles.animate : '', className]
        .filter(Boolean)
        .join(' ')}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}

      {/* Upper triangle — yellow. Slopes 20 across, 32 up: 58deg. */}
      <path
        className={styles.triUp}
        d="M38 14 L58 46 L18 46 Z"
        fill="var(--konekt-yellow)"
      />

      {/* Lower triangle — pink, the upper one mirrored through the waist. */}
      <path
        className={styles.triDown}
        d="M38 106 L18 74 L58 74 Z"
        fill="var(--konekt-pink)"
      />

      {/* The arrow. Drawn as a filled polygon rather than a stroked path so
          the 58deg holds exactly at every rendered size. */}
      <path
        className={styles.arrow}
        d="M79.75 18 L106 60 L79.75 102 L55.75 102 L82 60 L55.75 18 Z"
        fill="var(--konekt-teal)"
      />
    </svg>
  );
}
