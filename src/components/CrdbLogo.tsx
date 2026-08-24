import styles from './CrdbLogo.module.css';

/**
 * The CRDB Bank parent brand.
 *
 * IMPORTANT — this is not the CRDB logo.
 *
 * CRDB's logo is their registered trademark and this build has not been given
 * the artwork. Drawing an approximation of a bank's mark and shipping it as
 * the real thing is not a shortcut, it is a misuse of their identity, and a
 * compliance officer would stop the meeting over it.
 *
 * So this renders a typographic wordmark set in the brand's own display face,
 * which is honest about what it is. To ship the real mark:
 *
 *   1. drop the official SVG at  public/brand/crdb-logo.svg
 *   2. set  NEXT_PUBLIC_CRDB_LOGO=1
 *
 * Nothing else changes — the component swaps to an <img> at the same size and
 * with the same accessible name. Until then the wordmark is visibly a
 * stand-in, which is the state of it. See docs/OPEN-ITEMS.md.
 */
const hasOfficialArtwork = process.env.NEXT_PUBLIC_CRDB_LOGO === '1';

export function CrdbLogo({
  label,
  tone = 'onInk',
  className,
}: {
  /** Accessible name, e.g. "CRDB Bank Plc". */
  label: string;
  tone?: 'onInk' | 'onPaper';
  className?: string;
}) {
  if (hasOfficialArtwork) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a brand SVG at a
      // fixed size; next/image would add a request and a layout wrapper for no
      // benefit.
      <img
        src="/brand/crdb-logo.svg"
        alt={label}
        className={[styles.official, className].filter(Boolean).join(' ')}
        width={112}
        height={32}
      />
    );
  }

  return (
    <span
      className={[styles.wordmark, styles[tone], className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
    >
      <span className={styles.letters} aria-hidden="true">
        CRDB
      </span>
      <span className={styles.placeholderNote} aria-hidden="true">
        logo pending
      </span>
    </span>
  );
}
