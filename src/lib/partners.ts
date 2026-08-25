import type { Placement } from '@/components/home/PartnerStrip';
import { getPublicClient } from '@/lib/supabase/server';
import { supabaseUrl } from '@/lib/supabase/config';

/**
 * The partner ecosystem the membership framework names.
 *
 * Every one of these is marked indicative and pending Marketing and Legal
 * sign-off, because that is what the framework says they are. None of their
 * logos ships: a partner's mark is their trademark and this build has not been
 * given any of them, so the strip renders typographic plates instead of drawn
 * approximations.
 *
 * Once Supabase is attached this list is replaced by konekt.brand_placements,
 * where a logo cannot go live without a named person recording that its use
 * was cleared.
 */
export const INDICATIVE_PARTNERS: Placement[] = [
  { name: 'Bolt', category: 'Transport' },
  { name: 'Air Tanzania', category: 'Travel' },
  { name: 'Campus WiFi', category: 'Connectivity' },
  { name: 'Golf Tanzania', category: 'Sport' },
  { name: 'Tourism operators', category: 'Travel' },
  { name: 'Barbershops & beauty', category: 'Lifestyle' },
  { name: 'Retail partners', category: 'Discounts' },
];

/**
 * What the landing strip should show.
 *
 * The uploaded placements win when there are any: an administrator who has
 * added a partner and recorded who cleared its mark has said something
 * definite, and the committed indicative list is what stands in until they do.
 * Falling back rather than showing an empty strip is deliberate — the strip is
 * labelled indicative either way, so the honest state is preserved.
 */
export async function getLandingPlacements(): Promise<Placement[]> {
  const supabase = getPublicClient();
  if (!supabase) return INDICATIVE_PARTNERS;

  const { data } = await supabase
    .from('brand_placements' as never)
    .select('name, logo_path, logo_svg, website_url')
    .eq('placement', 'landing_strip')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  const rows = (data as unknown as {
    name: string;
    logo_path: string | null;
    logo_svg: string | null;
    website_url: string | null;
  }[]) ?? [];

  if (rows.length === 0) return INDICATIVE_PARTNERS;

  return rows.map((row) => ({
    name: row.name,
    // The category is the strip's own label for a plate. An uploaded partner
    // has a logo instead, so it does not need one.
    category: '',
    logoSvg: row.logo_svg,
    logoPath: row.logo_path,
    websiteUrl: row.website_url,
  }));
}

/**
 * Public URL for an uploaded partner logo.
 *
 * The bucket is public, so this is a plain path rather than a signed URL: a
 * logo on a landing page is not a secret, and signing it would put an
 * expiring URL into a statically rendered page.
 */
export function partnerLogoUrl(path: string) {
  return `${supabaseUrl}/storage/v1/object/public/partner-logos/${path}`;
}
