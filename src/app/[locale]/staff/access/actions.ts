'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient, getServiceClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';
import {
  accessCodeEmail, generateCode, isAccessCode, normaliseCode,
} from '@/lib/access-code';

export interface ActionResult {
  ok: boolean;
  message: string;
  /** The code, echoed back once so HQ can read it out immediately. */
  code?: string;
}

const LEVELS = new Set(['hq', 'zone', 'branch', 'field_agent']);

function text(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Issue a code.
 *
 * HQ only, checked here and again by the policy on the table. This one runs
 * under the user's own session precisely so the policy is the thing that
 * decides — a service client here would make the `is_hq()` check in this
 * function the only guard, and a guard that lives in one function is a guard
 * somebody removes during a refactor.
 */
export async function issueAccess(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const supabase = await getServerClient();
  const session = await getStaffSession();

  if (!supabase || !session.signedIn) {
    return { ok: false, message: 'Sign in first.' };
  }
  if (session.role !== 'hq') {
    return { ok: false, message: 'Only HQ issues access.' };
  }

  const role = form.get('role');
  if (typeof role !== 'string' || !LEVELS.has(role)) {
    return { ok: false, message: 'Choose what level this code is for.' };
  }

  const label = text(form, 'label');
  const holder = text(form, 'holder_name');
  if (!label || !holder) {
    return { ok: false, message: 'A code needs a label and the name of whoever gets it.' };
  }

  const zone = role === 'zone' ? text(form, 'zone_code') : null;
  const branch = role === 'zone' || role === 'hq' ? null : text(form, 'branch_id');

  if (role === 'zone' && !zone) {
    return { ok: false, message: 'A zone code needs a zone.' };
  }
  if ((role === 'branch' || role === 'field_agent') && !branch) {
    return { ok: false, message: 'A branch code needs a branch.' };
  }

  const days = Number(form.get('expires_days') ?? 14);
  const expires = Number.isFinite(days) && days > 0
    ? new Date(Date.now() + days * 86_400_000).toISOString()
    : null;

  // Codes are random, so a collision is vanishingly unlikely — but the unique
  // index is what actually decides, and retrying beats surfacing a constraint
  // error to somebody who did nothing wrong.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    const { error } = await supabase
      .from('access_grants' as never)
      .insert({
        code,
        label,
        holder_name: holder,
        holder_phone: text(form, 'holder_phone'),
        note: text(form, 'note'),
        role,
        zone_code: zone,
        branch_id: branch,
        expires_at: expires,
        issued_by: session.staffId,
      } as never);

    if (!error) {
      revalidatePath('/[locale]/staff/access', 'page');
      return { ok: true, message: `Code issued for ${holder}.`, code };
    }
    if (!error.message.includes('duplicate key')) {
      return { ok: false, message: error.message };
    }
  }

  return { ok: false, message: 'Could not find a free code. Try once more.' };
}

/**
 * Revoke a code.
 *
 * If it has been redeemed, the account it created is deactivated in the same
 * breath. `current_staff()` filters on `is_active`, so that account stops
 * resolving to a role on its very next request — nothing else has to be told.
 */
export async function revokeAccess(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const supabase = await getServerClient();
  const session = await getStaffSession();

  if (!supabase || !session.signedIn || session.role !== 'hq') {
    return { ok: false, message: 'Only HQ revokes access.' };
  }

  const id = form.get('grant_id');
  if (typeof id !== 'string') return { ok: false, message: 'Which code?' };

  const { data, error } = await supabase
    .from('access_grants' as never)
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: session.staffId,
      revoked_reason: text(form, 'reason'),
    } as never)
    .eq('id', id)
    .is('revoked_at', null)
    .select('staff_user_id')
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: 'That code was already revoked.' };

  const staffUserId = (data as unknown as { staff_user_id: string | null }).staff_user_id;
  if (staffUserId) {
    const { error: deactivate } = await supabase
      .from('staff_users' as never)
      .update({ is_active: false } as never)
      .eq('id', staffUserId);

    if (deactivate) {
      return {
        ok: false,
        message: `Code revoked, but the account is still active: ${deactivate.message}`,
      };
    }
  }

  revalidatePath('/[locale]/staff/access', 'page');
  return {
    ok: true,
    message: staffUserId
      ? 'Revoked. Whoever was signed in with it loses access on their next request.'
      : 'Revoked before it was ever used.',
  };
}

/**
 * Redeem a code: turn it into an account.
 *
 * This is the one place the service client is right. There is no session yet —
 * the whole point is that the person holding the code has no account — so
 * nothing can be read under their own rights. What guards it instead is the
 * code: it is checked against a row that must be unredeemed, unrevoked and
 * unexpired, and the grant's own `role`, `zone_code` and `branch_id` decide
 * the scope. Nothing the form says about scope is read at all, because the
 * form is filled in by the person being granted access.
 */
export async function redeemAccess(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const admin = getServiceClient();
  if (!admin) {
    return { ok: false, message: 'No database is attached to this deployment.' };
  }

  const raw = form.get('code');
  const passphrase = form.get('passphrase');
  const fullName = form.get('full_name');

  if (typeof raw !== 'string' || !isAccessCode(raw)) {
    return { ok: false, message: 'That is not a Konekt access code.' };
  }
  if (typeof fullName !== 'string' || fullName.trim().length < 2) {
    return { ok: false, message: 'Enter your name, so the audit log can name you.' };
  }
  if (typeof passphrase !== 'string' || passphrase.length < 10) {
    return { ok: false, message: 'Choose a passphrase of at least ten characters.' };
  }

  const code = normaliseCode(raw);

  const { data: row } = await admin
    .from('access_grants' as never)
    .select('id, role, zone_code, branch_id, expires_at, redeemed_at, revoked_at')
    .eq('code', code)
    .maybeSingle();

  const grant = row as unknown as {
    id: string;
    role: 'hq' | 'zone' | 'branch' | 'field_agent';
    zone_code: string | null;
    branch_id: string | null;
    expires_at: string | null;
    redeemed_at: string | null;
    revoked_at: string | null;
  } | null;

  // One message for every way a code can fail, on purpose. Distinguishing
  // "no such code" from "already used" tells someone guessing codes which of
  // their guesses landed.
  const refuse = {
    ok: false,
    message: 'That code cannot be used. Ask HQ to issue a new one.',
  };

  if (!grant) return refuse;
  if (grant.revoked_at || grant.redeemed_at) return refuse;
  if (grant.expires_at && new Date(grant.expires_at) < new Date()) return refuse;

  const email = accessCodeEmail(code);

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: passphrase,
    email_confirm: true,
    user_metadata: { access_code: code, full_name: fullName.trim() },
  });

  if (authError || !created?.user) {
    return { ok: false, message: authError?.message ?? 'Could not create the account.' };
  }

  const { data: staffRow, error: staffError } = await admin
    .from('staff_users' as never)
    .insert({
      auth_user_id: created.user.id,
      email,
      full_name: fullName.trim(),
      role: grant.role,
      zone_code: grant.zone_code,
      branch_id: grant.branch_id,
      is_active: true,
    } as never)
    .select('id')
    .single();

  if (staffError || !staffRow) {
    // Leaving an auth user with no staff row behind would let the code be
    // redeemed a second time into a working account while the first one sits
    // there signing in to nothing.
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, message: staffError?.message ?? 'Could not set up the account.' };
  }

  const staffId = (staffRow as unknown as { id: string }).id;

  const { error: markError } = await admin
    .from('access_grants' as never)
    .update({ redeemed_at: new Date().toISOString(), staff_user_id: staffId } as never)
    .eq('id', grant.id)
    .is('redeemed_at', null);

  if (markError) {
    await admin.from('staff_users' as never).delete().eq('id', staffId);
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, message: markError.message };
  }

  return {
    ok: true,
    message: 'Account ready. Sign in with your code and the passphrase you just chose.',
    code,
  };
}
