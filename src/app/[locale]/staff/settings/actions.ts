'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** A code somebody can type: lowercase, underscores, nothing exotic. */
function slug(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

type Kind = 'account' | 'loan';

const TABLE: Record<Kind, string> = {
  account: 'account_products',
  loan: 'loan_products',
};

async function hqOnly() {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false as const, message: 'No database is attached.' };
  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false as const, message: 'Sign in first.' };
  if (session.role !== 'hq') {
    return { ok: false as const, message: 'Only HQ maintains these lists.' };
  }
  return { ok: true as const, supabase, session };
}

/**
 * HQ, or a zone manager acting inside their own zone.
 *
 * A branch is the one structural thing a zone owns outright, so requiring HQ
 * to create one turned "we opened a branch in Geita" into a ticket. Row level
 * security enforces the same rule underneath — this only decides what the
 * screen offers, and a mismatch between the two shows up as a refused write
 * rather than an unauthorised one.
 */
async function hqOrZone() {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false as const, message: 'No database is attached.' };
  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false as const, message: 'Sign in first.' };
  if (session.role !== 'hq' && session.role !== 'zone') {
    return { ok: false as const, message: 'Branches are maintained by HQ and zone managers.' };
  }
  return { ok: true as const, supabase, session };
}

/**
 * Add an account type or a loan type.
 *
 * The code is derived from the name rather than asked for. It is what every
 * historic row is keyed on, so it must never change once anything references
 * it — and a field somebody can edit is a field somebody edits.
 */
export async function addProduct(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const kind = String(form.get('kind') ?? '') as Kind;
  if (kind !== 'account' && kind !== 'loan') return { ok: false, message: 'Which list?' };

  const labelEn = String(form.get('label_en') ?? '').trim();
  const labelSw = String(form.get('label_sw') ?? '').trim() || labelEn;
  if (labelEn.length < 2) return { ok: false, message: 'Give it a name.' };

  const code = slug(labelEn);
  if (!code) return { ok: false, message: 'That name has no letters or digits in it.' };

  const { error } = await gate.supabase
    .from(TABLE[kind] as never)
    .insert({
      code,
      label_en: labelEn,
      label_sw: labelSw,
      is_active: true,
      display_order: 99,
      created_by: gate.session.staffId,
    } as never);

  if (error) {
    return {
      ok: false,
      message: error.message.includes('duplicate key')
        ? `There is already a type coded "${code}".`
        : error.message,
    };
  }

  revalidatePath('/[locale]/staff/settings', 'page');
  return { ok: true, message: `Added ${labelEn}.` };
}

/**
 * Point a type at a category, or back at everybody.
 *
 * A Scholar Account means nothing at a bodaboda stand. Until now every type
 * appeared everywhere, so a branch filing a bodaboda split scrolled past six
 * kinds of account its riders cannot hold — and a list you scroll past is a
 * list you eventually tick the wrong row in.
 */
export async function setProductCategory(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const kind = String(form.get('kind') ?? '') as Kind;
  if (kind !== 'account' && kind !== 'loan') return { ok: false, message: 'Which list?' };

  const code = String(form.get('code') ?? '').trim();
  const category = String(form.get('category_id') ?? '').trim();
  if (!code) return { ok: false, message: 'Which type?' };

  const { error } = await gate.supabase
    .from(TABLE[kind] as never)
    .update({ category_id: category === '' ? null : category } as never)
    .eq('code', code);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: category === '' ? 'Now offered everywhere.' : 'Scoped to that category.',
  };
}

/**
 * Delete a type outright.
 *
 * Retiring is the right move once anything has been filed against a code —
 * the history stays readable. This is for the one somebody added yesterday by
 * mistake, and the database refuses it the moment a report references it.
 */
export async function deleteProduct(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const kind = String(form.get('kind') ?? '') as Kind;
  if (kind !== 'account' && kind !== 'loan') return { ok: false, message: 'Which list?' };

  const code = String(form.get('code') ?? '').trim();
  if (!code) return { ok: false, message: 'Which type?' };

  const { error } = await gate.supabase
    .from(TABLE[kind] as never)
    .delete()
    .eq('code', code);

  if (error) {
    return {
      ok: false,
      message: error.message.includes('violates foreign key')
        ? 'Figures have already been filed against this type. Retire it instead — deleting would make those months unreadable.'
        : error.message,
    };
  }

  revalidatePath('/', 'layout');
  return { ok: true, message: `${code} deleted.` };
}

/**
 * Retire a type, or bring it back.
 *
 * Never a delete. Months already filed reference the code, and removing the
 * row would leave those figures labelled with a code and nothing else.
 * Retiring takes it off the entry form and leaves the history readable.
 */
export async function setProductActive(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const kind = String(form.get('kind') ?? '') as Kind;
  if (kind !== 'account' && kind !== 'loan') return { ok: false, message: 'Which list?' };

  const code = String(form.get('code') ?? '').trim();
  const active = String(form.get('active') ?? '') === 'true';
  if (!code) return { ok: false, message: 'Which type?' };

  const { error } = await gate.supabase
    .from(TABLE[kind] as never)
    .update({ is_active: active } as never)
    .eq('code', code);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/[locale]/staff/settings', 'page');
  return { ok: true, message: active ? 'Back in use.' : 'Retired.' };
}

/**
 * Put a branch in a zone.
 *
 * The CRDB register carries no zone for any branch — §3.2.6 — so this is not a
 * correction to imported data, it is the only place the fact is ever recorded.
 * Until a branch has one, a zone manager cannot reach it and neither can any
 * station reporting through it: `stations.zone_code` is copied from the branch
 * by trigger, and `staff_can_reach` compares against exactly that.
 *
 * Which makes this screen load-bearing rather than administrative. A branch
 * left unzoned is invisible to everyone except HQ and the branch itself.
 */
export async function setBranchZone(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const id = String(form.get('branch_id') ?? '').trim();
  const raw = String(form.get('zone_code') ?? '').trim();
  if (!id) return { ok: false, message: 'Which branch?' };

  const { error } = await gate.supabase
    .from('branches' as never)
    .update({ zone_code: raw === '' ? null : raw } as never)
    .eq('id', id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/[locale]/staff/settings', 'page');
  return {
    ok: true,
    message: raw === '' ? 'Zone cleared.' : 'Saved.',
  };
}

/**
 * Add or edit a branch.
 *
 * The register gave a name and two years and nothing else — no zone, no
 * coordinates. Everything a branch needs beyond its name has to be recorded
 * by somebody, and this is where.
 */
export async function saveBranch(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await hqOrZone();
  if (!gate.ok) return gate;

  const id = String(form.get('branch_id') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  if (name.length < 2) return { ok: false, message: 'Give the branch a name.' };

  const year = (key: string) => {
    const raw = String(form.get(key) ?? '').trim();
    if (raw === '') return null;
    const n = Number(raw);
    // CRDB was founded in 1996 out of the old CRDB (1967); anything before
    // that or after next year is a typo rather than a date.
    return Number.isFinite(n) && n >= 1960 && n <= new Date().getFullYear() + 1
      ? Math.round(n) : null;
  };

  // A zone manager files into their own zone and nowhere else. The form does
  // not offer them the choice; this is what happens if the field is forged.
  const zone = gate.session.role === 'zone'
    ? (gate.session.zone ?? '')
    : String(form.get('zone_code') ?? '').trim();

  if (gate.session.role === 'zone' && zone === '') {
    return { ok: false, message: 'Your account has no zone, so it cannot own a branch.' };
  }

  const payload = {
    name,
    zone_code: zone === '' ? null : zone,
    year_established: year('year_established'),
    year_refurbished: year('year_refurbished'),
    is_active: String(form.get('is_active') ?? 'true') === 'true',
    notes: String(form.get('notes') ?? '').trim() || null,
  };

  const { error } = id
    ? await gate.supabase.from('branches' as never).update(payload as never).eq('id', id)
    : await gate.supabase.from('branches' as never)
        .insert({ ...payload, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') } as never);

  if (error) {
    return {
      ok: false,
      message: error.message.includes('duplicate key')
        ? `There is already a branch called ${name}.`
        : error.message,
    };
  }

  revalidatePath('/', 'layout');
  return { ok: true, message: id ? `${name} saved.` : `${name} added.` };
}

/**
 * Clear the sample data.
 *
 * Everything seeded for the walkthrough carries a marker in `notes`, and this
 * removes exactly those rows: the stations loaded from the register keep their
 * own marker and their own figures are removed with them, so what is left is
 * an empty tracker rather than a half-populated one.
 *
 * Events are cleared before stations because an event's station reference is
 * `on delete set null` rather than a cascade — clearing stations first would
 * strand the demo events with a blank link.
 */
export async function clearDemoData(_prev: ActionResult): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const { error: eventError, count: events } = await gate.supabase
    .from('tracked_events' as never)
    .delete({ count: 'exact' })
    .or('notes.like.DEMO %,notes.like.Loaded from the CRDB register%');
  if (eventError) return { ok: false, message: eventError.message };

  // Reports carry the marker on the row itself, so a station loaded from the
  // register keeps its identity while losing the invented figures.
  const { error: reportError, count: reports } = await gate.supabase
    .from('station_reports' as never)
    .delete({ count: 'exact' })
    .like('note', 'Sample figure%');
  if (reportError) return { ok: false, message: reportError.message };

  const { error: stationError, count: stations } = await gate.supabase
    .from('stations' as never)
    .delete({ count: 'exact' })
    .like('notes', 'DEMO %');
  if (stationError) return { ok: false, message: stationError.message };

  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: `Cleared ${reports ?? 0} sample reports, ${stations ?? 0} sample stations and ${events ?? 0} sample events. Stations loaded from the register are still here, with nothing filed against them.`,
  };
}

/**
 * Add a zone.
 *
 * `zone_code` is an enum twelve tables depend on, so this is the one place in
 * the console where a form causes DDL. It cannot be done in a single
 * statement: Postgres refuses to *use* an enum value in the transaction that
 * added it, so the value is added by one function and the row naming it is
 * written by a second. Both check the HQ role in their own body — the guard
 * is not this file's to keep.
 *
 * The code is derived from the name, never asked for. Every branch, station
 * and grant already filed is keyed on it, so it must not be something a
 * person can retype differently next month.
 */
export async function addZone(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const nameEn = String(form.get('name_en') ?? '').trim();
  const nameSw = String(form.get('name_sw') ?? '').trim() || nameEn;
  if (nameEn.length < 2) return { ok: false, message: 'Give the zone a name.' };

  const code = slug(nameEn).toUpperCase();
  if (code.length < 2) return { ok: false, message: 'That name has no letters or digits in it.' };

  const { error: addError } = await gate.supabase.rpc('zone_add_value' as never, {
    p_code: code,
  } as never);
  if (addError) return { ok: false, message: addError.message };

  const { error: registerError } = await gate.supabase.rpc('zone_register' as never, {
    p_code: code,
    p_name_en: nameEn,
    p_name_sw: nameSw,
  } as never);
  if (registerError) return { ok: false, message: registerError.message };

  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: `${nameEn} added. Put branches in it below — a zone with no branches shows nothing.`,
  };
}

/**
 * Rename a zone.
 *
 * The code never changes — everything filed references it. Only the words
 * people read do.
 */
export async function renameZone(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const code = String(form.get('code') ?? '').trim();
  const nameEn = String(form.get('name_en') ?? '').trim();
  if (!code) return { ok: false, message: 'Which zone?' };
  if (nameEn.length < 2) return { ok: false, message: 'Give the zone a name.' };

  const { error } = await gate.supabase
    .from('zones' as never)
    .update({ name_en: nameEn, name_sw: String(form.get('name_sw') ?? '').trim() || nameEn } as never)
    .eq('code', code);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Renamed.' };
}
