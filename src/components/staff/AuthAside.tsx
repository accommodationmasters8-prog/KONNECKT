import Link from 'next/link';
import { KonektLogo } from '@/components/KonektLogo';
import styles from '@/app/[locale]/staff/sign-in/sign-in.module.css';

/**
 * The brand half of the auth screens.
 *
 * Shared by sign-in and by redeeming a code, because those two screens are the
 * same door — one for people who already have keys and one for people holding
 * the letter that becomes a key. Two copies of this panel would have drifted
 * within a release.
 */
export function AuthAside({
  locale,
  title,
  body,
  points,
}: {
  locale: string;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <aside className={styles.aside}>
      <span className={styles.wash} aria-hidden="true" />

      <Link href={`/${locale}`} className={`${styles.brand} ${styles.a1}`}>
        <KonektLogo label="KONEKT Na CRDB" plate className={styles.logo} />
      </Link>

      <div className={`${styles.pitch} ${styles.a2}`}>
        <h2 className={styles.pitchTitle}>{title}</h2>
        <p className={styles.pitchBody}>{body}</p>

        <ul className={styles.points}>
          {points.map((point) => (
            <li key={point} className={styles.point}>
              <span className={styles.tick} aria-hidden="true">—</span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      <p className={`${styles.asideFoot} ${styles.a3}`}>
        Internal tool for CRDB Bank Plc, Tanzania. Access is issued by HQ.
      </p>
    </aside>
  );
}
