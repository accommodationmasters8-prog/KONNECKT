import Link from 'next/link';
import type { ReactNode } from 'react';
import { KonektMark } from '../KonektMark';
import type { Locale } from '@/i18n';
import type { StaffRole } from '@/lib/supabase/types';
import styles from './StaffShell.module.css';

export type StaffSection =
  | 'overview' | 'events' | 'checkin' | 'accounts'
  | 'verification' | 'sponsorship' | 'members' | 'audit';

export interface StaffNavItem {
  key: StaffSection;
  href: string;
  label: string;
  /** Roles that may see this panel at all. */
  roles: StaffRole[];
}

/**
 * The staff console frame.
 *
 * Desktop-first, unlike everything else here — a zone manager reconciling
 * accounts is at a desk. The one exception is check-in, which is built for a
 * phone at a venue with the WiFi off.
 *
 * Navigation is filtered by role, but that filtering is a convenience, not a
 * security boundary. Every panel's data is fetched under the signed-in user's
 * own session and every table is protected by the policies in migration 0006,
 * so hiding a link and enforcing access are two separate things — as they must
 * be, because a hidden link is still a reachable URL.
 */
export function StaffShell({
  locale,
  role,
  active,
  nav,
  title,
  scopeLabel,
  children,
}: {
  locale: Locale;
  role: StaffRole;
  active: StaffSection;
  nav: StaffNavItem[];
  title: string;
  scopeLabel: string;
  children: ReactNode;
}) {
  const visible = nav.filter((item) => item.roles.includes(role));

  return (
    <div className={styles.console}>
      <aside className={`on-ink ${styles.sidebar}`}>
        <Link href={`/${locale}`} className={styles.brand}>
          <KonektMark className={styles.brandMark} />
          <span className={styles.brandWord}>KONEKT</span>
        </Link>

        <div className={styles.scope}>
          <span className={styles.scopeRole}>{role}</span>
          <span className={styles.scopeLabel}>{scopeLabel}</span>
        </div>

        <nav className={styles.nav} aria-label={title}>
          {visible.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              prefetch={false}
              className={styles.navLink}
              aria-current={active === item.key ? 'page' : undefined}
            >
              <span className={styles.navMarker} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className={styles.panel}>
        <header className={styles.panelHead}>
          <h1 className={`t-h3 ${styles.panelTitle}`}>{title}</h1>
        </header>
        <main className={styles.panelBody}>{children}</main>
      </div>
    </div>
  );
}
