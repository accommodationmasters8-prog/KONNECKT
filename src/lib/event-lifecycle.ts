import type { EventStatus } from '@/lib/supabase/types';

/**
 * The event lifecycle, as a graph rather than a set of buttons.
 *
 * Every transition the console offers is an edge here, and the action refuses
 * anything that is not one. Without this a "publish" button on a cancelled
 * event is one stray click away from putting a cancelled event back on the
 * public site — the database's own constraint only guarantees that a published
 * event has a published_at, not that the path there made sense.
 */
const TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'draft', 'cancelled'],
  approved: ['published', 'draft', 'cancelled'],
  published: ['live', 'cancelled'],
  live: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['draft'],
};

export const TRANSITION_LABELS: Record<EventStatus, string> = {
  draft: 'Return to draft',
  pending_approval: 'Submit for approval',
  approved: 'Approve',
  published: 'Publish to the site',
  live: 'Mark live now',
  completed: 'Mark completed',
  cancelled: 'Cancel event',
};

export function nextStatuses(status: EventStatus): EventStatus[] {
  return TRANSITIONS[status] ?? [];
}
