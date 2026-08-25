'use server';

import { getServiceClient } from '@/lib/supabase/server';
import { CONSENT_WORDING, WORDING_VERSION } from '@/lib/consent-wording';

export interface SignUpResult {
  ok: boolean;
  message: string;
  /** Set on success so the form can sign in with the password just chosen. */
  email?: string;
}

const TERMS_WORDING = {
  en: 'I accept the Konekt terms of use and have read the privacy notice.',
  sw: 'Nakubali masharti ya matumizi ya Konekt na nimesoma taarifa ya faragha.',
};

/**
 * Create a member account.
 *
 * The auth user is created server-side with the service key rather than by
 * `signUp` in the browser, for one reason: `signUp` leaves the account
 * unusable until a confirmation email arrives, and this project has no SMTP
 * configured yet. An account that cannot be signed into is not an account.
 *
 * What that costs is honest and recorded: the email address is not proven, so
 * the member row lands with `phone_verified_at` null and the platform treats
 * the person as unverified until a phone OTP says otherwise. Phone is the
 * identity in this schema — one verified phone, one member — and this form
 * does not pretend to have established it.
 *
 * Consent is written as records, not as a boolean on the member: terms and
 * privacy as one accepted record, marketing only if separately ticked, each
 * storing the exact words shown. `konekt.may_contact` reads those records on
 * every send, so an unticked box here is a refusal everywhere else.
 */
export async function registerMember(_prev: SignUpResult, form: FormData): Promise<SignUpResult> {
  const supabase = getServiceClient();
  if (!supabase) {
    return { ok: false, message: 'No database is attached to this deployment yet.' };
  }

  const fullName = String(form.get('full_name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const phone = String(form.get('phone_e164') ?? '').replace(/[\s-]/g, '');
  const password = String(form.get('password') ?? '');
  const locale = String(form.get('locale') ?? 'en') === 'sw' ? 'sw' : 'en';
  const dob = String(form.get('date_of_birth') ?? '').trim();
  const acceptsTerms = form.get('accepts_terms') === 'on';
  const acceptsMarketing = form.get('accepts_marketing') === 'on';

  if (!fullName) return { ok: false, message: 'Tell us your name.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: 'That does not look like an email address.' };
  }
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
    return {
      ok: false,
      message: 'Enter your phone in international form, like +255712345678. It is how Konekt knows you.',
    };
  }
  if (password.length < 8) {
    return { ok: false, message: 'Use at least 8 characters for your password.' };
  }
  if (!acceptsTerms) {
    return { ok: false, message: 'You have to accept the terms of use to create an account.' };
  }

  // Phone first: it is the unique identity, and finding out it is taken after
  // creating an auth user would leave an orphaned login behind.
  const { data: existing } = await supabase
    .from('members' as never)
    .select('id')
    .eq('phone_e164', phone)
    .maybeSingle();

  if (existing) {
    return { ok: false, message: 'That phone number already has a Konekt account. Sign in instead.' };
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    phone,
    email_confirm: true,
    user_metadata: { full_name: fullName, locale },
  });

  if (createError || !created?.user) {
    const message = createError?.message ?? 'Could not create the account.';
    return {
      ok: false,
      message: /already/i.test(message)
        ? 'That email already has an account. Sign in instead.'
        : message,
    };
  }

  const userId = created.user.id;

  const { data: member, error: memberError } = await supabase
    .from('members' as never)
    .insert({
      auth_user_id: userId,
      phone_e164: phone,
      full_name: fullName,
      email,
      locale,
      date_of_birth: dob || null,
    } as never)
    .select('id')
    .single();

  if (memberError) {
    // Nothing half-made is left behind: without a member row the login is a
    // dead end, so the auth user goes with it.
    await supabase.auth.admin.deleteUser(userId);
    return { ok: false, message: memberError.message };
  }

  const memberId = (member as unknown as { id: string }).id;

  const consents: Record<string, unknown>[] = [
    {
      member_id: memberId,
      purpose: 'terms_of_use',
      channel: null,
      granted: true,
      wording_shown: TERMS_WORDING[locale],
      wording_locale: locale,
      wording_version: WORDING_VERSION,
      source: 'web_registration',
    },
  ];

  if (acceptsMarketing) {
    consents.push({
      member_id: memberId,
      purpose: 'marketing',
      channel: 'sms',
      granted: true,
      wording_shown: CONSENT_WORDING['marketing:sms'][locale],
      wording_locale: locale,
      wording_version: WORDING_VERSION,
      // Never 'terms_acceptance': the database rejects marketing consent that
      // claims to have come from accepting terms, and rightly.
      source: 'web_registration',
    });
  }

  await supabase.from('consent_records' as never).insert(consents as never);

  return { ok: true, message: 'Account created.', email };
}
