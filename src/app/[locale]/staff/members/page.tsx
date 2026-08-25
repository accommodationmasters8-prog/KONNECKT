import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Members — CRDB Konekt',
  robots: { index: false, follow: false },
};

/**
 * The membership register.
 *
 * Counts only, by tier, and no personal data on this screen. A console that
 * lists names and phone numbers by default trains everyone who uses it to
 * treat member records as a browsable directory; anything identifying is
 * reached deliberately, from a specific member's own record.
 */
export default async function StaffMembers({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  const tiers = ['silver', 'gold', 'platinum'] as const;
  const counts: Record<string, number | null> = { silver: null, gold: null, platinum: null };

  if (supabase && session.signedIn) {
    await Promise.all(
      tiers.map(async (tier) => {
        const { count } = await supabase
          .from('members' as never)
          .select('id', { count: 'exact', head: true })
          .eq('tier', tier);
        counts[tier] = count ?? 0;
      }),
    );
  }

  const tones = { silver: 'ink', gold: 'gold', platinum: 'teal' } as const;

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="members"
      nav={staffNav(locale, STAFF_LABELS)}
      title={STAFF_LABELS.members}
      scopeLabel={session.scopeLabel}
      user={session.user}
    >
      <div className={styles.metrics}>
        {tiers.map((tier) => (
          <MetricCard
            key={tier}
            tone={tones[tier]}
            label={`${tier[0].toUpperCase()}${tier.slice(1)} members`}
            value={counts[tier] === null ? '—' : String(counts[tier])}
            note={counts[tier] === null ? 'Needs a signed-in session' : undefined}
            source="konekt.members"
          />
        ))}
      </div>

      <Panel
        title="Member records"
        description="Reached one at a time, from a check-in or an account record. Not browsable as a list."
      >
        <PanelEmpty>
          {supabase
            ? 'Member records carry phone numbers, dates of birth and, for under-18s, a guardian consent record. Row level security decides which of them this account can read at all — an HQ analyst sees counts, a branch officer sees the members their branch has served.'
            : 'No database is attached to this deployment, so there are no members to count. The tier counts above read konekt.members under the signed-in user’s own session.'}
        </PanelEmpty>
      </Panel>
    </StaffShell>
  );
}
