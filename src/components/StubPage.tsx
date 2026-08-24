import Link from 'next/link';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { getDictionary, type Locale } from '@/i18n';
import styles from './StubPage.module.css';

/**
 * Placeholder for a legal or policy page.
 *
 * These routes exist and resolve in both locales because a footer that links
 * to a 404 for "Privacy policy" is worse than one that says the text is with
 * legal. The wording of every one of these has to be approved by CRDB Legal in
 * both languages before it can be written — see docs/OPEN-ITEMS.md.
 */
export function StubPage({
  locale,
  title,
  body,
}: {
  locale: Locale;
  title: Record<Locale, string>;
  body: Record<Locale, string>;
}) {
  const t = getDictionary(locale);

  return (
    <>
      <a href="#main" className="skip-link">{t.nav.skipToContent}</a>
      <SiteHeader locale={locale} t={t} />
      <main id="main" className={`section ${styles.main}`}>
        <div className="shell">
          <h1 className="t-h1">{title[locale]}</h1>
          <p className={`t-lead t-muted ${styles.body}`}>{body[locale]}</p>
          <Link href={`/${locale}`} prefetch={false} className="btn btn--quiet">
            {locale === 'sw' ? 'Rudi mwanzo' : 'Back to the homepage'}
          </Link>
        </div>
      </main>
      <SiteFooter locale={locale} t={t} />
    </>
  );
}
