'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface ActionResult {
  ok: boolean;
  message: string;
}

const PLACEMENTS = new Set(['landing_strip', 'events_page', 'footer']);

type Gate =
  | { ok: true; supabase: NonNullable<Awaited<ReturnType<typeof getServerClient>>>;
      session: Awaited<ReturnType<typeof getStaffSession>> }
  | { ok: false; message: string };

async function requireHq(): Promise<Gate> {
  const supabase = await getServerClient();
  if (!supabase) {
    return { ok: false, message: 'No database is attached to this deployment.' };
  }
  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false, message: 'Sign in first.' };
  if (session.role !== 'hq') {
    return { ok: false, message: 'Only an HQ administrator can change the partner strip.' };
  }
  return { ok: true, supabase, session };
}

/**
 * Create or update one partner placement.
 *
 * The rules that matter are the database's, not this function's:
 * `placement_has_a_logo` refuses a row with neither a file nor inline SVG, and
 * `active_placement_is_cleared` refuses to make one live without a named person
 * recorded as having cleared the mark's use. Publishing another company's logo
 * is a legal act, and the constraint is what makes that unavoidable rather than
 * a note in a checklist someone can skip.
 */
export async function savePlacement(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireHq();
  if (!gate.ok) return gate;
  const { supabase, session } = gate;

  const id = String(form.get('id') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  const placement = String(form.get('placement') ?? 'landing_strip');
  const websiteRaw = String(form.get('website_url') ?? '').trim();
  const logoPath = String(form.get('logo_path') ?? '').trim();
  const clearedBy = String(form.get('usage_approved_by') ?? '').trim();
  const isActive = form.get('is_active') === 'on';
  const order = Number(form.get('display_order') ?? 0);

  if (!name) return { ok: false, message: 'A partner needs a name.' };
  if (!PLACEMENTS.has(placement)) return { ok: false, message: 'Unknown placement.' };
  if (websiteRaw && !/^https?:\/\//i.test(websiteRaw)) {
    return { ok: false, message: 'The website must start with http:// or https://' };
  }
  if (!Number.isFinite(order)) return { ok: false, message: 'Order must be a number.' };
  if (isActive && !clearedBy) {
    return {
      ok: false,
      message: 'To publish a partner logo, record who cleared its use. The database will refuse it otherwise.',
    };
  }

  const row: Record<string, unknown> = {
    name,
    placement,
    website_url: websiteRaw || null,
    display_order: order,
    is_active: isActive,
    usage_approved_by: clearedBy || null,
    usage_approved_at: clearedBy ? new Date().toISOString() : null,
  };

  if (logoPath) {
    row.logo_path = logoPath;
    row.uploaded_by = session.staffId;
    row.uploaded_at = new Date().toISOString();
  }

  const query = id
    ? supabase.from('brand_placements' as never).update(row as never).eq('id', id)
    : supabase.from('brand_placements' as never).insert(row as never);

  const { error } = await query;
  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: id ? `Updated ${name}.` : `Added ${name}.` };
}

/** Take a placement off the site without deleting the record or its clearance. */
export async function setPlacementActive(id: string, active: boolean): Promise<ActionResult> {
  const gate = await requireHq();
  if (!gate.ok) return gate;

  const { error } = await gate.supabase
    .from('brand_placements' as never)
    .update({ is_active: active } as never)
    .eq('id', id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: active ? 'Published.' : 'Hidden from the site.' };
}

/**
 * Delete a placement.
 *
 * The row goes; the audit entry stays, because `write_audit` recorded the
 * before-state and `konekt.audit_log` cannot be edited or deleted. Someone can
 * always answer "whose logo was on the site in March, and who put it there".
 */
export async function deletePlacement(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await requireHq();
  if (!gate.ok) return gate;

  const id = String(form.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Nothing to delete.' };

  const { error } = await gate.supabase
    .from('brand_placements' as never)
    .delete()
    .eq('id', id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Removed.' };
}
