/**
 * The shapes the activity screen speaks in, and the one helper that formats
 * them.
 *
 * Split out from the queries deliberately. The list is a client component — it
 * has a "show more" — and importing anything from `activity.ts` would drag the
 * server Supabase client into the browser bundle with it. The build says so,
 * loudly, which is how this was found; this file is the half that is safe on
 * both sides.
 */

export interface ActivityItem {
  id: number;
  at: string;
  who: string;
  /** The sentence, already assembled. */
  what: string;
  /** Roughly what happened, for the colour of the dot beside it. */
  kind: 'added' | 'changed' | 'removed';
  where: string | null;
}

export interface SeenStaff {
  id: string;
  name: string;
  role: string;
  scope: string;
  lastSeen: string | null;
}

/** "3 hours ago", in words rather than a timestamp nobody subtracts in their head. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return 'never';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 90) return 'just now';

  const steps: [number, string][] = [
    [60, 'minute'], [3600, 'hour'], [86400, 'day'], [604800, 'week'],
  ];

  let unit = 'minute';
  let size = 60;
  for (const [s, name] of steps) {
    if (seconds >= s) { size = s; unit = name; }
  }

  const n = Math.round(seconds / size);
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}
