import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { ActivityList } from '@/components/staff/ActivityList';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { ago, getActivity, getRecentlySeen } from '@/lib/activity';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from './audit.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Activity — CRDB Konekt',
  robots: { index: false, follow: false },
};

/**
 * What has happened lately.
 *
 * This was the audit log rendered as it is stored: `INSERT`, `station_reports`,
 * a UUID, a timestamp. That is the right thing to keep and the wrong thing to
 * show — the people who open this run a bank, and nobody has ever looked up a
 * record by its UUID.
 *
 * Same rows, said in words: who did it, what they did, and how long ago. Five
 * at a time, because five is what fits in the glance this screen is opened for.
 *
 * The underlying table is unchanged and still append-only — `audit_log` refuses
 * an UPDATE or a DELETE, so nobody, including HQ, can edit it after the fact.
 * Nothing here summarises anything away: every row becomes exactly one line,
 * and a table this page has no wording for names itself rather than being
 * quietly dropped.
 */
export default async function StaffActivity({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const supabase = await getServerClient();

  const [activity, staff] = session.signedIn && supabase
    ? await Promise.all([getActivity(60), getRecentlySeen()])
    : [{ items: [], automated: 0 }, []];

  const seenToday = staff.filter(
    (s) => s.lastSeen && Date.now() - new Date(s.lastSeen).getTime() < 86_400_000,
  ).length;

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="audit"
      nav={staffNav(locale, STAFF_LABELS)}
      title="Activity"
      scopeLabel={
        session.signedIn
          ? `${staff.length} accounts · ${seenToday} in today`
          : session.scopeLabel
      }
      user={session.user}
    >
      {!supabase ? (
        <Panel title="Activity">
          <PanelEmpty>No database is attached, so there is nothing to report.</PanelEmpty>
        </Panel>
      ) : !session.signedIn ? (
        <Panel title="Activity">
          <PanelEmpty>
            Sign in as HQ to see this. It shows who did what across the whole
            country, so it is not scoped to a zone.
          </PanelEmpty>
        </Panel>
      ) : (
        <>
          <Panel
            title="What&rsquo;s new"
            description="Every change a person has made, newest first. Adding, updating and removing are marked, and nothing can be edited out of this list afterwards."
          >
            {activity.items.length === 0 ? (
              <PanelEmpty>
                Nothing yet. The first thing anybody adds or files appears here
                straight away.
              </PanelEmpty>
            ) : (
              <ActivityList items={activity.items} />
            )}
            {/* A register load writes one row per institution. Saying how many
                there are beats listing 252 identical lines, and beats leaving
                them out without a word. */}
            {activity.automated > 0 ? (
              <p className={styles.automated}>
                {new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ')
                  .format(activity.automated)}{' '}
                more records come from bulk loads and imports rather than from a
                person. They stay in the log and are not listed here.
              </p>
            ) : null}
          </Panel>

          <Panel
            title="Who has been in"
            description="Every account, and when it last had the console open. An account that has never been in is one somebody was given a code for and never used."
          >
            {staff.length === 0 ? (
              <PanelEmpty>No accounts yet.</PanelEmpty>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Level</th>
                      <th scope="col">Can see</th>
                      <th scope="col">Last in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((person) => (
                      <tr key={person.id}>
                        <th scope="row">{person.name}</th>
                        <td>{person.role}</td>
                        <td>{person.scope}</td>
                        <td className={person.lastSeen ? undefined : styles.never}>
                          {ago(person.lastSeen)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </StaffShell>
  );
}
