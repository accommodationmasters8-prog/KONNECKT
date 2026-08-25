import styles from './KonektMark.module.css';

/**
 * The Konekt mark, taken from the official logo artwork.
 *
 * A teal chevron opening to the right from a point on the left — the K of
 * KONEKT, drawn as an arrow — with the gold triangle above it and the red
 * one below, both pointing into the chevron's arms. Orientation, colour and
 * proportion all come from the supplied artwork; nothing here is invented.
 *
 * This is the mark alone, for square contexts: app icons, the empty state,
 * the 404. Anywhere the brand is named rather than iconified, use
 * `<KonektLogo>` — the full lockup, with the wordmark and "Na CRDB".
 *
 * Pure SVG geometry, ~1KB inline. The assembly runs on three CSS keyframe
 * groups — no animation library, no runtime cost, and it disappears entirely
 * under prefers-reduced-motion.
 *
 * `scripts/generate-icons.mjs` asserts these three paths against its own copy
 * on every icon build, so the favicon can never drift from the component.
 */

/** Gold triangle, upper left, pointing into the chevron's top arm. */
export const MARK_TRI_UP = 'M33 12 L65 26 L33 40 Z';

/** Red triangle, lower left. The gold one mirrored through the waist. */
export const MARK_TRI_DOWN = 'M33 108 L65 94 L33 80 Z';

/**
 * The chevron. Drawn as a filled polygon rather than a stroked path so the
 * arms hold their angle exactly at every rendered size — a stroke rounds its
 * join at small sizes and the point goes soft.
 */
export const MARK_CHEVRON = 'M90 8 L30 60 L90 112 L90 85 L57 60 L90 35 Z';

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

      <path
        className={styles.triUp}
        d={MARK_TRI_UP}
        fill="var(--konekt-yellow)"
      />

      <path
        className={styles.triDown}
        d={MARK_TRI_DOWN}
        fill="var(--konekt-pink)"
      />

      <path
        className={styles.arrow}
        d={MARK_CHEVRON}
        fill="var(--konekt-teal)"
      />
    </svg>
  );
}
