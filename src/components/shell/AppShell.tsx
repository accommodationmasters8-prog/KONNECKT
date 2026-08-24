import Link from 'next/link';
import type { ReactNode } from 'react';
import { KonektMark } from '../KonektMark';
import { CrdbLogo } from '../CrdbLogo';
import { localeNames, localeTags, type Locale } from '@/i18n';
import type { Dictionary } from '@/i18n';
import {
  EventsIcon, HomeIcon, MapIcon, MeIcon, MembershipIcon,
} from './NavIcons';
import styles from './AppShell.module.css';

export type NavKey = 'home' | 'events' | 'map' | 'membership' | 'me'
  | 'opportunities' | 'blog' | 'none';

/**
 * The application frame.
 *
 * Every page renders inside this — the landing page is one route among many,
 * not a special case with its own header. That is what makes the installed PWA
 * behave like an app: the chrome never changes, only what scrolls between the
 * bars.
 *
 * Both navs are plain links. No client component, no hydration, no bytes, and
 * they work with JavaScript disabled.
 */
export function AppShell({
  locale,
  t,
  active,
  children,
}: {
  locale: Locale;
  t: Dictionary;
  active: NavKey;
  children: ReactNode;
}) {
  const other: Locale = locale === 'en' ? 'sw' : 'en';
  const href = (path: string) => `/${locale}${path}`;

  const primary = [
    { key: 'events', href: href('/events'), label: t.nav.events },
    { key: 'map', href: href('/map'), label: t.nav.map },
    { key: 'membership', href: href('/membership'), label: t.nav.membership },
    { key: 'opportunities', href: href('/opportunities'), label: t.nav.opportunities },
    { key: 'blog', href: href('/blog'), label: t.nav.blog },
  ] as const;

  const tabs = [
    { key: 'home', href: href(''), label: t.nav.tabHome, Icon: HomeIcon },
    { key: 'events', href: href('/events'), label: t.nav.events, Icon: EventsIcon },
    { key: 'map', href: href('/map'), label: t.nav.map, Icon: MapIcon },
    { key: 'membership', href: href('/membership'), label: t.nav.membership, Icon: MembershipIcon },
    { key: 'me', href: href('/me'), label: t.nav.tabMe, Icon: MeIcon },
  ] as const;

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">{t.nav.skipToContent}</a>

      <header className={`${styles.topbar} on-ink`}>
        <div className={`shell ${styles.topbarInner}`}>
          {/* No aria-label here. An aria-label that does not contain the
              link's visible text breaks voice control: someone saying "click
              KONEKT" finds nothing, because the accessible name was something
              else entirely. The visible words name the link, and the
              destination is added for screen readers only. */}
          <Link href={href('')} className={styles.brand}>
            <KonektMark className={styles.brandMark} />
            <span className={styles.brandWord}>
              KON<span className={styles.brandWordAccent}>E</span>KT
            </span>
            <span className={styles.brandDivider} aria-hidden="true" />
            <span className={styles.brandParent}>{t.nav.byCrdb}</span>
            <span className="visually-hidden">{t.nav.brandHome}</span>
          </Link>

          <nav className={styles.desktopNav} aria-label={t.nav.primaryLabel}>
            {primary.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                prefetch={false}
                className={styles.desktopLink}
                aria-current={active === item.key ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.actions}>
            <Link
              href={`/${other}`}
              prefetch={false}
              className={styles.lang}
              hrefLang={localeTags[other]}
              lang={localeTags[other]}
            >
              {/* The visible abbreviation stays part of the accessible name,
                  so "click SW" works in voice control and a screen reader
                  still hears which language it switches to. */}
              <span>{other.toUpperCase()}</span>
              <span className="visually-hidden">
                {' '}— {localeNames[other]}. {t.nav.switchTo}
              </span>
            </Link>
            <Link href={href('/me')} prefetch={false} className={styles.signIn}>
              {t.nav.signIn}
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className={styles.main}>
        {children}
      </main>

      <nav className={`${styles.tabbar} on-ink`} aria-label={t.nav.tabbarLabel}>
        {tabs.map(({ key, href: to, label, Icon }) => (
          <Link
            key={key}
            href={to}
            prefetch={false}
            className={styles.tab}
            aria-current={active === key ? 'page' : undefined}
          >
            <span className={styles.tabMarker} aria-hidden="true" />
            <Icon className={styles.tabIcon} />
            <span className={styles.tabLabel}>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Re-exported so pages can render the parent brand without importing twice. */
export { CrdbLogo };
