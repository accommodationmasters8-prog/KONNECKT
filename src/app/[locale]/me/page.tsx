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

interface UpcomingRegistration {
  id: string;
  status: string;
  waitlist_position: number | null;
  events: {
    id: string;
    title_en: string;
    title_sw: string;
    starts_at: string;
    venue_name: string;
  } | null;
}

/**
 * The member area — the app half of this build.
 *
 * Every row here comes back through row level security: a member's session can
 * only ever read their own record, their own registrations and their own
 * consent history. That is enforced by the policies in migration 0006 and
 * proved by supabase/tests/authorisation.sql — not by this component
 * remembering to filter.
 *
 * It is organised as an app screen rather than a profile page: what is
 * happening next, then the four things people actually come here to do, then
 * the record itself. Signed out, it shows what signing in gets you rather than
 * a bare form.
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
  let upcoming: UpcomingRegistration[] = [];

  if (supabase) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      // Filtered on the auth id: staff policies let some accounts read more
      // than one member row, and "my profile" must never be whichever row
      // came back first.
      const { data } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', auth.user.id)
        .maybeSingle();
      member = (data as MemberRow | null) ?? null;

      if (member) {
        const [{ count: events }, { count: referrals }, next] = await Promise.all([
          supabase
            .from('registrations' as never)
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('referrals' as never)
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('registrations' as never)
            .select('id, status, waitlist_position, events(id, title_en, title_sw, starts_at, venue_name)')
            .in('status', ['registered', 'waitlisted'])
            .order('registered_at', { ascending: false })
            .limit(5),
        ]);
        eventCount = events ?? 0;
        referralCount = referrals ?? 0;
        upcoming = ((next.data as unknown as UpcomingRegistration[]) ?? [])
          .filter((row) => row.events && new Date(row.events.starts_at) >= new Date())
          .sort((a, b) =>
            new Date(a.events!.starts_at).getTime() - new Date(b.events!.starts_at).getTime());
      }
    }
  }

  const tierLabel = member?.tier
    ? t.membership.tiers[member.tier].name
    : t.pages.me.noTier;

  const when = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const sw = locale === 'sw';

  const actions = [
    { href: `/${locale}/events`, label: sw ? 'Tafuta matukio' : 'Find events',
      hint: sw ? 'Karibu nawe' : 'Near you' },
    { href: `/${locale}/membership`, label: sw ? 'Uanachama' : 'Membership',
      hint: sw ? 'Faida za daraja lako' : 'What your tier gives you' },
    { href: `/${locale}/opportunities`, label: sw ? 'Fursa' : 'Opportunities',
      hint: sw ? 'Kazi na ufadhili' : 'Jobs and scholarships' },
    { href: `/${locale}/me/consent`, label: t.pages.me.consentCentre,
      hint: sw ? 'Unachokubali' : 'What you agreed to' },
  ];

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
                graceLabel={sw ? 'kipindi cha neema' : 'grace period'}
              />
              {member.kyc_verified ? (
                <span className={styles.verified}>
                  {sw ? 'Imethibitishwa' : 'Verified'}
                </span>
              ) : null}
            </div>
          </PageHeader>

          <div className={`section ${styles.body}`}>
            <div className="shell">
              {/* What is happening next comes first. A member opens this
                  screen on the way to an event more often than for any other
                  reason. */}
              <section className={styles.block}>
                <h2 className={`t-h3 ${styles.blockTitle}`}>
                  {sw ? 'Kinachofuata' : 'What is next'}
                </h2>
                {upcoming.length === 0 ? (
                  <div className={`card ${styles.notice}`}>
                    <p className="t-caption">
                      {sw
                        ? 'Hujajiandikisha kwenye tukio lolote lijalo. Matukio yote ni bure.'
                        : 'You are not registered for anything coming up. Every event is free to attend.'}
                    </p>
                    <Link href={`/${locale}/events`} prefetch={false} className="btn btn--primary">
                      {sw ? 'Tafuta matukio' : 'Find events near you'}
                    </Link>
                  </div>
                ) : (
                  <ul className={styles.upcoming}>
                    {upcoming.map((row) => (
                      <li key={row.id} className={`card ${styles.ticket}`}>
                        <div className={styles.ticketMain}>
                          <span className={styles.ticketWhen}>
                            {when.format(new Date(row.events!.starts_at))}
                          </span>
                          <span className={styles.ticketTitle}>
                            {sw ? row.events!.title_sw : row.events!.title_en}
                          </span>
                          <span className={styles.ticketVenue}>{row.events!.venue_name}</span>
                        </div>
                        <span
                          className={
                            row.status === 'waitlisted' ? styles.waitlisted : styles.registered
                          }
                        >
                          {row.status === 'waitlisted'
                            ? `${sw ? 'Foleni' : 'Waitlist'} #${row.waitlist_position ?? '—'}`
                            : sw ? 'Umejiandikisha' : 'Registered'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.block}>
                <h2 className={`t-h3 ${styles.blockTitle}`}>
                  {sw ? 'Vitendo' : 'Quick actions'}
                </h2>
                <ul className={styles.actions}>
                  {actions.map((action) => (
                    <li key={action.href}>
                      <Link href={action.href} prefetch={false} className={`card ${styles.action}`}>
                        <span className={styles.actionLabel}>{action.label}</span>
                        <span className={styles.actionHint}>{action.hint}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

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
