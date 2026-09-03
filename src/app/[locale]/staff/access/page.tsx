import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import { IssueAccessForm, RevokeAccess } from '@/components/staff/AccessForms';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import {
  getAccessGrants, getBranchOptions, grantState, zoneWording,
  GRANT_STATE_WORDING, LEVEL_WORDING,
} from '@/lib/access';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';
import access from '@/components/staff/AccessForms.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Access — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * Who may get in, and on whose say-so.
 *
 * Access is issued, never signed up for. HQ creates a code with a level and a
 * scope attached, reads it out to whoever is going to use it, and that person
 * turns it into an account by choosing a passphrase. From then on the code is
 * their username. No work email is involved anywhere, which is the point: a
 * branch that shares one mailbox between six people cannot use email as an
 * identity, and pretending otherwise is how six people end up sharing one
 * login.
 */
export default async function AccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const nav = staffNav(locale, STAFF_LABELS);

  const isHq = session.signedIn && session.role === 'hq';

  if (!isHq) {
    return (
      <StaffShell
        locale={locale} role={session.role} active="access" nav={nav}
        title="Access" scopeLabel={session.scopeLabel} user={session.user}
      >
        <Panel title="Access is issued by HQ">
          <PanelEmpty>
            {session.signedIn
              ? 'Codes are credentials, so only HQ can read them. Ask HQ to issue one for whoever needs it.'
              : 'Sign in as HQ to issue access.'}
          </PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  const [grants, branches] = await Promise.all([getAccessGrants(), getBranchOptions()]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));

  const now = new Date();
  const states = grants.map((g) => grantState(g, now));
  const inUse = states.filter((s) => s === 'active').length;
  const waiting = states.filter((s) => s === 'open').length;
  const expired = states.filter((s) => s === 'expired').length;
  const revoked = states.filter((s) => s === 'revoked').length;

  const scopeOf = (grant: (typeof grants)[number]) =>
    grant.role === 'hq' ? 'Whole country'
      : grant.zone_code ? `${zoneWording(grant.zone_code)} zone`
        : grant.branch_id ? (branchName.get(grant.branch_id) ?? 'A branch')
          : '—';

  const day = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="access"
      nav={nav}
      title="Access"
      scopeLabel="Issued by HQ · a code is a credential"
      user={session.user}
      actions={
        <Link href={`/${locale}/staff/join`} className={styles.link}>
          Where they redeem it →
        </Link>
      }
    >
      <div className={styles.metrics}>
        <MetricCard tone="teal" label="Accounts in use" value={String(inUse)}
          note="Codes that became an account" />
        <MetricCard tone="green" label="Waiting to be used" value={String(waiting)}
          note={waiting === 0 ? 'Nothing outstanding' : 'Issued, not yet redeemed'} />
        <MetricCard tone="gold" label="Expired unused" value={String(expired)}
          note="Issue a fresh one if still needed" />
        <MetricCard tone="ink" label="Revoked" value={String(revoked)}
          note="Kept on the record, never deleted" />
      </div>

      <Panel
        title="Issue a code"
      >
        <IssueAccessForm branches={branches} />
      </Panel>

      <Panel
        title="Every code issued"
      >
        {grants.length === 0 ? (
          <PanelEmpty>
            No access issued yet. Everything above is empty until the first code
            goes out.
          </PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Who has it</th>
                  <th scope="col">Level</th>
                  <th scope="col">Scope</th>
                  <th scope="col">State</th>
                  <th scope="col">Issued</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {grants.map((grant, index) => {
                  const state = states[index];
                  const spent = state === 'revoked' || state === 'expired';
                  return (
                    <tr key={grant.id}>
                      <th scope="row">
                        <span className={spent ? access.codeSpent : access.code}>
                          {grant.code}
                        </span>
                        <span className={styles.sub}>{grant.label}</span>
                      </th>
                      <td>
                        {grant.holder_name}
                        {grant.holder_phone
                          ? <span className={styles.sub}>{grant.holder_phone}</span>
                          : null}
                      </td>
                      <td>{LEVEL_WORDING[grant.role].split(' — ')[0]}</td>
                      <td>{scopeOf(grant)}</td>
                      <td>
                        <span className={
                          state === 'active' ? styles.chipActive
                            : state === 'open' ? styles.chip
                              : styles.chipWarn
                        }>
                          {GRANT_STATE_WORDING[state]}
                        </span>
                      </td>
                      <td>
                        {day.format(new Date(grant.issued_at))}
                        {grant.expires_at && state === 'open' ? (
                          <span className={styles.sub}>
                            good until {day.format(new Date(grant.expires_at))}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {grant.revoked_at
                          ? <span className={styles.sub}>{grant.revoked_reason ?? 'revoked'}</span>
                          : <RevokeAccess id={grant.id} holder={grant.holder_name} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </StaffShell>
  );
}
