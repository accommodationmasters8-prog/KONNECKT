import type { Locale } from '@/i18n';
import type { StaffNavItem } from '@/components/staff/StaffShell';

/**
 * The section labels, in one place.
 *
 * They were repeated at the top of every console page, which is how a rename
 * ends up applied to seven of eight pages.
 */
export const STAFF_LABELS = {
  overview: 'Dashboard',
  events: 'Events',
  checkin: 'Check-in',
  accounts: 'Accounts opened',
  verification: 'Pin verification',
  sponsorship: 'Sponsorship',
  members: 'Members',
  audit: 'Audit log',
  communication: 'Communication',
  products: 'Account types',
  freelancers: 'Freelancers',
  partners: 'Partners',
  settings: 'Settings',
};

/**
 * Console navigation.
 *
 * `roles` decides what a user is shown, not what they can reach. Every panel
 * loads its data under the signed-in user's session, so row level security is
 * what actually stops a branch officer reading another zone's accounts — this
 * list only stops them being invited to try.
 */
export function staffNav(locale: Locale, labels: Record<string, string>): StaffNavItem[] {
  const to = (path: string) => `/${locale}/staff${path}`;
  return [
    { key: 'overview', href: to(''), label: labels.overview, roles: ['hq', 'zone', 'branch'] },
    { key: 'events', href: to('/events'), label: labels.events, roles: ['hq', 'zone', 'branch'] },
    { key: 'checkin', href: to('/check-in'), label: labels.checkin, roles: ['hq', 'zone', 'branch', 'field_agent'] },
    { key: 'accounts', href: to('/accounts'), label: labels.accounts, roles: ['hq', 'zone', 'branch'] },
    { key: 'verification', href: to('/verification'), label: labels.verification, roles: ['hq', 'zone', 'branch'] },
    { key: 'sponsorship', href: to('/sponsorship'), label: labels.sponsorship, roles: ['hq', 'zone'] },
    { key: 'members', href: to('/members'), label: labels.members, roles: ['hq'] },
    // Bulk messaging. Any staff user may draft one inside their own scope;
    // approving it is somebody else's job, and the database enforces that.
    { key: 'communication', href: to('/communication'), label: labels.communication, roles: ['hq', 'zone', 'branch'] },
    // A branch registers and answers for its own freelancers.
    { key: 'freelancers', href: to('/freelancers'), label: labels.freelancers, roles: ['hq', 'zone', 'branch'] },
    // The products a branch can record an account against. National.
    { key: 'products', href: to('/products'), label: labels.products, roles: ['hq'] },
    // Administration. HQ only — a zone manager changing the partner strip or
    // the site's own copy is a national decision made in one zone's name.
    { key: 'partners', href: to('/partners'), label: labels.partners, roles: ['hq'] },
    { key: 'settings', href: to('/settings'), label: labels.settings, roles: ['hq'] },
    { key: 'audit', href: to('/audit'), label: labels.audit, roles: ['hq'] },
  ];
}
