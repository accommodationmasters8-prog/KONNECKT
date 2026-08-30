import Link from 'next/link';
import type { ReactNode } from 'react';
import { KonektLogo } from '../KonektLogo';
import type { Locale } from '@/i18n';
import type { StaffRole } from '@/lib/supabase/types';
import {
  AccessIcon, AccountsIcon, AuditIcon, CategoriesIcon, CheckinIcon,
  CommunicationIcon, EventsIcon, FreelancersIcon, MembersIcon, OverviewIcon,
  PartnersIcon, ProductsIcon, SettingsIcon, SignOutIcon, SponsorshipIcon,
  NetworkIcon, StationsIcon, VerificationIcon,
} from './StaffIcons';
import styles from './StaffShell.module.css';

export type StaffSection =
  | 'overview' | 'network' | 'branches' | 'categories' | 'stations' | 'events'
  | 'access' | 'reports' | 'settings' | 'audit' | 'manual'
  // Sections from the earlier build, still routable while they are retired.
  | 'checkin' | 'accounts' | 'verification' | 'sponsorship' | 'members'
  | 'partners' | 'communication' | 'products' | 'freelancers';

export interface StaffNavItem {
  key: StaffSection;
  href: string;
  label: string;
  /** Roles that may see this panel at all. */
  roles: StaffRole[];
}

export interface StaffUser {
  /** What to show. An email is fine; a name is better. */
  name: string;
  email?: string;
}

const ICONS: Record<StaffSection, (p: { className?: string }) => ReactNode> = {
  overview: OverviewIcon,
  network: NetworkIcon,
  branches: StationsIcon,
  reports: AuditIcon,
  categories: CategoriesIcon,
  stations: StationsIcon,
  access: AccessIcon,
  events: EventsIcon,
  checkin: CheckinIcon,
  accounts: AccountsIcon,
  verification: VerificationIcon,
  sponsorship: SponsorshipIcon,
  members: MembersIcon,
  audit: AuditIcon,
  manual: AuditIcon,
  partners: PartnersIcon,
  settings: SettingsIcon,
  communication: CommunicationIcon,
  products: ProductsIcon,
  freelancers: FreelancersIcon,
};

const ROLE_LABELS: Record<StaffRole, string> = {
  hq: 'HQ administrator',
  zone: 'Zone manager',
  branch: 'Branch officer',
  field_agent: 'Field agent',
};

/** Initials for the avatar. Two letters, from whatever the name gives us. */
function initials(name: string) {
  const parts = name.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]).join('');
  return (letters || name.slice(0, 2)).toUpperCase();
}

/**
 * The console frame.
 *
 * A light application surface: a white rail on the left, a white bar across
 * the top, and content on a flat, slightly cool canvas. No frosted glass and
 * no blur anywhere in here — the marketing site's chrome is deliberately
 * translucent because it floats over scrolling content, and a desk tool that
 * someone reads for two hours is the opposite case. Flat surfaces, one
 * shadow level, and the only gradients are on the metric cards.
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
  user = null,
  actions,
  children,
}: {
  locale: Locale;
  role: StaffRole;
  active: StaffSection;
  nav: StaffNavItem[];
  title: string;
  scopeLabel: string;
  /** null when nobody is signed in — the rail then offers sign-in instead. */
  user?: StaffUser | null;
  /** Page-level controls for the top bar: a search field, a primary button. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const visible = nav.filter((item) => item.roles.includes(role));
  const today = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className={styles.console}>
      <aside className={styles.rail}>
        {/* The logo sits on white, with the artwork's own margins as its
            breathing room. It is the one place in the console that is pure
            brand, so nothing else competes with it in this block. */}
        <Link href={`/${locale}`} className={styles.brand}>
          <KonektLogo label="KONEKT Na CRDB" className={styles.brandLogo} />
          <span className="visually-hidden">Back to the public site</span>
        </Link>

        {user ? (
          <div className={styles.who}>
            <span className={styles.avatar} aria-hidden="true">{initials(user.name)}</span>
            <span className={styles.whoText}>
              <span className={styles.whoName}>{user.name}</span>
              <span className={styles.whoRole}>{ROLE_LABELS[role]}</span>
            </span>
          </div>
        ) : (
          <Link href={`/${locale}/staff/sign-in`} className={styles.signIn}>
            Sign in
          </Link>
        )}

        <nav className={styles.nav} aria-label="Console sections">
          {visible.map((item) => {
            const Icon = ICONS[item.key];
            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch={false}
                className={styles.navLink}
                aria-current={active === item.key ? 'page' : undefined}
              >
                <Icon className={styles.navIcon} />
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {user ? (
          <form method="post" action={`/${locale}/staff/sign-out`} className={styles.railFoot}>
            <button type="submit" className={styles.signOut}>
              <SignOutIcon className={styles.navIcon} />
              Sign out
            </button>
          </form>
        ) : null}
      </aside>

      <div className={styles.panel}>
        <header className={styles.topbar}>
          <div className={styles.topbarLead}>
            <h1 className={styles.panelTitle}>{title}</h1>
            <p className={styles.scope}>{scopeLabel}</p>
          </div>
          <div className={styles.topbarTail}>
            {actions}
            <span className={styles.today}>{today}</span>
          </div>
        </header>
        <main className={styles.panelBody}>{children}</main>
      </div>
    </div>
  );
}
