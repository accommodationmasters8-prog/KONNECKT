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
  network: 'Performance',
  branches: 'Branches',
  categories: 'Categories',
  stations: 'Stations',
  engagements: 'Engagements',
  events: 'Events',
  reports: 'Reports',
  access: 'Access',
  settings: 'Settings',
  audit: 'Activity',
  manual: 'Manual',
  import: 'Import',
};

export function staffNav(locale: Locale, labels: Record<string, string>): StaffNavItem[] {
  const to = (path: string) => `/${locale}/staff${path}`;
  return [
    { key: 'overview', href: to(''), label: labels.overview, roles: ['hq', 'zone', 'branch'] },
    // Zones for HQ, branches for a zone: the level below whoever is signed in.
    { key: 'network', href: to('/network'), label: labels.network, roles: ['hq', 'zone', 'branch'] },
    // What is tracked, and what it adds up to.
    { key: 'categories', href: to('/categories'), label: labels.categories, roles: ['hq', 'zone', 'branch'] },
    // The tree: a zone owns branches, a branch owns stations. One hierarchy,
    // and the only place structure is changed.
    { key: 'branches', href: to('/branches'), label: labels.branches, roles: ['hq', 'zone', 'branch'] },
    // Visits a branch books, and the leads they came back with.
    { key: 'engagements', href: to('/engagements'), label: labels.engagements, roles: ['hq', 'zone', 'branch'] },
    { key: 'events', href: to('/events'), label: labels.events, roles: ['hq', 'zone', 'branch'] },
    // Take it away with you.
    { key: 'reports', href: to('/reports'), label: labels.reports, roles: ['hq', 'zone', 'branch'] },
    // Who may see it, and the lists everything else is recorded against.
    // The door for lists that already exist. Not offered to a branch: a branch
    // has a handful of stations and adds them faster from its own page.
    { key: 'import', href: to('/import'), label: labels.import, roles: ['hq', 'zone'] },
    { key: 'access', href: to('/access'), label: labels.access, roles: ['hq'] },
    { key: 'settings', href: to('/settings'), label: labels.settings, roles: ['hq'] },
    { key: 'audit', href: to('/audit'), label: labels.audit, roles: ['hq'] },
    // How to use the thing. Every level, because every level gets the chapters
    // written for it rather than a shorter version of HQ's.
    { key: 'manual', href: to('/manual'), label: labels.manual, roles: ['hq', 'zone', 'branch'] },
  ];
}
