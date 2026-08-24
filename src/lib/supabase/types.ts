/**
 * Database types.
 *
 * Hand-written rather than generated, because there is no Supabase project
 * attached to this repository yet. Regenerate once there is:
 *
 *   supabase gen types typescript --project-id <id> --schema konekt \
 *     > src/lib/supabase/types.ts
 *
 * Only the tables the application actually reads are typed. Everything else is
 * reachable through the client untyped, which is the honest state of it — a
 * fabricated full type surface would go stale silently.
 */

export type MembershipTier = 'silver' | 'gold' | 'platinum';

export type ZoneCode =
  | 'CENTRAL' | 'COASTAL' | 'DAR_ES_SALAAM' | 'HIGHLAND'
  | 'LAKE' | 'NORTHERN' | 'SOUTHERN' | 'WESTERN';

export type EventStatus =
  | 'draft' | 'pending_approval' | 'approved'
  | 'published' | 'live' | 'completed' | 'cancelled';

export type RegistrationStatus =
  | 'registered' | 'waitlisted' | 'checked_in' | 'cancelled' | 'no_show';

export type InstitutionKind =
  | 'university' | 'university_college' | 'campus_college'
  | 'university_centre' | 'university_institute' | 'jkt_barracks';

export type GeocodeStatus =
  | 'not_attempted' | 'geocoded_low_confidence'
  | 'geocoded_high_confidence' | 'verified' | 'rejected';

export type StaffRole = 'hq' | 'zone' | 'branch' | 'field_agent';

export type ConsentPurpose =
  | 'terms_of_use' | 'privacy_policy' | 'marketing'
  | 'event_reminders' | 'photo_use';

export type ConsentChannel = 'sms' | 'email' | 'push' | 'whatsapp' | 'phone_call';

export type OpportunityKind =
  | 'job' | 'internship' | 'scholarship' | 'grant' | 'training' | 'competition';

export interface EventRow {
  id: string;
  slug: string;
  title_en: string;
  title_sw: string;
  summary_en: string | null;
  summary_sw: string | null;
  status: EventStatus;
  starts_at: string;
  ends_at: string;
  venue_name: string;
  zone_code: ZoneCode | null;
  capacity: number | null;
  registered_count: number;
  cover_image_path: string | null;
}

export interface MemberRow {
  id: string;
  phone_e164: string;
  full_name: string | null;
  preferred_name: string | null;
  email: string | null;
  locale: 'en' | 'sw';
  tier: MembershipTier | null;
  tier_effective_at: string | null;
  in_grace_period: boolean;
  kyc_verified: boolean;
  referral_code: string;
  is_suppressed: boolean;
}

export interface PostRow {
  id: string;
  slug: string;
  title_en: string;
  title_sw: string;
  excerpt_en: string;
  excerpt_sw: string;
  body_en: string;
  body_sw: string;
  cover_image_path: string | null;
  cover_alt_en: string | null;
  cover_alt_sw: string | null;
  published_at: string | null;
  reading_minutes: number | null;
  is_featured: boolean;
  source_name: string | null;
  source_url: string | null;
  category_id: string | null;
  author_id: string | null;
}

export interface OpportunityRow {
  id: string;
  slug: string;
  kind: OpportunityKind;
  title_en: string;
  title_sw: string;
  organisation: string;
  source_name: string;
  source_url: string | null;
  min_age: number | null;
  max_age: number | null;
  deadline_at: string | null;
  external_url: string | null;
  published_at: string | null;
}

export interface InstitutionRow {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  kind: InstitutionKind;
  zone_code: ZoneCode | null;
  parent_institution_id: string | null;
  ownership: 'public' | 'private' | null;
  barrack_number: string | null;
}

export interface BrandPlacementRow {
  id: string;
  name: string;
  logo_path: string | null;
  logo_svg: string | null;
  website_url: string | null;
  placement: 'landing_strip' | 'events_page' | 'footer';
  display_order: number;
}

/**
 * Minimal shape for the typed client. Supabase's generated type is far larger;
 * this covers what the app reads today and fails loudly at compile time if a
 * query names a table that is not here.
 */
export interface Database {
  konekt: {
    Tables: {
      events: { Row: EventRow; Insert: Partial<EventRow>; Update: Partial<EventRow> };
      members: { Row: MemberRow; Insert: Partial<MemberRow>; Update: Partial<MemberRow> };
      posts: { Row: PostRow; Insert: Partial<PostRow>; Update: Partial<PostRow> };
      opportunities: {
        Row: OpportunityRow;
        Insert: Partial<OpportunityRow>;
        Update: Partial<OpportunityRow>;
      };
      institutions: {
        Row: InstitutionRow;
        Insert: Partial<InstitutionRow>;
        Update: Partial<InstitutionRow>;
      };
      brand_placements: {
        Row: BrandPlacementRow;
        Insert: Partial<BrandPlacementRow>;
        Update: Partial<BrandPlacementRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
