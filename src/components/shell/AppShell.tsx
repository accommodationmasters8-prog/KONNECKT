import Link from 'next/link';
import type { ReactNode } from 'react';
import { KonektLogo } from '../KonektLogo';
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

  // Two links and a way in. Everything this product actually does happens
  // behind the sign in, so a public nav listing five sections was five
  // promises the public site does not keep.
  const primary = [
    { key: 'map', href: href('/map'), label: t.nav.map },
  ] as const;

  const tabs = [
    { key: 'home', href: href(''), label: t.nav.tabHome, Icon: HomeIcon },
    { key: 'map', href: href('/map'), label: t.nav.map, Icon: MapIcon },
    { key: 'signin', href: href('/staff/sign-in'), label: t.nav.signIn, Icon: MeIcon },
  ] as const;

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">{t.nav.skipToContent}</a>

      <header className={`${styles.topbar} on-ink`}>
        <div className={`shell ${styles.topbarInner}`}>
          {/* The official logo is the link's visible content, so it carries
              the accessible name — the brand exactly as the artwork writes
              it, "KONEKT Na CRDB". An accessible name that does not contain
              what is on screen breaks voice control: someone saying "click
              KONEKT" has to find the thing they can see. The destination is
              added after it, for screen readers only.

              The lockup states the CRDB attribution itself, so the separate
              "by CRDB Bank" chip that used to sit here is gone with it. */}
          <Link href={href('')} className={styles.brand}>
            <KonektLogo label="KONEKT Na CRDB" className={styles.brandLogo} />
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
            <Link href={href('/staff/sign-in')} prefetch={false} className={styles.signIn}>
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
