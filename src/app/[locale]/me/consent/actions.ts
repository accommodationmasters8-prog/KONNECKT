'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { CONSENT_WORDING, WORDING_VERSION } from '@/lib/consent-wording';

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Record a consent decision.
 *
 * `konekt.consent_records` is append-only — UPDATE and DELETE are blocked by
 * trigger — so withdrawing consent writes a new row saying so. The original
 * stays, because the original is the evidence that consent was given, and
 * evidence that disappears when someone changes their mind was never evidence.
 *
 * Row level security limits the insert to the signed-in member's own record.
 * There is no member_id in this form for that reason: it is read from the
 * session, so a crafted request cannot record a decision on someone else's
 * behalf.
 */
export async function setConsent(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false, message: 'No database is attached to this deployment.' };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, message: 'Sign in first.' };

  const key = String(form.get('key') ?? '');
  const granted = form.get('granted') === 'on';
  const locale = String(form.get('locale') ?? 'en') === 'sw' ? 'sw' : 'en';

  const wording = CONSENT_WORDING[key];
  if (!wording) return { ok: false, message: 'Unknown consent.' };

  const [purpose, channel] = key.split(':');

  const { data: member } = await supabase
    .from('members' as never)
    .select('id')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();

  const memberId = (member as unknown as { id: string } | null)?.id;
  if (!memberId) {
    return { ok: false, message: 'This account is not a member record yet.' };
  }

  const { error } = await supabase
    .from('consent_records' as never)
    .insert({
      member_id: memberId,
      purpose,
      channel: channel ?? null,
      granted,
      wording_shown: wording[locale],
      wording_locale: locale,
      wording_version: WORDING_VERSION,
      source: 'member_consent_centre',
    } as never);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/${locale}/me/consent`);
  return {
    ok: true,
    message: granted ? 'Recorded. You can turn it off again at any time.' : 'Recorded. We will stop.',
  };
}
