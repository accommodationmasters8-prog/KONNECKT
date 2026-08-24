import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { SiteFooter } from '@/components/SiteFooter';
import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { getServerClient } from '@/lib/supabase/server';
import type { MemberRow } from '@/lib/supabase/types';
import { localeParams, resolveLocale } from '@/lib/page';
import { getDictionary, isLocale } from '@/i18n';
import styles from './me.module.css';

export function generateStaticParams() {
  return localeParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: `${t.pages.me.title} — CRDB Konekt`, robots: { index: false } };
}

/**
 * The member area.
 *
 * Every row here comes back through row level security: a member's session can
 * only ever read their own record, their own registrations and their own
 * consent history. That is enforced by the policies in migration 0006 and
 * proved by supabase/tests/authorisation.sql — not by this component
 * remembering to filter.
 *
 * Signed out, it shows what signing in gets you rather than a bare form.
 */
export default async function MePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  const supabase = await getServerClient();

  let member: MemberRow | null = null;
  let eventCount = 0;
  let referralCount = 0;

  if (supabase) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      const { data } = await supabase.from('members').select('*').limit(1).maybeSingle();
      member = (data as MemberRow | null) ?? null;

      if (member) {
        const [{ count: events }, { count: referrals }] = await Promise.all([
          supabase
            .from('registrations' as never)
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('referrals' as never)
            .select('id', { count: 'exact', head: true }),
        ]);
        eventCount = events ?? 0;
        referralCount = referrals ?? 0;
      }
    }
  }

  const tierLabel = member?.tier
    ? t.membership.tiers[member.tier].name
    : t.pages.me.noTier;

  return (
    <AppShell locale={locale} t={t} active="me">
      {member ? (
        <>
          <PageHeader
            eyebrow={t.pages.me.title}
            title={member.preferred_name || member.full_name || t.pages.me.title}
            lead={t.pages.me.lead}
          >
            <div className={styles.tierRow}>
              <TierBadge
                tier={member.tier}
                label={tierLabel}
                inGrace={member.in_grace_period}
                graceLabel={locale === 'sw' ? 'kipindi cha neema' : 'grace period'}
              />
              {member.kyc_verified ? (
                <span className={styles.verified}>
                  {locale === 'sw' ? 'Imethibitishwa' : 'Verified'}
                </span>
              ) : null}
            </div>
          </PageHeader>

          <div className={`section ${styles.body}`}>
            <div className="shell">
              <ul className={styles.stats}>
                <li className={`card ${styles.stat}`}>
                  <span className={`t-data ${styles.statValue}`}>{eventCount}</span>
                  <span className={styles.statLabel}>{t.pages.me.myEvents}</span>
                </li>
                <li className={`card ${styles.stat}`}>
                  <span className={`t-data ${styles.statValue}`}>{referralCount}</span>
                  <span className={styles.statLabel}>{t.pages.me.myReferrals}</span>
                </li>
                <li className={`card ${styles.stat} ${styles.statWide}`}>
                  <span className={styles.statLabel}>{t.pages.me.referralCode}</span>
                  <span className={`t-data ${styles.code}`}>{member.referral_code}</span>
                </li>
              </ul>

              {member.tier === null ? (
                <div className={`card ${styles.notice}`}>
                  <h2 className="t-h3">{t.pages.me.noTier}</h2>
                  <p className="t-caption">{t.pages.me.noTierBody}</p>
                </div>
              ) : null}

              <div className={`card ${styles.consent}`}>
                <h2 className="t-h3">{t.pages.me.consentCentre}</h2>
                <p className="t-caption">{t.pages.me.consentBody}</p>
                <Link href={`/${locale}/me/consent`} prefetch={false} className="btn btn--quiet">
                  {t.pages.me.consentCentre}
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <PageHeader
            eyebrow={t.pages.me.title}
            title={t.pages.me.signedOut}
            lead={t.pages.me.signedOutBody}
          />
          <div className={`section ${styles.body}`}>
            <div className="shell">
              <EmptyState
                title={supabase ? t.pages.me.signedOut : t.common.notConnected}
                body={supabase ? t.pages.me.signedOutBody : t.common.notConnectedBody}
                action={
                  supabase ? (
                    <Link href={`/${locale}/me/sign-in`} prefetch={false} className="btn btn--primary">
                      {t.pages.me.signIn}
                    </Link>
                  ) : null
                }
              />
            </div>
          </div>
        </>
      )}

      <SiteFooter locale={locale} t={t} />
    </AppShell>
  );
}
