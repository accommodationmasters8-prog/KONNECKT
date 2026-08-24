import type { Placement } from '@/components/home/PartnerStrip';

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
