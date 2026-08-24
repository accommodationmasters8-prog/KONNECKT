import Link from 'next/link';
import { KonektMark } from './KonektMark';
import { localeNames, localeTags, type Locale } from '@/i18n';
import type { Dictionary } from '@/i18n';
import styles from './SiteHeader.module.css';

/**
 * Header and language switch.
 *
 * The language switch is a plain anchor to the other locale's URL — no client
 * component, no hydration, no bytes. It works with JavaScript disabled and it
 * gives each language a real, shareable address.
 */
export function SiteHeader({ locale, t }: { locale: Locale; t: Dictionary }) {
  const other: Locale = locale === 'en' ? 'sw' : 'en';

  return (
    <header className={styles.header}>
      <div className={`shell ${styles.inner}`}>
        {/* prefetch is off on every Link in this build. Next prefetches the
            RSC payload of any Link in the viewport, which on this page meant
            ~40KB of the other locale and the legal pages competing with the
            hero for bandwidth on a 3G connection. Client-side navigation
            still works; it just waits until someone actually taps. */}
        <Link
          href={`/${locale}`}
          prefetch={false}
          className={styles.brand}
          aria-label={t.nav.brandHome}
        >
          <KonektMark className={styles.brandMark} />
          <span className={styles.brandWord}>
            KON<span className={styles.brandWordAccent}>E</span>KT
          </span>
        </Link>

        <nav className={styles.nav} aria-label={t.nav.primaryLabel}>
          <a href="#events" className={styles.navLink}>{t.nav.events}</a>
          <a href="#map" className={styles.navLink}>{t.nav.map}</a>
          <a href="#membership" className={styles.navLink}>{t.nav.membership}</a>
          <a href="#opportunities" className={styles.navLink}>{t.nav.opportunities}</a>
        </nav>

        <Link
          href={`/${other}`}
          prefetch={false}
          className={styles.lang}
          hrefLang={localeTags[other]}
          lang={localeTags[other]}
        >
          <span aria-hidden="true">{other.toUpperCase()}</span>
          <span className="visually-hidden">
            {t.nav.languageLabel}: {localeNames[other]} — {t.nav.switchTo}
          </span>
        </Link>
      </div>
    </header>
  );
}
