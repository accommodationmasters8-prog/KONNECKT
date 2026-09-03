'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface ActionResult {
  ok: boolean;
  message: string;
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

type ParsedEvent =
  | { error: string; values?: undefined }
  | { values: Record<string, unknown> & { name: string }; error?: undefined };

function readFields(form: FormData): ParsedEvent {
  const name = String(form.get('name') ?? '').trim();
  const date = String(form.get('event_date') ?? '').trim();
  const venue = String(form.get('venue') ?? '').trim();

  if (!name) return { error: 'Give the event a name.' };
  if (!date) return { error: 'An event needs a date — it is what decides past or upcoming.' };
  if (!venue) return { error: 'Where was it held?' };

  const num = (key: string) => {
    const raw = String(form.get(key) ?? '').trim();
    if (raw === '') return null;
    const value = Number(raw.replace(/,/g, ''));
    return Number.isFinite(value) ? value : NaN;
  };

  const participants = num('participants');
  const budget = num('budget_tzs');
  const spend = num('actual_spend_tzs');
  const accounts = num('accounts_opened');
  const simbanking = num('simbanking_activated');
  const cards = num('cards_issued');
  const lipaHapa = num('lipa_hapa_registered');
  const accountsActivated = num('accounts_activated');
  const leadsExpected = num('leads_expected');
  const leadsGot = num('leads_got');
  const deposits = num('deposits_tzs');

  if ([participants, budget, spend, accounts, deposits].some((v) => v !== null && Number.isNaN(v))) {
    return { error: 'Every figure has to be a number.' };
  }

  const endDate = String(form.get('end_date') ?? '').trim();
  if (endDate && endDate < date) {
    return { error: 'The end cannot be before the start.' };
  }

  const url = String(form.get('album_url') ?? '').trim();
  if (url && !/^https?:\/\//i.test(url)) {
    return { error: 'The album link must start with http:// or https://' };
  }

  return {
    values: {
      name,
      event_date: date,
      end_date: endDate || null,
      venue,
      address: String(form.get('address') ?? '').trim() || null,
      station_id: String(form.get('station_id') ?? '').trim() || null,
      category_id: String(form.get('category_id') ?? '').trim() || null,
      participants: participants === null ? null : Math.round(participants),
      budget_tzs: budget,
      actual_spend_tzs: spend,
      accounts_opened: accounts === null ? null : Math.round(accounts),
      accounts_activated: accountsActivated === null ? 0 : Math.round(accountsActivated),
      leads_expected: leadsExpected === null ? 0 : Math.round(leadsExpected),
      leads_got: leadsGot === null ? 0 : Math.round(leadsGot),
      simbanking_activated: simbanking === null ? null : Math.round(simbanking),
      cards_issued: cards === null ? null : Math.round(cards),
      lipa_hapa_registered: lipaHapa === null ? null : Math.round(lipaHapa),
      deposits_tzs: deposits,
      album_url: url || null,
      notes: String(form.get('notes') ?? '').trim() || null,
    },
  };
}

/**
 * Record an event.
 *
 * Past or upcoming is never stored — it is the date compared to today, worked
 * out wherever it is displayed. A status column would need somebody to
 * remember to change it the morning after, and nobody ever does.
 */
export async function saveEvent(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const parsed = readFields(form);
  if (parsed.error || !parsed.values) {
    return { ok: false, message: parsed.error ?? 'Could not read the form.' };
  }

  const id = String(form.get('id') ?? '').trim();

  if (id) {
    const { error } = await gate.supabase
      .from('tracked_events' as never)
      .update(parsed.values as never)
      .eq('id', id);
    if (error) return { ok: false, message: error.message };
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Saved.' };
  }

  // The branch comes from the account where there is one, exactly as it does
  // for a station: a branch officer files against their own branch or not at
  // all.
  const { data: staff } = await gate.supabase
    .from('staff_users' as never)
    .select('branch_id')
    .eq('id', gate.session.staffId ?? '')
    .maybeSingle();

  const branchId = (staff as unknown as { branch_id: string | null } | null)?.branch_id
    ?? String(form.get('branch_id') ?? '').trim();

  if (!branchId) return { ok: false, message: 'Choose the branch this event belongs to.' };

  const { data, error } = await gate.supabase
    .from('tracked_events' as never)
    .insert({ ...parsed.values, branch_id: branchId, created_by: gate.session.staffId } as never)
    .select('id')
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: `${parsed.values.name} recorded.`,
    id: (data as unknown as { id: string } | null)?.id,
  };
}

/** Attach one image. The database caps an event at ten. */
export async function addEventImage(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const eventId = String(form.get('event_id') ?? '').trim();
  const url = String(form.get('external_url') ?? '').trim();
  const path = String(form.get('storage_path') ?? '').trim();

  if (!eventId) return { ok: false, message: 'Which event?' };
  if (!url && !path) return { ok: false, message: 'Add a file or paste a link.' };
  if (url && !/^https?:\/\//i.test(url)) {
    return { ok: false, message: 'A link must start with http:// or https://' };
  }

  const { error } = await gate.supabase
    .from('tracked_event_images' as never)
    .insert({
      event_id: eventId,
      external_url: url || null,
      storage_path: path || null,
      caption: String(form.get('caption') ?? '').trim() || null,
      display_order: Number(form.get('display_order') ?? 0) || 0,
      uploaded_by: gate.session.staffId,
    } as never);

  if (error) {
    return {
      ok: false,
      message: error.message.includes('at most 10')
        ? 'This event already has ten images. Remove one, or put the rest behind the album link.'
        : error.message,
    };
  }

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Image added.' };
}

export async function removeEventImage(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = String(form.get('image_id') ?? '').trim();
  if (!id) return { ok: false, message: 'Which image?' };

  const { error } = await gate.supabase
    .from('tracked_event_images' as never)
    .delete()
    .eq('id', id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Removed.' };
}
