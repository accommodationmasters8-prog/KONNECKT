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

/**
 * The rail, in two blocks.
 *
 * Every section used to be one flat list of equal-looking rows, and on a
 * laptop the list was taller than the screen — so the rail scrolled, and Sign
 * out lived below the fold. A navigation you have to scroll to read is a
 * navigation nobody reads.
 *
 * They are not equal, though, which is what makes the split honest rather than
 * cosmetic. `work` is the tracker: the figures, the tree they hang off, and
 * the field activity that feeds them. Somebody is in those seven all day.
 * `admin` is everything you go to on purpose and leave again — an export, a
 * bulk import, who has access, the settings, the activity trail, the manual.
 * Those sit at the foot of the rail in a quieter, tighter block, which is both
 * where they belong and how the whole thing comes back inside one screen.
 */
export function staffNav(locale: Locale, labels: Record<string, string>): StaffNavItem[] {
  const to = (path: string) => `/${locale}/staff${path}`;
  return [
    /* --- The work ------------------------------------------------------- */

    // What the bank is tracking, added up.
    { key: 'overview', href: to(''), label: labels.overview, roles: ['hq', 'zone', 'branch'], group: 'work' },
    // The level below whoever is signed in: zones for HQ, branches for a zone.
    { key: 'network', href: to('/network'), label: labels.network, roles: ['hq', 'zone', 'branch'], group: 'work' },
    // What each kind of institution tracks — HQ decides, every station in the
    // category then reports it.
    { key: 'categories', href: to('/categories'), label: labels.categories, roles: ['hq', 'zone', 'branch'], group: 'work' },
    // The tree: a zone owns branches, a branch owns stations. One hierarchy,
    // and the only place structure is changed.
    { key: 'branches', href: to('/branches'), label: labels.branches, roles: ['hq', 'zone', 'branch'], group: 'work' },
    // Straight to an institution by name. It is where most days start, and
    // reaching it only by walking the tree made a search into four clicks.
    { key: 'stations', href: to('/stations'), label: labels.stations, roles: ['hq', 'zone', 'branch'], group: 'work' },
    // Visits a branch books, and the leads they came back with.
    { key: 'engagements', href: to('/engagements'), label: labels.engagements, roles: ['hq', 'zone', 'branch'], group: 'work' },
    { key: 'events', href: to('/events'), label: labels.events, roles: ['hq', 'zone', 'branch'], group: 'work' },

    /* --- Gone to on purpose, then left again ---------------------------- */

    // Take it away with you.
    { key: 'reports', href: to('/reports'), label: labels.reports, roles: ['hq', 'zone', 'branch'], group: 'admin' },
    // The door for lists that already exist. Not offered to a branch: a branch
    // has a handful of stations and adds them faster from its own page.
    { key: 'import', href: to('/import'), label: labels.import, roles: ['hq', 'zone'], group: 'admin' },
    { key: 'access', href: to('/access'), label: labels.access, roles: ['hq'], group: 'admin' },
    { key: 'settings', href: to('/settings'), label: labels.settings, roles: ['hq'], group: 'admin' },
    { key: 'audit', href: to('/audit'), label: labels.audit, roles: ['hq'], group: 'admin' },
    // How to use the thing. Every level, because every level gets the chapters
    // written for it rather than a shorter version of HQ's.
    { key: 'manual', href: to('/manual'), label: labels.manual, roles: ['hq', 'zone', 'branch'], group: 'admin' },
  ];
}
