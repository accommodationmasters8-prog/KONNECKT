'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface ActionResult {
  ok: boolean;
  message: string;
  slug?: string;
}

const COLOURS = new Set(['teal', 'green', 'gold', 'pink', 'ink']);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

async function hqOnly() {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false as const, message: 'No database is attached.' };
  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false as const, message: 'Sign in first.' };
  if (session.role !== 'hq') {
    return { ok: false as const, message: 'Only HQ adds categories.' };
  }
  return { ok: true as const, supabase, session };
}

/**
 * Add a category.
 *
 * The member noun is asked for rather than defaulted to "people", because it
 * is the word every screen in the category uses — "3,400 students without an
 * account" reads as a finding, "3,400 people without an account" reads as a
 * database. Getting it wrong is not fatal but it is everywhere.
 */
export async function createCategory(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const nameEn = String(form.get('name_en') ?? '').trim();
  const nameSw = String(form.get('name_sw') ?? '').trim() || nameEn;
  const nounEn = String(form.get('member_noun_en') ?? '').trim() || 'people';
  const nounSw = String(form.get('member_noun_sw') ?? '').trim() || nounEn;
  const colour = String(form.get('colour') ?? 'teal');
  const description = String(form.get('description') ?? '').trim() || null;

  if (nameEn.length < 2) return { ok: false, message: 'Give the category a name.' };
  if (!COLOURS.has(colour)) return { ok: false, message: 'Pick one of the brand colours.' };

  const slug = slugify(nameEn);
  if (!slug) return { ok: false, message: 'That name has no letters or digits in it.' };

  const { error } = await gate.supabase
    .from('tracker_categories' as never)
    .insert({
      slug,
      name_en: nameEn,
      name_sw: nameSw,
      member_noun_en: nounEn,
      member_noun_sw: nounSw,
      colour,
      description,
      is_active: true,
      display_order: 99,
    } as never);

  if (error) {
    return {
      ok: false,
      message: error.message.includes('duplicate key')
        ? `There is already a category at "${slug}".`
        : error.message,
    };
  }

  revalidatePath('/[locale]/staff/categories', 'page');
  return { ok: true, message: `Added ${nameEn}.`, slug };
}

/**
 * Add a loan type inside a category.
 *
 * Scoped rather than national: a student loan means nothing at a SACCOS and a
 * group loan means nothing on a campus, so a single list makes every branch
 * scroll past kinds of loan their station cannot issue. A type added here
 * appears only for stations in this category; the eight seeded types have no
 * category and stay available everywhere.
 */
export async function addCategoryLoanType(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const categoryId = String(form.get('category_id') ?? '').trim();
  const labelEn = String(form.get('label_en') ?? '').trim();
  const labelSw = String(form.get('label_sw') ?? '').trim() || labelEn;

  if (!categoryId) return { ok: false, message: 'Which category?' };
  if (labelEn.length < 2) return { ok: false, message: 'Give the loan type a name.' };

  const code = slugify(labelEn).replace(/-/g, '_');
  if (!code) return { ok: false, message: 'That name has no letters or digits in it.' };

  const { error } = await gate.supabase
    .from('loan_products' as never)
    .insert({
      code,
      label_en: labelEn,
      label_sw: labelSw,
      category_id: categoryId,
      is_active: true,
      display_order: 99,
      created_by: gate.session.staffId,
    } as never);

  if (error) {
    return {
      ok: false,
      message: error.message.includes('duplicate key')
        ? `There is already a loan type coded "${code}".`
        : error.message,
    };
  }

  revalidatePath('/[locale]/staff/categories/[slug]', 'page');
  return { ok: true, message: `Added ${labelEn}.` };
}

/**
 * Remove a category.
 *
 * Stations cascade from it, and their reports cascade from them, so this can
 * take away years of filed figures in one statement. The name has to be typed
 * back and the console states the station count first — a confirmation nobody
 * reads is a confirmation that is not there.
 */
export async function deleteCategory(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const id = String(form.get('category_id') ?? '').trim();
  const typed = String(form.get('confirm_name') ?? '').trim();
  const expected = String(form.get('expected_name') ?? '').trim();

  if (!id) return { ok: false, message: 'Which category?' };
  if (typed.toLowerCase() !== expected.toLowerCase()) {
    return { ok: false, message: 'Type the category name exactly to remove it.' };
  }

  // The count the screen showed when they typed the name. If it has changed
  // since, somebody added stations while they were reading and the delete
  // stops rather than taking more than was agreed to.
  const expectedStations = Number(form.get('expected_stations') ?? 0);

  const { data, error } = await gate.supabase.rpc('delete_category' as never, {
    p_id: id,
    p_expected_stations: Number.isFinite(expectedStations) ? expectedStations : 0,
  } as never);

  if (error) {
    return {
      ok: false,
      message: error.message.includes('violates foreign key')
        ? 'Something outside this category still points at it. Nothing was deleted.'
        : error.message,
    };
  }

  const result = (data as unknown as
    { name: string; stations: number; reports: number }) ?? null;

  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: result
      ? `${result.name} removed, along with ${result.stations} stations and ${result.reports} filed reports. Loan and account types that were scoped to it are now offered everywhere.`
      : `${expected} removed.`,
  };
}
