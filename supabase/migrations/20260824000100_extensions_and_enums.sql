-- =============================================================================
-- CRDB KONEKT — 0001  Extensions, enums and shared helpers
-- =============================================================================
-- Runs on Supabase (Postgres 15+ with PostGIS available) and on a plain
-- PostGIS 16 instance for local verification.
--
-- Standing rules encoded structurally rather than left to application code:
--   * distance is never computed in application code — geography(Point,4326)
--   * source attribution on an opened account is NOT NULL
--   * no role can override the suppression list
--   * marketing consent is a separate record, never bundled into terms
--   * Konekt stores a kyc_verified boolean, never an identity document
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "postgis";
create extension if not exists "citext";

-- Supabase provides these; on a bare instance they are created so the
-- migrations run unmodified for local verification.
create schema if not exists konekt;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- Zones are a fixed set of 8, not free text (§3.2.4). Modelled as an enum so a
-- typo cannot invent a ninth zone, and mirrored into a table for display order.
create type konekt.zone_code as enum (
  'CENTRAL',
  'COASTAL',
  'DAR_ES_SALAAM',
  'HIGHLAND',
  'LAKE',
  'NORTHERN',
  'SOUTHERN',
  'WESTERN'
);

-- §3.2.2 — the TCU AFFILIATION column, parsed.
create type konekt.affiliation_type as enum (
  'campus_college',
  'university_college',
  'university_centre',
  'university_institute'
);

create type konekt.ownership as enum ('public', 'private');

-- §3.2.3 — real values from the register. Provisional-licence institutions may
-- need different treatment in partnership workflows; that decision is open, so
-- the status is stored faithfully rather than collapsed to a boolean.
create type konekt.accreditation_status as enum (
  'accredited_and_chartered',
  'accredited',
  'provisional_licence',
  'full_registration_and_chartered',
  'full_registration',
  'per_mother_institution'
);

create type konekt.institution_kind as enum (
  'university',
  'university_college',
  'campus_college',
  'university_centre',
  'university_institute',
  'jkt_barracks'
);

-- §3.2.5 — no supplied record has coordinates. Every location starts life
-- unverified and may not appear on a public map until a human confirms it.
create type konekt.geocode_status as enum (
  'not_attempted',
  'geocoded_low_confidence',
  'geocoded_high_confidence',
  'verified',
  'rejected'
);

create type konekt.event_status as enum (
  'draft',
  'pending_approval',
  'approved',
  'published',
  'live',
  'completed',
  'cancelled'
);

create type konekt.registration_status as enum (
  'registered',
  'waitlisted',
  'checked_in',
  'cancelled',
  'no_show'
);

create type konekt.membership_tier as enum ('silver', 'gold', 'platinum');

create type konekt.staff_role as enum (
  'hq',
  'zone',
  'branch',
  'field_agent'
);

create type konekt.consent_channel as enum (
  'sms',
  'email',
  'push',
  'whatsapp',
  'phone_call'
);

create type konekt.consent_purpose as enum (
  'terms_of_use',
  'privacy_policy',
  'marketing',
  'event_reminders',
  'photo_use'
);

create type konekt.opportunity_kind as enum (
  'job',
  'internship',
  'scholarship',
  'grant',
  'training',
  'competition'
);

create type konekt.education_level as enum (
  'secondary',
  'certificate',
  'diploma',
  'undergraduate',
  'postgraduate',
  'any'
);

create type konekt.sponsorship_status as enum (
  'submitted',
  'triaged',
  'under_review',
  'due_diligence',
  'approved',
  'declined',
  'withdrawn'
);

create type konekt.account_product as enum (
  'junior_jumbo',
  'teen_account',
  'scholar_account',
  'malkia_account',
  'personal_current',
  'sme_account',
  'other'
);

-- -----------------------------------------------------------------------------
-- Shared trigger helpers
-- -----------------------------------------------------------------------------

create or replace function konekt.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Rows that must never be edited or deleted once written: consent records and
-- the audit log. Enforced by trigger so no role, including service_role, can
-- quietly rewrite history through the API.
create or replace function konekt.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'ROW IS IMMUTABLE: % on %.% is not permitted',
    tg_op, tg_table_schema, tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

comment on function konekt.forbid_mutation() is
  'Blocks UPDATE and DELETE. Applied to consent records and the audit log, '
  'which must reproduce exactly what happened at the time it happened.';
