import { getServerClient } from '@/lib/supabase/server';
import { ZONE_CODES, zoneWording } from '@/lib/access-scope';

export interface ZoneOption {
  code: string;
  label: string;
}

/**
 * The zones, from the database.
 *
 * They used to be a constant in the bundle, which meant a ninth zone needed a
 * deployment. They are a table now, and this is the only place that reads it.
 * The constant survives as the fallback for the one case that matters: a
 * render with no database attached still has to show a working form rather
 * than an empty select.
 */
export async function getZones(): Promise<ZoneOption[]> {
  const fallback = ZONE_CODES.map((code) => ({ code, label: zoneWording(code) }));

  const supabase = await getServerClient();
  if (!supabase) return fallback;

  const { data } = await supabase
    .from('zones' as never)
    .select('code, name_en')
    .order('display_order', { ascending: true })
    .limit(200);

  const rows = (data as unknown as { code: string; name_en: string }[]) ?? [];
  if (rows.length === 0) return fallback;

  return rows.map((z) => ({ code: z.code, label: z.name_en || zoneWording(z.code) }));
}
