import { getServerClient } from '@/lib/supabase/server';
import type { ActivityItem, SeenStaff } from '@/lib/activity-format';

export type { ActivityItem, SeenStaff } from '@/lib/activity-format';
export { ago } from '@/lib/activity-format';

/**
 * The audit log, said in words.
 *
 * The table records `INSERT` on `station_reports`, a UUID, and a timestamp.
 * That is the right thing to store and the wrong thing to show: the people who
 * open this screen run a bank, not a database, and "Amina Juma filed figures
 * for a station" is the same fact in a form they can act on.
 *
 * Nothing is summarised away. Every row still becomes exactly one line, and
 * anything this file has no wording for falls back to naming the table rather
 * than being dropped — a log that quietly hides what it does not understand is
 * worse than a technical one.
 */

/** What each table is called by the people who use it. */
const THING: Record<string, { one: string; verbAdd?: string }> = {
  stations: { one: 'a station' },
  station_reports: { one: 'figures for a station', verbAdd: 'filed' },
  station_report_accounts: { one: 'the account split on a report' },
  station_report_loans: { one: 'the loan split on a report' },
  branches: { one: 'a branch' },
  zones: { one: 'a zone' },
  tracker_categories: { one: 'a category' },
  account_products: { one: 'an account type' },
  loan_products: { one: 'a loan type' },
  tracked_events: { one: 'an event' },
  tracked_event_images: { one: 'a picture on an event' },
  access_grants: { one: 'an access code', verbAdd: 'issued' },
  staff_users: { one: 'a staff account' },
  submissions: { one: 'a message from the public' },
};

const VERB: Record<string, { word: string; kind: ActivityItem['kind'] }> = {
  INSERT: { word: 'added', kind: 'added' },
  UPDATE: { word: 'updated', kind: 'changed' },
  DELETE: { word: 'removed', kind: 'removed' },
};

interface AuditRow {
  id: number;
  occurred_at: string;
  actor_kind: string;
  action: string;
  table_name: string;
  after_state: Record<string, unknown> | null;
  before_state: Record<string, unknown> | null;
  staff_users: { full_name: string | null; email: string | null } | null;
}

/** The name on the record itself, where it has one worth showing. */
function nameOf(row: AuditRow): string | null {
  const state = row.after_state ?? row.before_state;
  if (!state) return null;
  for (const key of ['name', 'title', 'label', 'label_en', 'name_en', 'full_name']) {
    const value = state[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

/**
 * What people have done, and how much the machinery did on its own.
 *
 * A register load writes one audit row per institution, so a single import of
 * the branch list buries a week of real work under 252 identical lines. Those
 * rows are worth keeping and not worth reading: this returns the ones with a
 * person behind them, and counts the rest so the screen can say how many there
 * are instead of pretending they do not exist.
 */
export async function getActivity(limit = 60): Promise<{
  items: ActivityItem[];
  automated: number;
}> {
  const supabase = await getServerClient();
  if (!supabase) return { items: [], automated: 0 };

  const [{ data }, { count: automated }] = await Promise.all([
    supabase
      .from('audit_log' as never)
      .select('id, occurred_at, actor_kind, action, table_name, after_state, before_state, staff_users(full_name, email)')
      .neq('actor_kind', 'system')
      .order('occurred_at', { ascending: false })
      .limit(limit),
    supabase
      .from('audit_log' as never)
      .select('id', { count: 'exact', head: true })
      .eq('actor_kind', 'system'),
  ]);

  const items = ((data as unknown as AuditRow[]) ?? []).map((row) => {
    const verb = VERB[row.action] ?? { word: row.action.toLowerCase(), kind: 'changed' as const };
    const thing = THING[row.table_name];

    // An unmapped table names itself rather than vanishing.
    const noun = thing?.one ?? `a record in ${row.table_name.replace(/_/g, ' ')}`;
    const word = row.action === 'INSERT' && thing?.verbAdd ? thing.verbAdd : verb.word;
    const named = nameOf(row);

    return {
      id: row.id,
      at: row.occurred_at,
      who: row.staff_users?.full_name
        ?? row.staff_users?.email
        ?? (row.actor_kind === 'system' ? 'The system' : 'Somebody'),
      what: named ? `${word} ${noun} — ${named}` : `${word} ${noun}`,
      kind: verb.kind,
      where: null,
    };
  });

  return { items, automated: automated ?? 0 };
}

/** Who has been in, most recent first. */
export async function getRecentlySeen(): Promise<SeenStaff[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const [{ data: staff }, { data: branches }] = await Promise.all([
    supabase.from('staff_users' as never)
      .select('id, full_name, email, role, zone_code, branch_id, last_seen_at, is_active')
      .eq('is_active', true)
      .limit(500),
    supabase.from('branches' as never).select('id, name').limit(2000),
  ]);

  const branchName = new Map(
    ((branches as unknown as { id: string; name: string }[]) ?? []).map((b) => [b.id, b.name]),
  );

  return ((staff as unknown as {
    id: string; full_name: string | null; email: string | null;
    role: string; zone_code: string | null; branch_id: string | null;
    last_seen_at: string | null;
  }[]) ?? [])
    .map((s) => ({
      id: s.id,
      name: s.full_name || s.email || 'Unnamed account',
      role: s.role === 'hq' ? 'HQ'
        : s.role === 'zone' ? 'Zone manager'
          : s.role === 'branch' ? 'Branch manager' : 'Field agent',
      scope: s.role === 'hq' ? 'The whole country'
        : s.zone_code ? `${s.zone_code.replace(/_/g, ' ')} zone`
          : s.branch_id ? (branchName.get(s.branch_id) ?? 'One branch')
            : 'No scope set',
      lastSeen: s.last_seen_at,
    }))
    .sort((a, b) => {
      // Never-seen accounts last: they are a different question from a quiet
      // week, and mixing them into the same order hides both.
      if (!a.lastSeen && !b.lastSeen) return a.name.localeCompare(b.name);
      if (!a.lastSeen) return 1;
      if (!b.lastSeen) return -1;
      return b.lastSeen.localeCompare(a.lastSeen);
    });
}
