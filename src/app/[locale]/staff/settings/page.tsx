import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { SettingsForm } from '@/components/staff/SettingsForm';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getSettingCatalogue, getSettings } from '@/lib/admin/settings';
import { localeParams, resolveLocale } from '@/lib/page';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Settings — CRDB Konekt',
  robots: { index: false, follow: false },
};

/**
 * What an administrator can change without a deploy.
 *
 * The form is built from `konekt.site_setting_keys` rather than hardcoded, so
 * adding an editable field is a row in that table and not a release. Nothing
 * on this page is a switch that only pretends to do something: every key here
 * is read by the page it names.
 */
export default async function StaffSettings({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const [catalogue, snapshot] = await Promise.all([getSettingCatalogue(), getSettings()]);

  const groups = catalogue.reduce<Record<string, typeof catalogue>>((acc, field) => {
    (acc[field.group_name] ??= []).push(field);
    return acc;
  }, {});

  const canEdit = session.signedIn && session.role === 'hq';

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="settings"
      nav={staffNav(locale, STAFF_LABELS)}
      title={STAFF_LABELS.settings}
      scopeLabel={
        canEdit
          ? 'Changes here go live for every visitor, in both languages'
          : session.scopeLabel
      }
      user={session.user}
    >
      {!snapshot.configured ? (
        <Panel
          title="Site settings"
          description="Copy, contact details and switches an HQ administrator can change from here, without a deploy."
        >
          <PanelEmpty>
            No database is attached to this deployment, so there is nothing to
            edit yet — the site is running on its committed copy. Once Supabase
            is configured and migration 0008 has run, every field in
            konekt.site_setting_keys appears here as a form.
          </PanelEmpty>
        </Panel>
      ) : !canEdit ? (
        <Panel title="Site settings">
          <PanelEmpty>
            Site settings are national, so only an HQ administrator can change
            them. Sign in with an HQ account to edit.
          </PanelEmpty>
        </Panel>
      ) : (
        Object.entries(groups).map(([group, fields]) => (
          <Panel
            key={group}
            title={group}
            description={
              group === 'Switches'
                ? 'Each of these hides or reveals something on the public site the moment it is saved.'
                : undefined
            }
          >
            <SettingsForm group={group} fields={fields} values={snapshot.values} />
          </Panel>
        ))
      )}
    </StaffShell>
  );
}
