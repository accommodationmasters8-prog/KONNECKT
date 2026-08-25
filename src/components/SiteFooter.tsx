import Link from 'next/link';
import { KonektLogo } from './KonektLogo';
import { localeNames, localeTags, locales, type Locale } from '@/i18n';
import type { Dictionary } from '@/i18n';
import styles from './SiteFooter.module.css';

/**
 * Footer. Bilingual, with the CRDB attribution stated plainly rather than
 * tucked into a colophon, and both legal routes present as real links.
 */
export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  const year = new Date().getFullYear();

  const explore = [
    { href: `/${locale}/events`, label: t.nav.events },
    { href: `/${locale}/map`, label: t.nav.map },
    { href: `/${locale}/membership`, label: t.nav.membership },
    { href: `/${locale}/opportunities`, label: t.nav.opportunities },
    { href: `/${locale}/blog`, label: t.nav.blog },
  ];

  const legal = [
    { href: `/${locale}/privacy`, label: t.footer.privacy },
    { href: `/${locale}/terms`, label: t.footer.terms },
    { href: `/${locale}/accessibility`, label: t.footer.accessibility },
  ];

  return (
    <footer className={`on-ink ${styles.footer} chev-edge-top`}>
      <div className={`shell ${styles.inner}`}>
        <div className={styles.brandBlock}>
          {/* Decorative here: the tagline underneath already says the
              brand, and a screen reader should not hear it twice. */}
          <KonektLogo label="" className={styles.logo} />
          <p className={styles.tagline}>
            let&rsquo;s <span className={styles.taglineMark}>KONEKT</span>
          </p>
          <p className={`t-caption ${styles.attribution}`}>
            {t.footer.attribution}
          </p>
          <p className={`t-micro ${styles.regulator}`}>{t.footer.regulator}</p>
        </div>

        <nav className={styles.columns} aria-label={t.footer.navLabel}>
          <div className={styles.column}>
            <h2 className={styles.columnTitle}>{t.footer.columnsExplore}</h2>
            <ul>
              {explore.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} prefetch={false} className={styles.link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.column}>
            <h2 className={styles.columnTitle}>{t.footer.columnsLegal}</h2>
            <ul>
              {legal.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} prefetch={false} className={styles.link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.column}>
            <h2 className={styles.columnTitle}>{t.nav.languageLabel}</h2>
            <ul>
              {locales.map((code) => (
                <li key={code}>
                  <Link
                    href={`/${code}`}
                    prefetch={false}
                    hrefLang={localeTags[code]}
                    lang={localeTags[code]}
                    className={styles.link}
                    aria-current={code === locale ? 'true' : undefined}
                  >
                    {localeNames[code]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>

      <div className={`shell ${styles.baseline}`}>
        <p className="t-micro">
          &copy; {year} CRDB Bank Plc. {t.footer.rights}
        </p>
        <p className="t-micro">{t.footer.builtBy}</p>
      </div>
    </footer>
  );
}
