'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

export interface MetricResult {
  ok: boolean;
  message: string;
}

async function hqOnly() {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false as const, message: 'No database is attached.' };
  const session = await getStaffSession();
  if (!session.signedIn) return { ok: false as const, message: 'Sign in first.' };
  if (session.role !== 'hq') {
    return { ok: false as const, message: 'Only HQ decides what a category tracks.' };
  }
  return { ok: true as const, supabase };
}

/**
 * Choose what a category tracks.
 *
 * The set is stored rather than coded, because a university and a boda stand
 * do not measure the same things and the list will keep growing. Changing it
 * changes three screens at once — the category's own cards, the filing form
 * every station in it uses, and what the reports can be built from — which is
 * the point: they were three copies of one decision.
 *
 * Nothing is deleted from a report when a metric is switched off. The figures
 * that were already filed stay filed; they simply stop being asked for.
 */
export async function setCategoryMetrics(
  _prev: MetricResult | null,
  form: FormData,
): Promise<MetricResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const categoryId = String(form.get('category_id') ?? '').trim();
  if (!categoryId) return { ok: false, message: 'Which category?' };

  const wanted = form.getAll('metric').map((v) => String(v)).filter(Boolean);

  const { error: clearError } = await gate.supabase
    .from('category_metrics' as never)
    .delete()
    .eq('category_id', categoryId);
  if (clearError) return { ok: false, message: clearError.message };

  if (wanted.length > 0) {
    const { error } = await gate.supabase
      .from('category_metrics' as never)
      .insert(wanted.map((metricId, i) => ({
        category_id: categoryId,
        metric_id: metricId,
        display_order: i,
      })) as never);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: wanted.length === 0
      ? 'This category now tracks nothing. Its stations will have no figures to file.'
      : `Tracking ${wanted.length} ${wanted.length === 1 ? 'figure' : 'figures'}.`,
  };
}

/**
 * Add something new to track.
 *
 * The ten that came with the build are columns on `station_reports`; anything
 * added here is stored per report instead, so a new figure costs a row rather
 * than a migration. That is what makes this something the bank can do on a
 * Tuesday without waiting for a deploy.
 */
export async function addMetric(
  _prev: MetricResult | null,
  form: FormData,
): Promise<MetricResult> {
  const gate = await hqOnly();
  if (!gate.ok) return gate;

  const label = String(form.get('label') ?? '').trim();
  const unit = String(form.get('unit') ?? 'count').trim();
  const categoryId = String(form.get('category_id') ?? '').trim();

  if (label.length < 2) return { ok: false, message: 'Give it a name.' };
  if (!['count', 'money', 'percent'].includes(unit)) {
    return { ok: false, message: 'A figure is a count, an amount of money, or a percentage.' };
  }

  // Derived, never typed: everything already filed is keyed on it.
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (key.length < 2) return { ok: false, message: 'That name has no letters or digits in it.' };

  const { data, error } = await gate.supabase
    .from('metrics' as never)
    .insert({ key, label, unit, help: String(form.get('help') ?? '').trim() || null } as never)
    .select('id')
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message: error.message.includes('duplicate key')
        ? `Something called ${label} is already tracked.`
        : error.message,
    };
  }

  // Added from inside a category, so it starts switched on there — otherwise
  // adding it appears to do nothing.
  const created = (data as unknown as { id: string } | null)?.id;
  if (created && categoryId) {
    await gate.supabase.from('category_metrics' as never).insert({
      category_id: categoryId,
      metric_id: created,
      display_order: 99,
    } as never);
  }

  revalidatePath('/', 'layout');
  return { ok: true, message: `${label} is now tracked here.` };
}
