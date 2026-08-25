import type { Metadata } from 'next';
import Link from 'next/link';
import { KonektLogo } from '@/components/KonektLogo';
import { MetricCard } from '@/components/staff/MetricCard';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { getFreelancerSession } from '@/lib/freelancer-session';
import { getServerClient } from '@/lib/supabase/server';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from './freelancer.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Freelancer — CRDB Konekt',
  robots: { index: false, follow: false },
};

interface SourcedAccount {
  id: string;
  account_number: string;
  product_code: string;
  opened_on: string;
  source: string;
}

/**
 * The freelancer dashboard.
 *
 * Deliberately small. A freelancer is not staff: they see their own status,
 * their own production and what it earns them, and nothing else. Every row
 * here comes back through a policy that matches on their own auth id — there
 * is no query in this file that could be widened by a mistake, because there
 * is no filter in this file doing the work.
 *
 * The account numbers they sourced are shown because they are the freelancer's
 * own record of what they are owed. No member names appear: who opened the
 * account is the bank's relationship, not the recruiter's.
 */
export default async function FreelancerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const { freelancer, configured } = await getFreelancerSession();
  const supabase = await getServerClient();

  let accounts: SourcedAccount[] = [];
  if (supabase && freelancer) {
    const { data } = await supabase
      .from('accounts_opened' as never)
      .select('id, account_number, product_code, opened_on, source')
      .eq('freelancer_id', freelancer.id)
      .order('opened_on', { ascending: false })
      .limit(100);
    accounts = (data as unknown as SourcedAccount[]) ?? [];
  }

  const money = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    style: 'currency', currency: 'TZS', maximumFractionDigits: 0,
  });
  const day = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', { dateStyle: 'medium' });

  const rate = Number(freelancer?.commission_tzs_per_account ?? 0);
  const earned = accounts.length * rate;

  const thisMonth = accounts.filter((a) => {
    const d = new Date(a.opened_on);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  return (
    <div className={styles.app}>
      <header className={styles.bar}>
        <Link href={`/${locale}`} className={styles.brand}>
          <KonektLogo label="KONEKT Na CRDB" className={styles.logo} />
        </Link>
        {freelancer ? (
          <form method="post" action={`/${locale}/staff/sign-out`}>
            <button type="submit" className={styles.signOut}>Sign out</button>
          </form>
        ) : null}
      </header>

      <main className={styles.main}>
        {!freelancer ? (
          <Panel title="Freelancer dashboard">
            <PanelEmpty>
              {configured ? (
                <>
                  Sign in to see your own production.{' '}
                  <Link href={`/${locale}/freelancer/sign-in`}>Sign in</Link>. If
                  you have been registered by a branch but have never signed in,
                  ask them to send you an invitation — your record exists before
                  your login does.
                </>
              ) : (
                'No database is attached to this deployment, so there is nothing to sign in to.'
              )}
            </PanelEmpty>
          </Panel>
        ) : (
          <>
            <div className={styles.head}>
              <div>
                <h1 className={styles.title}>{freelancer.full_name}</h1>
                <p className={styles.sub}>
                  {freelancer.zone_code ? `${freelancer.zone_code.replace(/_/g, ' ')} · ` : ''}
                  Registered {day.format(new Date(freelancer.registered_at))}
                </p>
              </div>
              <span
                className={
                  freelancer.status === 'active' ? styles.statusActive : styles.statusOther
                }
              >
                {freelancer.status}
              </span>
            </div>

            {freelancer.status !== 'active' ? (
              <div className={styles.notice}>
                <span className="tri tri--live" aria-hidden="true" />
                <div>
                  <strong>
                    {freelancer.status === 'pending'
                      ? 'Your registration is not active yet.'
                      : `Your account is ${freelancer.status}.`}
                  </strong>
                  <p>
                    Only an active freelancer earns commission on the accounts
                    they source. Your branch activates you — the accounts below,
                    if any, still show what you have produced.
                  </p>
                </div>
              </div>
            ) : null}

            <div className={styles.metrics}>
              <MetricCard
                tone="teal"
                label="Accounts sourced"
                value={String(accounts.length)}
                note={`${thisMonth} this month`}
                source="konekt.accounts_opened"
              />
              <MetricCard
                tone="green"
                label="Commission earned"
                value={rate ? money.format(earned) : '—'}
                note={rate ? `${money.format(rate)} per account` : 'No rate set by your branch yet'}
                source="derived"
              />
              <MetricCard
                tone="gold"
                label="This month"
                value={String(thisMonth)}
                note={rate ? money.format(thisMonth * rate) : 'Accounts opened this calendar month'}
                source="konekt.accounts_opened"
              />
            </div>

            <Panel
              title="What you have sourced"
              description="Every account that names you. These are the same rows your branch reconciles, so what you are owed is derived from them rather than typed anywhere."
            >
              {accounts.length === 0 ? (
                <PanelEmpty>
                  Nothing yet. An account counts here when the branch records
                  you as its source — ask them to name you when they open it,
                  because attribution cannot be added to a record afterwards
                  without an audit entry.
                </PanelEmpty>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Account</th>
                        <th scope="col">Product</th>
                        <th scope="col">Opened</th>
                        <th scope="col">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account) => (
                        <tr key={account.id}>
                          <th scope="row" className={styles.mono}>{account.account_number}</th>
                          <td>{account.product_code.replace(/_/g, ' ')}</td>
                          <td>{day.format(new Date(account.opened_on))}</td>
                          <td>{account.source.replace(/_/g, ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}
