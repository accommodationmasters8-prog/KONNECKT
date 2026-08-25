import type { Locale } from '@/i18n';
import type { StaffNavItem } from '@/components/staff/StaffShell';

/**
 * The console's sections, in one place.
 *
 * This is the internal tracker: what CRDB is tracking, where, and what it adds
 * up to. Three levels — HQ, zone, branch — and every section below is the same
 * data seen through whichever of them is signed in.
 */
export const STAFF_LABELS = {
  overview: 'Overview',
  categories: 'Categories',
  stations: 'Stations',
  events: 'Events',
  access: 'Access',
  settings: 'Settings',
  audit: 'Audit log',
};

export function staffNav(locale: Locale, labels: Record<string, string>): StaffNavItem[] {
  const to = (path: string) => `/${locale}/staff${path}`;
  return [
    { key: 'overview', href: to(''), label: labels.overview, roles: ['hq', 'zone', 'branch'] },
    // What is tracked, and what it adds up to.
    { key: 'categories', href: to('/categories'), label: labels.categories, roles: ['hq', 'zone', 'branch'] },
    { key: 'stations', href: to('/stations'), label: labels.stations, roles: ['hq', 'zone', 'branch'] },
    { key: 'events', href: to('/events'), label: labels.events, roles: ['hq', 'zone', 'branch'] },
    // Who may see it, and the lists everything else is recorded against.
    { key: 'access', href: to('/access'), label: labels.access, roles: ['hq'] },
    { key: 'settings', href: to('/settings'), label: labels.settings, roles: ['hq'] },
    { key: 'audit', href: to('/audit'), label: labels.audit, roles: ['hq'] },
  ];
}
