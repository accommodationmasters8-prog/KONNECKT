import { KonektLogo } from './KonektLogo';
import type { Locale } from '@/i18n';
import type { Dictionary } from '@/i18n';
import styles from './SiteFooter.module.css';

/**
 * Footer.
 *
 * This is an internal tool, and the footer was built like a public site's —
 * three columns of links, an attribution, a regulator line, a colophon. None
 * of it is what somebody opening a KPI tracker needs. What is left is the mark
 * and who owns the thing.
 */
export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  void locale;
  void t;
  return (
    <footer className={`on-ink ${styles.footer}`}>
      <div className={`shell ${styles.inner}`}>
        {/* Decorative: the line underneath names the bank. */}
        <KonektLogo label="" plate className={styles.logo} />
        <p className="t-micro">&copy; {new Date().getFullYear()} CRDB Bank Plc</p>
      </div>
    </footer>
  );
}
