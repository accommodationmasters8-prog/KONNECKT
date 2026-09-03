import styles from './KonektLogo.module.css';

/**
 * The official KONEKT logo, as supplied.
 *
 * The lockup is: the chevron mark (the K, drawn as an arrow, with the gold
 * and red triangles), then O N E in green and K T in teal under a single teal
 * bar that runs from the T's arm back across the word, then "Na CRDB" in
 * green beneath the tail of it.
 *
 * It is drawn as outlines rather than set in a typeface. The artwork's face is
 * Gotham, which CRDB has not licensed for the web — setting the wordmark in
 * whatever face happened to load would put a lookalike on every screen and
 * shift the moment the font swapped. Outlines are the artwork itself: no font
 * request, no swap, no layout shift, identical at 24px in the nav bar and at
 * 512px on a banner, and about 1.4KB inline.
 *
 * Colours resolve through the brand tokens, which were sampled from this same
 * artwork, so the mark and the interface can never drift apart.
 *
 * `scripts/generate-icons.mjs` asserts this geometry against its own copy on
 * every build, and emits the static file at public/brand/konekt-logo.svg for
 * the contexts that cannot take a component — Open Graph, email, print.
 */

/* --- Wordmark geometry, on the artwork's own 600x300 grid ---------------
   Cap height 124 (y 80 to 204), stem 28. The bar at y 52-80 is the T's arm
   carried left over the whole word — the one place the lockup is not simply
   letters in a row, and the thing that makes it read as a logo rather than a
   word. Every letter is a closed outline; the O is two rings wound in the
   same direction and filled even-odd, so its counter stays a hole.
   --------------------------------------------------------------------- */
export const LOGO_O =
  'M212 80 a54 62 0 1 0 0.01 0 Z M212 108 a26 34 0 1 1 -0.01 0 Z';
export const LOGO_N =
  'M276 204 L276 80 L304 80 L322 132 L322 80 L350 80 L350 204 L322 204 L304 152 L304 204 Z';
export const LOGO_E =
  'M360 80 L424 80 L424 108 L388 108 L388 128 L416 128 L416 156 L388 156 L388 176 L424 176 L424 204 L360 204 Z';
export const LOGO_K =
  'M434 80 L462 80 L462 128 L494 80 L508 80 L508 96 L480 138 L508 186 L508 204 L494 204 L462 156 L462 204 L434 204 Z';
export const LOGO_T =
  'M200 52 L590 52 L590 80 L566 80 L566 204 L538 204 L538 80 L200 80 Z';

/* --- The mark, at lockup scale ------------------------------------------
   The chevron's arms run at 41 degrees from horizontal — 113 of rise for
   130 of run, measured off the supplied artwork. That is the logo's own
   angle and it is not the 58 degrees the interface cuts its section edges
   on; see docs/OPEN-ITEMS.md 2.2. The artwork wins here.
   --------------------------------------------------------------------- */
export const LOGO_TRI_UP = 'M26 44 L96 76 L26 108 Z';
export const LOGO_TRI_DOWN = 'M26 192 L96 224 L26 256 Z';
export const LOGO_CHEVRON = 'M150 37 L20 150 L150 263 L150 205 L78 150 L150 95 Z';

/**
 * The official artwork.
 *
 * `public/brand/konekt-official.svg` is the mark, and every logo in the product
 * renders through this one component: the nav, both auth screens, the console
 * rail, the footer, the printed reports and the empty states. Replacing that
 * one file replaces all of them — no code change, no second copy to keep in
 * step.
 *
 * The fallback below it is the older reconstruction, kept only so the component
 * still draws something if the file is ever missing.
 */
const OFFICIAL_ARTWORK: string | null = '/brand/konekt-official.svg';

/* The same mark without the "Na CRDB" line. In the console rail the lockup is
   about 110px wide, and at that size the parent line is four pixels tall and
   reads as a smudge — worse than absent. Tight chrome gets this one. */
const OFFICIAL_ARTWORK_COMPACT = '/brand/konekt-official-compact.svg';

export function KonektLogo({
  /**
   * Accessible name. Defaults to the brand as it is written in the artwork.
   * Pass an empty string for an instance that is decorative because the name
   * is already in the text beside it.
   */
  label = 'KONEKT Na CRDB',
  /** Sit the mark on a white plate. For dark surfaces only — see below. */
  plate = false,
  /** Drop "Na CRDB" and crop to the wordmark. For tight chrome only. */
  parent = true,
  animate = false,
  className,
}: {
  label?: string;
  plate?: boolean;
  parent?: boolean;
  animate?: boolean;
  className?: string;
}) {
  const decorative = label === '';

  if (OFFICIAL_ARTWORK) {
    /* The artwork is drawn for paper: the wordmark is CRDB green and the mark
       a green-teal, and on the ink surfaces — the sign-in panel, the footer —
       green on dark green is close to invisible. Recolouring somebody's logo
       to suit a background is not ours to do, so the background gives instead
       and the mark sits on a white plate, which is how it appears on CRDB's
       own dark collateral. */
    // Deliberately a plain <img>, not next/image: the mark appears on every
    // screen at a dozen sizes, and the optimiser would fetch a dozen variants
    // of a file that is already a few kilobytes.
    // eslint-disable-next-line @next/next/no-img-element
    const mark = (
      <img
        src={parent ? OFFICIAL_ARTWORK : OFFICIAL_ARTWORK_COMPACT}
        alt={decorative ? '' : label}
        aria-hidden={decorative ? true : undefined}
        className={plate ? styles.plateImage : className}
        draggable={false}
      />
    );

    return plate ? <span className={`${styles.plate} ${className ?? ''}`}>{mark}</span> : mark;
  }

  return (
    <svg
      // Cropping the viewBox rather than hiding the line keeps the wordmark
      // at the same scale in both forms, so the logo does not appear to grow
      // when the parent line is dropped.
      viewBox={parent ? '0 0 600 300' : '0 0 600 232'}
      className={[styles.logo, animate ? styles.animate : '', className]
        .filter(Boolean)
        .join(' ')}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      focusable="false"
    >
      {decorative ? null : <title>{label}</title>}

      <g className={styles.mark}>
        <path className={styles.triUp} d={LOGO_TRI_UP} fill="var(--konekt-yellow)" />
        <path className={styles.triDown} d={LOGO_TRI_DOWN} fill="var(--konekt-pink)" />
        <path className={styles.chevron} d={LOGO_CHEVRON} fill="var(--konekt-teal)" />
      </g>

      <g className={styles.word}>
        <path d={LOGO_O} fill="var(--konekt-green)" fillRule="evenodd" />
        <path d={LOGO_N} fill="var(--konekt-green)" />
        <path d={LOGO_E} fill="var(--konekt-green)" />
        <path d={LOGO_K} fill="var(--konekt-teal)" />
        <path d={LOGO_T} fill="var(--konekt-teal)" />
      </g>

      {parent ? (
        // The one piece of the lockup that is type rather than outline. It is
        // set in the display face at the artwork's own size and position; at
        // logo scale the difference between Gotham and Archivo here is a few
        // hundredths of a millimetre of stroke, and keeping it as text means
        // it stays selectable and searchable.
        <text
          className={styles.parent}
          x="590"
          y="262"
          textAnchor="end"
          fontSize="54"
          fill="var(--konekt-green)"
        >
          Na CRDB
        </text>
      ) : null}
    </svg>
  );
}
