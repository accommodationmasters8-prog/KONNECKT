import Link from 'next/link';
import { AppShell } from './shell/AppShell';
import { SiteFooter } from './SiteFooter';
import { getDictionary, type Locale } from '@/i18n';
import styles from './StubPage.module.css';

/**
 * Placeholder for a legal or policy page.
 *
 * These routes exist and resolve in both locales because a footer that links
 * to a 404 for "Privacy policy" is worse than one that says the text is with
 * Legal. Every word here has to be approved by CRDB Legal in both languages
 * before it can be written — see docs/OPEN-ITEMS.md.
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
    <AppShell locale={locale} t={t} active="none">
      <div className={`section ${styles.main}`}>
        <div className="shell">
          <h1 className="t-h1">{title[locale]}</h1>
          <p className={`t-lead t-muted ${styles.body}`}>{body[locale]}</p>
          <Link href={`/${locale}`} prefetch={false} className="btn btn--quiet">
            {locale === 'sw' ? 'Rudi mwanzo' : 'Back to the homepage'}
          </Link>
        </div>
      </div>
      <SiteFooter locale={locale} t={t} />
    </AppShell>
  );
}
