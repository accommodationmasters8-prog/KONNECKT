'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface ActionResult {
  ok: boolean;
  message: string;
}

const CHANNELS = new Set(['sms', 'email', 'push', 'whatsapp', 'phone_call']);
const PURPOSES = new Set([
  'terms_of_use', 'privacy_policy', 'marketing', 'event_reminders', 'photo_use',
]);

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

/**
 * Draft a campaign.
 *
 * Both bodies are required. A bilingual platform that sends one language to
 * everyone has chosen a language for its members, and doing that by accident
 * in a bulk send is worse than doing it deliberately.
 *
 * An SMS segment is 160 GSM-7 characters. The count is shown in the form
 * rather than enforced here: a 210-character message is a legitimate two-part
 * send, it just costs twice, and the person writing it should see that.
 */
export async function createCampaign(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const name = String(form.get('name') ?? '').trim();
  const channel = String(form.get('channel') ?? 'sms');
  const purpose = String(form.get('purpose') ?? 'event_reminders');
  const bodyEn = String(form.get('body_en') ?? '').trim();
  const bodySw = String(form.get('body_sw') ?? '').trim();
  const tier = String(form.get('audience_tier') ?? '').trim();
  const zone = String(form.get('scope_zone_code') ?? '').trim();

  if (!name) return { ok: false, message: 'Give the campaign a name you will recognise in the audit log.' };
  if (!CHANNELS.has(channel)) return { ok: false, message: 'Unknown channel.' };
  if (!PURPOSES.has(purpose)) return { ok: false, message: 'Unknown purpose.' };
  if (!bodyEn || !bodySw) {
    return { ok: false, message: 'Write the message in both English and Kiswahili.' };
  }

  const { error } = await gate.supabase
    .from('campaigns' as never)
    .insert({
      name,
      channel,
      purpose,
      body_en: bodyEn,
      body_sw: bodySw,
      audience_tier: tier || null,
      scope_zone_code: zone || null,
      created_by: gate.session.staffId,
    } as never);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: `Drafted "${name}". It needs a second person to approve it.` };
}

/**
 * Approve a campaign.
 *
 * The database's `maker_is_not_checker` constraint refuses an approval by the
 * person who wrote it. This checks first only so the refusal reads as a
 * sentence instead of a constraint violation — the rule lives in the schema,
 * where it cannot be forgotten by a future screen.
 */
export async function approveCampaign(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = String(form.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Which campaign?' };

  const { data } = await gate.supabase
    .from('campaigns' as never)
    .select('created_by, name')
    .eq('id', id)
    .single();

  const campaign = data as unknown as { created_by: string; name: string } | null;
  if (campaign && campaign.created_by === gate.session.staffId) {
    return {
      ok: false,
      message: 'You wrote this one. A bulk send needs a second person to approve it — that is the point of the rule.',
    };
  }

  const { error } = await gate.supabase
    .from('campaigns' as never)
    .update({
      approved_by: gate.session.staffId,
      approved_at: new Date().toISOString(),
    } as never)
    .eq('id', id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Approved. Resolve the audience next.' };
}

/**
 * Resolve the audience.
 *
 * Calls `konekt.build_campaign_audience`, which writes one delivery row per
 * member considered — including the ones skipped, with the reason. That is
 * what makes "confirm a suppressed member received nothing" answerable from
 * the table afterwards rather than from someone's memory of the send.
 *
 * It does not send anything. No SMS gateway is configured in this build, and
 * `sent_at` is left for whatever actually delivers a message to set.
 */
export async function resolveAudience(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = String(form.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Which campaign?' };

  const { data, error } = await gate.supabase.rpc('build_campaign_audience' as never, {
    p_campaign_id: id,
  } as never);

  if (error) return { ok: false, message: error.message };

  const result = (Array.isArray(data) ? data[0] : data) as
    { considered: number; eligible: number } | null;

  revalidatePath('/', 'layout');

  if (!result) return { ok: true, message: 'Audience resolved.' };

  const skipped = result.considered - result.eligible;
  return {
    ok: true,
    message: `${result.eligible} of ${result.considered} members may be contacted for this purpose and channel. ${skipped} skipped, each with a reason recorded.`,
  };
}
