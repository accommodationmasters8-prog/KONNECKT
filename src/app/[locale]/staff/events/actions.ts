'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';
import type { EventStatus } from '@/lib/supabase/types';
import { nextStatuses } from '@/lib/event-lifecycle';

export interface ActionResult {
  ok: boolean;
  message: string;
  /** Set when a create succeeded, so the form can send the user to the event. */
  id?: string;
}

type Gate =
  | { ok: true; supabase: NonNullable<Awaited<ReturnType<typeof getServerClient>>>;
      session: Awaited<ReturnType<typeof getStaffSession>> }
  | { ok: false; message: string };

async function requireStaff(): Promise<Gate> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false, message: 'No database is attached to this deployment.' };
  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false, message: 'Sign in first.' };
  return { ok: true, supabase, session };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

type ParsedEvent =
  | { error: string; values?: undefined }
  | { values: Record<string, unknown> & { title_en: string }; error?: undefined };

function readEventFields(form: FormData): ParsedEvent {
  const titleEn = String(form.get('title_en') ?? '').trim();
  const titleSw = String(form.get('title_sw') ?? '').trim();
  const startsAt = String(form.get('starts_at') ?? '').trim();
  const endsAt = String(form.get('ends_at') ?? '').trim();
  const venue = String(form.get('venue_name') ?? '').trim();
  const zone = String(form.get('zone_code') ?? '').trim();
  const capacityRaw = String(form.get('capacity') ?? '').trim();
  const targetRegRaw = String(form.get('target_registrations') ?? '').trim();
  const targetAccRaw = String(form.get('target_accounts') ?? '').trim();
  const budgetRaw = String(form.get('budget_tzs') ?? '').trim();

  if (!titleEn || !titleSw) {
    return { error: 'An event needs a title in both languages — the site is bilingual, and a missing Swahili title would render as an empty heading.' };
  }
  if (!startsAt || !endsAt) return { error: 'An event needs a start and an end.' };
  if (new Date(endsAt) <= new Date(startsAt)) {
    return { error: 'The end has to be after the start. The database refuses it otherwise.' };
  }
  if (!venue) return { error: 'An event needs a venue name.' };

  const capacity = capacityRaw === '' ? null : Number(capacityRaw);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
    return { error: 'Capacity must be a whole number above zero, or empty for no limit.' };
  }

  return {
    values: {
      title_en: titleEn,
      title_sw: titleSw,
      summary_en: String(form.get('summary_en') ?? '').trim() || null,
      summary_sw: String(form.get('summary_sw') ?? '').trim() || null,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      venue_name: venue,
      zone_code: zone || null,
      capacity,
      waitlist_enabled: form.get('waitlist_enabled') === 'on',
      target_registrations: targetRegRaw === '' ? null : Number(targetRegRaw),
      target_accounts: targetAccRaw === '' ? null : Number(targetAccRaw),
      budget_tzs: budgetRaw === '' ? null : Number(budgetRaw),
    },
  };
}

/** Create an event. It starts as a draft; nothing reaches the public site here. */
export async function createEvent(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const parsed = readEventFields(form);
  if (parsed.error || !parsed.values) {
    return { ok: false, message: parsed.error ?? 'Could not read the form.' };
  }

  const slugBase = slugify(parsed.values.title_en);
  const slug = `${slugBase}-${Date.now().toString(36).slice(-4)}`;

  const { data, error } = await gate.supabase
    .from('events' as never)
    .insert({
      ...parsed.values,
      slug,
      status: 'draft',
      created_by: gate.session.staffId,
    } as never)
    .select('id')
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  const id = (data as unknown as { id: string } | null)?.id;
  return { ok: true, message: 'Draft created.', id };
}

/** Edit an event's details. Status is changed by `moveEvent`, never here. */
export async function updateEvent(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = String(form.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Which event?' };

  const parsed = readEventFields(form);
  if (parsed.error || !parsed.values) {
    return { ok: false, message: parsed.error ?? 'Could not read the form.' };
  }

  const { error } = await gate.supabase
    .from('events' as never)
    .update(parsed.values as never)
    .eq('id', id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved.' };
}

/**
 * Move an event along its lifecycle.
 *
 * Reads the current status first rather than trusting the one the form was
 * rendered with: two coordinators on the same event, one of them on a stale
 * page, is the ordinary case rather than the exotic one.
 */
export async function moveEvent(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = String(form.get('id') ?? '').trim();
  const target = String(form.get('to') ?? '').trim() as EventStatus;
  if (!id || !target) return { ok: false, message: 'Which event, and to what?' };

  const { data, error: readError } = await gate.supabase
    .from('events' as never)
    .select('status, published_at, title_en')
    .eq('id', id)
    .single();

  if (readError) return { ok: false, message: readError.message };

  const current = data as unknown as {
    status: EventStatus; published_at: string | null; title_en: string;
  };

  if (!nextStatuses(current.status).includes(target)) {
    return {
      ok: false,
      message: `An event that is ${current.status.replace(/_/g, ' ')} cannot go straight to ${target.replace(/_/g, ' ')}. Someone may have moved it since this page loaded.`,
    };
  }

  const patch: Record<string, unknown> = { status: target };

  // `published_event_has_a_time` requires it, and the publication time is the
  // fact reporting uses to say when an event became visible.
  if (['published', 'live', 'completed'].includes(target) && !current.published_at) {
    patch.published_at = new Date().toISOString();
  }

  const { error } = await gate.supabase
    .from('events' as never)
    .update(patch as never)
    .eq('id', id)
    // Only if it has not moved since we read it.
    .eq('status', current.status);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: `${current.title_en} is now ${target.replace(/_/g, ' ')}.` };
}

/**
 * Copy an event into a new draft.
 *
 * The programme repeats: the same campus tour runs in eight zones, and
 * retyping it eight times is how a date ends up wrong in one of them. What is
 * deliberately *not* copied: the status, the publication time, and every
 * registration and check-in — those belong to the event that actually happened.
 */
export async function duplicateEvent(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = String(form.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Which event?' };

  const { data, error: readError } = await gate.supabase
    .from('events' as never)
    .select('title_en, title_sw, summary_en, summary_sw, description_en, description_sw, starts_at, ends_at, venue_name, location_id, institution_id, branch_id, zone_code, capacity, waitlist_enabled, min_age, max_age, target_registrations, target_accounts, budget_tzs')
    .eq('id', id)
    .single();

  if (readError) return { ok: false, message: readError.message };

  const source = data as unknown as Record<string, unknown> & { title_en: string };

  const { data: created, error } = await gate.supabase
    .from('events' as never)
    .insert({
      ...source,
      title_en: `${source.title_en} (copy)`,
      slug: `${slugify(source.title_en)}-${Date.now().toString(36).slice(-5)}`,
      status: 'draft',
      published_at: null,
      created_by: gate.session.staffId,
    } as never)
    .select('id')
    .single();

  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message: 'Copied into a new draft. Check the dates before you submit it.',
    id: (created as unknown as { id: string } | null)?.id,
  };
}

/** Assign or clear the coordinator responsible for the event. */
export async function setCoordinator(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = String(form.get('id') ?? '').trim();
  const staffId = String(form.get('coordinator_staff_id') ?? '').trim();
  if (!id) return { ok: false, message: 'Which event?' };

  const { error } = await gate.supabase
    .from('events' as never)
    .update({ coordinator_staff_id: staffId || null } as never)
    .eq('id', id);

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: staffId ? 'Coordinator assigned.' : 'Coordinator cleared.' };
}

/**
 * Promote the next person off the waitlist.
 *
 * The work is done by `konekt.promote_from_waitlist`, which takes the row lock,
 * re-checks capacity and renumbers the queue in one transaction. Doing it here
 * in three queries would be a race with every other coordinator on the event.
 */
export async function promoteWaitlist(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = String(form.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Which event?' };

  const { error } = await gate.supabase.rpc('promote_from_waitlist' as never, {
    p_event_id: id,
  } as never);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Promoted the next person on the waitlist.' };
}
