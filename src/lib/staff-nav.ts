import type { Locale } from '@/i18n';
import type { StaffNavItem } from '@/components/staff/StaffShell';

/**
 * Staff console navigation.
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
    { key: 'audit', href: to('/audit'), label: labels.audit, roles: ['hq'] },
  ];
}
