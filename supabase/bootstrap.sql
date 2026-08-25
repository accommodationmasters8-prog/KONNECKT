-- =============================================================================
-- CRDB KONEKT — full schema, generated from supabase/migrations by
-- scripts/db/bootstrap.mjs. Do not edit: edit a migration and regenerate.
--
-- Run it once against a new project:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/bootstrap.sql
-- or paste it into the Supabase SQL editor.
--
-- Then seed the CRDB register:
--   DATABASE_URL=... npm run db:seed
-- =============================================================================

create extension if not exists postgis;


-- =============================================================================
-- 20260824000100_extensions_and_enums.sql
-- =============================================================================
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


-- =============================================================================
-- 20260824000200_geography.sql
-- =============================================================================
-- =============================================================================
-- CRDB KONEKT — 0002  Geography, branches and institutions
-- =============================================================================
-- The four schema corrections the real CRDB data forces (§3.2) are all here:
--   1. a branch relationship is coordinating + supporting, not "nearest"
--   2. institutions nest under a mother institution
--   3. institutions carry ownership and accreditation status
--   4. zones are a fixed set of 8, seeded as a table
-- Plus the fifth thing the data forces: nothing has coordinates, so geocoding
-- is a first-class workflow with a human verification gate, not a script.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Zones — display metadata for the fixed enum.
-- -----------------------------------------------------------------------------
create table konekt.zones (
  code          konekt.zone_code primary key,
  name_en       text not null,
  name_sw       text not null,
  display_order smallint not null,
  created_at    timestamptz not null default now(),
  unique (display_order)
);

comment on table konekt.zones is
  'The eight CRDB zones. Fixed set — new rows require a migration, because a '
  'ninth zone is an organisational change, not a data entry.';

-- -----------------------------------------------------------------------------
-- Administrative geography.
--
-- Region / district / ward is the only location information the supplied
-- register contains. It is the input to geocoding and it stays as the
-- authoritative address even after coordinates are resolved.
-- -----------------------------------------------------------------------------
create table konekt.regions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  zone_code  konekt.zone_code references konekt.zones(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column konekt.regions.zone_code is
  'Nullable on purpose. The supplied branch register carries no zone at all, '
  'and one region in the institution list (SUMBAWANGA) is disputed — see '
  'docs/OPEN-ITEMS.md. An unknown zone is recorded as unknown, not guessed.';

create table konekt.districts (
  id         uuid primary key default gen_random_uuid(),
  region_id  uuid not null references konekt.regions(id) on delete restrict,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_id, name)
);

create table konekt.wards (
  id          uuid primary key default gen_random_uuid(),
  district_id uuid not null references konekt.districts(id) on delete restrict,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (district_id, name)
);

-- -----------------------------------------------------------------------------
-- Locations — the single geocoding surface.
--
-- Branches, institutions and event venues all point at a location. Geocoding,
-- confidence and human verification are solved once, here, rather than three
-- times with three sets of bugs.
-- -----------------------------------------------------------------------------
create table konekt.locations (
  id             uuid primary key default gen_random_uuid(),

  street         text,
  ward_id        uuid references konekt.wards(id) on delete set null,
  district_id    uuid references konekt.districts(id) on delete set null,
  region_id      uuid references konekt.regions(id) on delete set null,

  -- geography, not two float columns. Distance is a PostGIS problem.
  point          geography(Point, 4326),

  geocode_status konekt.geocode_status not null default 'not_attempted',
  geocode_source text,
  geocode_confidence numeric(4,3)
    check (geocode_confidence is null
           or (geocode_confidence >= 0 and geocode_confidence <= 1)),
  geocoded_at    timestamptz,

  verified_by    uuid,
  verified_at    timestamptz,
  verification_note text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- A point without a status, or a verified status without a point, are both
  -- states that put a wrong pin in front of a customer.
  constraint location_point_requires_status check (
    point is null or geocode_status <> 'not_attempted'
  ),
  constraint verified_location_has_point check (
    geocode_status <> 'verified' or point is not null
  ),
  constraint verified_location_has_verifier check (
    geocode_status <> 'verified' or (verified_by is not null and verified_at is not null)
  )
);

comment on table konekt.locations is
  'Every mappable thing points here. No supplied record had coordinates, so '
  'rows start at not_attempted and only reach verified when a branch officer '
  'confirms the pin.';

-- The public map reads through this view and only this view. A pin that has
-- not been verified by a human cannot leak onto a customer-facing map, whatever
-- the application layer does.
create view konekt.verified_locations as
  select id, street, ward_id, district_id, region_id, point
  from konekt.locations
  where geocode_status = 'verified' and point is not null;

comment on view konekt.verified_locations is
  'The only source a public map may read. Enforces "never place an unverified '
  'pin on the map" in the database rather than in a component.';

create index locations_point_gix on konekt.locations using gist (point);
create index locations_status_ix on konekt.locations (geocode_status);
create index locations_region_ix on konekt.locations (region_id);

-- -----------------------------------------------------------------------------
-- Branches
-- -----------------------------------------------------------------------------
create table konekt.branches (
  id                uuid primary key default gen_random_uuid(),
  -- The register's own serial number, kept so a row can always be traced back
  -- to the file CRDB supplied.
  register_sn       integer unique,
  name              text not null,
  slug              text not null unique,
  location_id       uuid references konekt.locations(id) on delete set null,
  zone_code         konekt.zone_code references konekt.zones(code),

  -- The register gives these as free text: "1990", "Q2 - 2021", "Q3 - Aug. 2024".
  -- Both the parsed year and the original string are kept; the string is what
  -- CRDB will recognise if it ever needs checking.
  year_established        smallint,
  year_established_raw    text,
  year_refurbished        smallint,
  year_refurbished_raw    text,

  is_mobile         boolean not null default false,
  is_active         boolean not null default true,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on column konekt.branches.zone_code is
  'Nullable. The supplied branch register has no zone column (§3.2.6); zones '
  'are assigned during the geocoding pass, not invented at seed time.';

comment on column konekt.branches.is_mobile is
  'The register contains mobile units ("MOBILE 4 - Itigi"). They serve real '
  'customers but they do not have a fixed pin, so they are flagged rather than '
  'geocoded.';

create index branches_zone_ix on konekt.branches (zone_code);
create index branches_location_ix on konekt.branches (location_id);

-- -----------------------------------------------------------------------------
-- Institutions
--
-- Universities, colleges, campuses, centres and JKT barracks are one table.
-- They share the same relationships to branches and the same map behaviour;
-- splitting them would mean writing every query twice.
-- -----------------------------------------------------------------------------
create table konekt.institutions (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  short_name            text,
  slug                  text not null unique,
  kind                  konekt.institution_kind not null,

  -- §3.2.2 — institutions nest. Nine were expected; the register carries 20.
  parent_institution_id uuid references konekt.institutions(id) on delete restrict,
  affiliation_type      konekt.affiliation_type,
  affiliation_raw       text,

  -- §3.2.3 — real fields, not derived.
  ownership             konekt.ownership,
  accreditation_status  konekt.accreditation_status,
  year_established      smallint,

  -- §3.2.1 — a branch relationship is coordinating + supporting, never
  -- "nearest". The coordinating branch owns the relationship.
  coordinating_branch_id uuid references konekt.branches(id) on delete set null,

  location_id           uuid references konekt.locations(id) on delete set null,
  zone_code             konekt.zone_code references konekt.zones(code),

  -- JKT records carry a barrack number; universities do not.
  barrack_number        text,

  head_office           text,
  is_active             boolean not null default true,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint child_institution_has_affiliation check (
    (parent_institution_id is null and affiliation_type is null)
    or (parent_institution_id is not null and affiliation_type is not null)
  ),
  constraint barracks_have_a_number check (
    kind <> 'jkt_barracks' or barrack_number is not null
  ),
  constraint institution_is_not_its_own_parent check (
    parent_institution_id is null or parent_institution_id <> id
  )
);

comment on constraint child_institution_has_affiliation on konekt.institutions is
  'A parent without an affiliation type, or the reverse, is a half-migrated '
  'row. Reporting rolls campuses up by these two columns together.';

create index institutions_parent_ix on konekt.institutions (parent_institution_id);
create index institutions_zone_ix on konekt.institutions (zone_code);
create index institutions_branch_ix on konekt.institutions (coordinating_branch_id);
create index institutions_kind_ix on konekt.institutions (kind);

-- §3.2.1 — supporting branches are many-to-many. JKT records list several.
create table konekt.institution_supporting_branches (
  institution_id uuid not null references konekt.institutions(id) on delete cascade,
  branch_id      uuid not null references konekt.branches(id) on delete cascade,
  note           text,
  created_at     timestamptz not null default now(),
  primary key (institution_id, branch_id)
);

comment on table konekt.institution_supporting_branches is
  'Supporting branches. Distinct from institutions.coordinating_branch_id: a '
  'JKT barracks has one coordinating branch and one or more supporting ones.';

-- Rolls campuses up to their mother institution so national and zone reports
-- cannot double-count. The register nests exactly one level deep today, but
-- the recursion costs nothing and means a second level will not silently
-- produce wrong totals.
create or replace view konekt.institution_rollup as
  with recursive tree as (
    select id, id as root_id, name, kind, zone_code, 0 as depth
    from konekt.institutions
    where parent_institution_id is null
    union all
    select c.id, t.root_id, c.name, c.kind, c.zone_code, t.depth + 1
    from konekt.institutions c
    join tree t on c.parent_institution_id = t.id
  )
  select
    t.id            as institution_id,
    t.root_id       as mother_institution_id,
    t.depth,
    (t.depth = 0)   as is_mother,
    t.zone_code
  from tree t;

comment on view konekt.institution_rollup is
  'institution_id -> mother_institution_id. Count is_mother to avoid '
  'double-counting campuses; count every row for physical presence.';

-- -----------------------------------------------------------------------------
-- Updated-at triggers
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'regions', 'districts', 'wards', 'locations', 'branches', 'institutions'
  ] loop
    execute format(
      'create trigger %I_touch before update on konekt.%I
       for each row execute function konekt.touch_updated_at()', t, t);
  end loop;
end $$;


-- =============================================================================
-- 20260824000300_people_and_consent.sql
-- =============================================================================
-- =============================================================================
-- CRDB KONEKT — 0003  Members, staff, consent and audit
-- =============================================================================
-- Konekt is not a KYC system. It stores a kyc_verified boolean sourced from
-- core banking and never a NIDA number, an ID image or an identity document.
-- There is deliberately no column to put one in.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Members
-- -----------------------------------------------------------------------------
create table konekt.members (
  id                uuid primary key default gen_random_uuid(),

  -- Supabase auth user. Nullable because a member can be created by a field
  -- agent at an event before they ever sign in.
  auth_user_id      uuid unique,

  -- Phone is the identity here. One verified phone, one member.
  phone_e164        text not null unique
                      check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz,

  full_name         text,
  preferred_name    text,
  email             citext unique,
  date_of_birth     date,
  locale            text not null default 'sw' check (locale in ('en', 'sw')),

  home_region_id    uuid references konekt.regions(id) on delete set null,
  institution_id    uuid references konekt.institutions(id) on delete set null,

  -- --- Values consumed from core banking, never computed here ---------------
  -- Tier is calculated by CRDB from transaction counts, balances and credit
  -- standing. Konekt reads it. There is no code path in this database that
  -- writes a tier from banking data, because Konekt must not hold that data.
  tier              konekt.membership_tier,
  tier_source       text not null default 'core_banking',
  tier_effective_at timestamptz,
  tier_expires_at   timestamptz,
  in_grace_period   boolean not null default false,

  -- The whole of what Konekt knows about identity verification.
  kyc_verified      boolean not null default false,
  kyc_verified_at   timestamptz,

  referral_code     text not null unique,
  referred_by_member_id uuid references konekt.members(id) on delete set null,

  -- Global suppression. No role can override this — see the policies in 0006
  -- and the send-eligibility function below.
  is_suppressed     boolean not null default false,
  suppressed_at     timestamptz,
  suppressed_reason text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint tier_is_never_locally_computed
    check (tier_source in ('core_banking', 'migration', 'manual_override')),
  constraint suppression_is_timestamped
    check (is_suppressed = false or suppressed_at is not null),
  constraint no_self_referral
    check (referred_by_member_id is null or referred_by_member_id <> id)
);

comment on table konekt.members is
  'Konekt member records. Deliberately contains no NIDA number, no ID image '
  'and no identity document — only a kyc_verified flag sourced from core '
  'banking. Do not add one.';

comment on column konekt.members.tier is
  'Consumed from core banking over the reconciliation feed. Never calculated '
  'in this database. Nullable: a member with no tier yet is a normal state.';

comment on column konekt.members.date_of_birth is
  'Used only to gate age-restricted flows. Membership tiers are 18-35, but '
  'events and account opening reach under-18s through Junior Jumbo, Teen and '
  'Scholar accounts, so guardian consent still applies below 18.';

create index members_tier_ix on konekt.members (tier);
create index members_region_ix on konekt.members (home_region_id);
create index members_institution_ix on konekt.members (institution_id);
create index members_referrer_ix on konekt.members (referred_by_member_id);

-- Age is derived, never stored as a number that silently goes stale.
create or replace function konekt.member_age(p_dob date)
returns integer
language sql
immutable
as $$
  select case
    when p_dob is null then null
    else extract(year from age(current_date, p_dob))::integer
  end;
$$;

create or replace function konekt.member_is_minor(p_member_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(konekt.member_age(date_of_birth) < 18, false)
  from konekt.members where id = p_member_id;
$$;

-- -----------------------------------------------------------------------------
-- Guardian consent for under-18s
-- -----------------------------------------------------------------------------
create table konekt.guardian_consents (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references konekt.members(id) on delete cascade,
  guardian_name  text not null,
  guardian_phone_e164 text not null
                   check (guardian_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  relationship   text not null,
  -- What the guardian was actually shown, stored verbatim.
  wording_shown  text not null,
  wording_locale text not null check (wording_locale in ('en', 'sw')),
  granted_for    konekt.consent_purpose[] not null,
  captured_by_staff_id uuid,
  captured_at    timestamptz not null default now(),
  revoked_at     timestamptz
);

comment on table konekt.guardian_consents is
  'Required before photo upload or any marketing flag on a member under 18. '
  'Stores the exact wording the guardian was shown, in the language they were '
  'shown it.';

-- -----------------------------------------------------------------------------
-- Consent records
--
-- Immutable. Consent is a claim about what happened at a moment in time; a
-- consent row that can be edited proves nothing. Withdrawal is a new row, not
-- an update.
-- -----------------------------------------------------------------------------
create table konekt.consent_records (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references konekt.members(id) on delete cascade,

  purpose        konekt.consent_purpose not null,
  channel        konekt.consent_channel,
  granted        boolean not null,

  -- The exact text shown, and the language it was shown in. Reproducing a
  -- consent means reproducing the words, not a version number that may since
  -- have been edited.
  wording_shown  text not null,
  wording_locale text not null check (wording_locale in ('en', 'sw')),
  wording_version text not null,

  -- Where the consent came from: 'web_registration', 'field_agent_tablet',
  -- 'member_consent_centre', 'sms_stop'.
  source         text not null,
  source_detail  text,
  ip_address     inet,
  user_agent     text,

  captured_at    timestamptz not null default now(),

  -- Marketing consent must be a separate, unticked checkbox — never bundled
  -- into terms acceptance. A row asserting both at once is rejected outright.
  constraint marketing_is_never_bundled_with_terms check (
    not (purpose = 'marketing' and source = 'terms_acceptance')
  )
);

comment on table konekt.consent_records is
  'Append-only. UPDATE and DELETE are blocked by trigger. Withdrawing consent '
  'writes a new row with granted = false; it never edits the original, because '
  'the original is the evidence that consent was given.';

create index consent_member_purpose_ix
  on konekt.consent_records (member_id, purpose, captured_at desc);

create trigger consent_records_immutable
  before update or delete on konekt.consent_records
  for each row execute function konekt.forbid_mutation();

-- Current state per member and purpose: the most recent row wins.
create or replace view konekt.consent_current as
  select distinct on (member_id, purpose, channel)
    member_id, purpose, channel, granted, captured_at, wording_version
  from konekt.consent_records
  order by member_id, purpose, channel, captured_at desc;

-- The single question every send has to ask. Suppression is checked first and
-- cannot be argued with; there is no parameter to bypass it.
create or replace function konekt.may_contact(
  p_member_id uuid,
  p_purpose   konekt.consent_purpose,
  p_channel   konekt.consent_channel
)
returns boolean
language sql
stable
as $$
  select
    not coalesce((select is_suppressed from konekt.members where id = p_member_id), true)
    and coalesce((
      select granted
      from konekt.consent_records
      where member_id = p_member_id
        and purpose = p_purpose
        and (channel = p_channel or channel is null)
      order by captured_at desc
      limit 1
    ), false);
$$;

comment on function konekt.may_contact is
  'The only sanctioned way to decide whether a member may be contacted. '
  'Suppression is evaluated first and has no override. Absence of consent is '
  'treated as refusal, not as permission.';

-- -----------------------------------------------------------------------------
-- Staff
-- -----------------------------------------------------------------------------
create table konekt.staff_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique,
  email         citext not null unique,
  full_name     text not null,
  role          konekt.staff_role not null,

  -- Scope. HQ sees everything; a zone user sees one zone; a branch user and a
  -- field agent see one branch. Enforced in RLS, not in the UI.
  zone_code     konekt.zone_code references konekt.zones(code),
  branch_id     uuid references konekt.branches(id) on delete restrict,

  mfa_enrolled_at timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A scope that does not match the role is a permission bug waiting to be
  -- discovered in production.
  constraint staff_scope_matches_role check (
    (role = 'hq'          and zone_code is null and branch_id is null) or
    (role = 'zone'        and zone_code is not null and branch_id is null) or
    (role in ('branch', 'field_agent') and branch_id is not null)
  )
);

comment on constraint staff_scope_matches_role on konekt.staff_users is
  'An HQ user with a branch, or a zone user with none, would silently widen or '
  'narrow what RLS lets them read. The shape is enforced at write time.';

create index staff_role_ix on konekt.staff_users (role);
create index staff_branch_ix on konekt.staff_users (branch_id);

-- Field agents get scoped, expiring access to a specific event rather than a
-- standing grant.
create table konekt.field_agent_assignments (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references konekt.staff_users(id) on delete cascade,
  event_id     uuid not null,
  granted_by   uuid not null references konekt.staff_users(id) on delete restrict,
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,

  constraint assignment_expires_after_grant check (expires_at > granted_at)
);

comment on table konekt.field_agent_assignments is
  'Scoped and expiring by construction: an assignment must carry an expiry, so '
  'access to an event cannot outlive the event by accident.';

-- -----------------------------------------------------------------------------
-- Audit log — immutable, on every write that matters
-- -----------------------------------------------------------------------------
create table konekt.audit_log (
  id           bigserial primary key,
  occurred_at  timestamptz not null default now(),

  actor_staff_id  uuid references konekt.staff_users(id) on delete set null,
  actor_member_id uuid references konekt.members(id) on delete set null,
  actor_kind      text not null check (actor_kind in ('staff', 'member', 'system')),

  action       text not null,
  table_name   text not null,
  record_id    text,

  before_state jsonb,
  after_state  jsonb,

  ip_address   inet,
  user_agent   text
);

comment on table konekt.audit_log is
  'Append-only. Every staff write records actor, timestamp, IP and the before '
  'and after state.';

create index audit_occurred_ix on konekt.audit_log (occurred_at desc);
create index audit_table_record_ix on konekt.audit_log (table_name, record_id);
create index audit_actor_ix on konekt.audit_log (actor_staff_id, occurred_at desc);

create trigger audit_log_immutable
  before update or delete on konekt.audit_log
  for each row execute function konekt.forbid_mutation();

-- Generic auditing trigger. Attached in 0005 to every table a staff user can
-- write, so adding a table without auditing it is a deliberate act.
create or replace function konekt.write_audit()
returns trigger
language plpgsql
security definer
set search_path = konekt, public
as $$
declare
  v_staff_id uuid;
  v_record_id text;
begin
  select id into v_staff_id
  from konekt.staff_users
  where auth_user_id = auth.uid();

  v_record_id := case
    when tg_op = 'DELETE' then (to_jsonb(old) ->> 'id')
    else (to_jsonb(new) ->> 'id')
  end;

  insert into konekt.audit_log (
    actor_staff_id, actor_kind, action, table_name, record_id,
    before_state, after_state
  ) values (
    v_staff_id,
    case when v_staff_id is not null then 'staff' else 'system' end,
    tg_op,
    tg_table_name,
    v_record_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['members', 'staff_users'] loop
    execute format(
      'create trigger %I_touch before update on konekt.%I
       for each row execute function konekt.touch_updated_at()', t, t);
  end loop;
end $$;


-- =============================================================================
-- 20260824000400_events.sql
-- =============================================================================
-- =============================================================================
-- CRDB KONEKT — 0004  Events, tickets, check-in and certificates
-- =============================================================================
-- Two rules here are structural rather than procedural:
--   * capacity is a database constraint, not a UI check, so concurrent
--     registrations cannot oversell an event
--   * a certificate can only exist for an attendee who actually checked in
-- =============================================================================

create table konekt.events (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,

  title_en      text not null,
  title_sw      text not null,
  summary_en    text,
  summary_sw    text,
  description_en text,
  description_sw text,

  status        konekt.event_status not null default 'draft',

  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  timezone      text not null default 'Africa/Dar_es_Salaam',

  venue_name    text not null,
  location_id   uuid references konekt.locations(id) on delete set null,
  institution_id uuid references konekt.institutions(id) on delete set null,
  branch_id     uuid references konekt.branches(id) on delete set null,
  zone_code     konekt.zone_code references konekt.zones(code),

  capacity      integer check (capacity is null or capacity > 0),
  -- Denormalised on purpose: it is the column the capacity constraint locks.
  -- Maintained only by trigger, never written by the application.
  registered_count integer not null default 0 check (registered_count >= 0),

  waitlist_enabled boolean not null default true,
  min_age       smallint,
  max_age       smallint,

  -- Targets and budget, for the cost-per-account reporting in Phase 3.
  target_registrations integer,
  target_accounts      integer,
  budget_tzs           numeric(14,2),

  coordinator_staff_id uuid references konekt.staff_users(id) on delete set null,

  cover_image_path text,

  published_at  timestamptz,
  created_by    uuid references konekt.staff_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint event_ends_after_it_starts check (ends_at > starts_at),
  constraint event_age_range_is_ordered
    check (min_age is null or max_age is null or max_age >= min_age),
  constraint published_event_has_a_time check (
    status not in ('published', 'live', 'completed') or published_at is not null
  ),
  -- The invariant the whole capacity mechanism rests on.
  constraint registrations_never_exceed_capacity
    check (capacity is null or registered_count <= capacity)
);

comment on constraint registrations_never_exceed_capacity on konekt.events is
  'Capacity enforced in the database. Two concurrent registrations for the '
  'last seat cannot both succeed: the counter update takes a row lock and the '
  'second transaction fails this check.';

create index events_status_starts_ix on konekt.events (status, starts_at);
create index events_zone_ix on konekt.events (zone_code, starts_at);
create index events_institution_ix on konekt.events (institution_id);

-- -----------------------------------------------------------------------------
-- Registrations
-- -----------------------------------------------------------------------------
create table konekt.registrations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references konekt.events(id) on delete cascade,
  member_id     uuid not null references konekt.members(id) on delete cascade,

  status        konekt.registration_status not null default 'registered',

  -- The QR carries an HMAC of this, never a bare id. Rotating the nonce
  -- invalidates a leaked ticket without touching the registration.
  ticket_nonce  uuid not null default gen_random_uuid(),
  ticket_issued_at timestamptz not null default now(),

  waitlist_position integer,
  promoted_from_waitlist_at timestamptz,

  registered_at timestamptz not null default now(),
  cancelled_at  timestamptz,

  -- Which member's referral code brought them here.
  referred_by_member_id uuid references konekt.members(id) on delete set null,
  utm_source    text,

  -- One ticket per verified phone per event: members are unique by phone, so a
  -- unique pair enforces exactly that.
  unique (event_id, member_id),

  constraint waitlisted_rows_have_a_position check (
    (status = 'waitlisted') = (waitlist_position is not null)
  )
);

comment on constraint waitlisted_rows_have_a_position on konekt.registrations is
  'A waitlisted registration without a position cannot be promoted in order, '
  'and a position on a confirmed registration means a stale promotion.';

create index registrations_event_status_ix on konekt.registrations (event_id, status);
create index registrations_member_ix on konekt.registrations (member_id, registered_at desc);
create index registrations_waitlist_ix
  on konekt.registrations (event_id, waitlist_position)
  where status = 'waitlisted';

-- -----------------------------------------------------------------------------
-- Check-ins
--
-- Written by the offline check-in PWA, which queues scans locally and syncs
-- when the venue's network comes back. Conflicts resolve to the first
-- timestamp, so a double scan does not overwrite the real arrival time.
-- -----------------------------------------------------------------------------
create table konekt.check_ins (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references konekt.registrations(id) on delete cascade,
  event_id        uuid not null references konekt.events(id) on delete cascade,
  member_id       uuid not null references konekt.members(id) on delete cascade,

  -- When the scan happened on the device, not when it reached the server.
  scanned_at      timestamptz not null,
  synced_at       timestamptz not null default now(),

  scanned_by_staff_id uuid references konekt.staff_users(id) on delete set null,
  device_id       text,
  was_offline     boolean not null default false,

  -- One check-in per registration. A duplicate scan is rejected by the unique
  -- index rather than by hoping the client deduplicates.
  unique (registration_id)
);

comment on table konekt.check_ins is
  'scanned_at is device time and is the truth; synced_at is arrival time. '
  'Conflict resolution is first scanned_at wins, which the unique constraint '
  'on registration_id plus an ON CONFLICT DO NOTHING insert gives for free.';

create index check_ins_event_ix on konekt.check_ins (event_id, scanned_at);
create index check_ins_member_period_ix on konekt.check_ins (member_id, scanned_at desc);

-- Event participation per member per period. This is what the tier engine
-- consumes: Gold needs one event a quarter, Platinum two a year.
create or replace function konekt.member_event_count(
  p_member_id uuid,
  p_from      timestamptz,
  p_to        timestamptz
)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from konekt.check_ins
  where member_id = p_member_id
    and scanned_at >= p_from
    and scanned_at < p_to;
$$;

comment on function konekt.member_event_count is
  'Attendance feeds the loyalty engine, so check-in data has to be queryable '
  'per member per period. Counts check-ins, never registrations — turning up '
  'is the criterion.';

-- -----------------------------------------------------------------------------
-- Capacity + waitlist, enforced by trigger
-- -----------------------------------------------------------------------------
create or replace function konekt.maintain_event_counts()
returns trigger
language plpgsql
as $$
declare
  v_capacity integer;
  v_count    integer;
begin
  if tg_op = 'INSERT' and new.status = 'registered' then
    -- FOR UPDATE serialises concurrent registrations for the same event. The
    -- check constraint on events then rejects the one that would oversell.
    select capacity, registered_count into v_capacity, v_count
    from konekt.events where id = new.event_id for update;

    if v_capacity is not null and v_count >= v_capacity then
      raise exception 'EVENT_FULL'
        using errcode = 'check_violation',
              hint = 'Register on the waitlist instead.';
    end if;

    update konekt.events
      set registered_count = registered_count + 1
      where id = new.event_id;

  elsif tg_op = 'UPDATE' then
    if old.status = 'registered' and new.status <> 'registered' then
      update konekt.events
        set registered_count = greatest(registered_count - 1, 0)
        where id = new.event_id;
    elsif old.status <> 'registered' and new.status = 'registered' then
      select capacity, registered_count into v_capacity, v_count
      from konekt.events where id = new.event_id for update;
      if v_capacity is not null and v_count >= v_capacity then
        raise exception 'EVENT_FULL' using errcode = 'check_violation';
      end if;
      update konekt.events
        set registered_count = registered_count + 1
        where id = new.event_id;
    end if;

  elsif tg_op = 'DELETE' and old.status = 'registered' then
    update konekt.events
      set registered_count = greatest(registered_count - 1, 0)
      where id = old.event_id;
    return old;
  end if;

  return new;
end;
$$;

create trigger registrations_maintain_counts
  after insert or update or delete on konekt.registrations
  for each row execute function konekt.maintain_event_counts();

-- Marking a check-in also moves the registration, so "checked in" is never
-- inferred by joining two tables and hoping they agree.
create or replace function konekt.apply_check_in()
returns trigger
language plpgsql
as $$
begin
  update konekt.registrations
    set status = 'checked_in'
    where id = new.registration_id
      and status <> 'cancelled';
  return new;
end;
$$;

create trigger check_ins_mark_registration
  after insert on konekt.check_ins
  for each row execute function konekt.apply_check_in();

-- Promote the longest-waiting person when a seat frees up.
create or replace function konekt.promote_from_waitlist(p_event_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from konekt.registrations
  where event_id = p_event_id and status = 'waitlisted'
  order by waitlist_position asc
  limit 1
  for update skip locked;

  if v_id is null then return null; end if;

  update konekt.registrations
    set status = 'registered',
        waitlist_position = null,
        promoted_from_waitlist_at = now()
    where id = v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Certificates
--
-- Issued only to attendees who checked in. The foreign key is to the check-in,
-- not to the registration, so "registered but did not attend" has nothing to
-- point a certificate at.
-- -----------------------------------------------------------------------------
create table konekt.certificates (
  id             uuid primary key default gen_random_uuid(),
  -- Short, human-readable, printed on the certificate and in the QR.
  public_code    text not null unique,

  check_in_id    uuid not null unique
                   references konekt.check_ins(id) on delete restrict,
  member_id      uuid not null references konekt.members(id) on delete restrict,
  event_id       uuid not null references konekt.events(id) on delete restrict,

  -- "Certificate of Participation" unless Legal approves otherwise.
  wording        text not null default 'Certificate of Participation',
  issued_at      timestamptz not null default now(),
  issued_by      uuid references konekt.staff_users(id) on delete set null,

  pdf_path       text,
  social_image_path text,

  revoked_at     timestamptz,
  revoked_reason text
);

comment on table konekt.certificates is
  'The check_in_id foreign key is the rule: a certificate cannot exist without '
  'a check-in, so it cannot be issued to someone who registered and did not '
  'turn up. Verified publicly at /verify/{public_code}.';

create index certificates_member_ix on konekt.certificates (member_id, issued_at desc);
create index certificates_event_ix on konekt.certificates (event_id);

-- -----------------------------------------------------------------------------
-- Referrals
--
-- Durable records: Platinum requires two referrals who complete onboarding, so
-- this cannot be inferred from a UTM parameter that expires.
-- -----------------------------------------------------------------------------
create table konekt.referrals (
  id              uuid primary key default gen_random_uuid(),
  referrer_member_id uuid not null references konekt.members(id) on delete cascade,
  referred_member_id uuid not null unique references konekt.members(id) on delete cascade,

  referred_at     timestamptz not null default now(),
  -- Set when the referred member actually opens an account. A referral that
  -- never completes onboarding does not count toward Platinum.
  completed_onboarding_at timestamptz,
  source_event_id uuid references konekt.events(id) on delete set null,

  constraint referral_is_not_self check (referrer_member_id <> referred_member_id)
);

create index referrals_referrer_ix on konekt.referrals (referrer_member_id, referred_at desc);

create or replace function konekt.member_completed_referral_count(
  p_member_id uuid,
  p_from      timestamptz,
  p_to        timestamptz
)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from konekt.referrals
  where referrer_member_id = p_member_id
    and completed_onboarding_at is not null
    and completed_onboarding_at >= p_from
    and completed_onboarding_at < p_to;
$$;

do $$
declare t text;
begin
  foreach t in array array['events'] loop
    execute format(
      'create trigger %I_touch before update on konekt.%I
       for each row execute function konekt.touch_updated_at()', t, t);
  end loop;
end $$;


-- =============================================================================
-- 20260824000500_programme.sql
-- =============================================================================
-- =============================================================================
-- CRDB KONEKT — 0005  Partners, opportunities, sponsorship, account opening
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Partner ecosystem
--
-- Partner + Benefit + TierEntitlement from the start. The framework already
-- names campus WiFi, Bolt, Air Tanzania, Golf Tanzania, tourism operators,
-- barbershops and retail — a hardcoded benefits table would need tearing out
-- within a month, and entitlements have to change without a deploy.
-- -----------------------------------------------------------------------------
create table konekt.partners (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  category     text not null,
  description_en text,
  description_sw text,
  logo_path    text,
  website_url  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table konekt.benefits (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references konekt.partners(id) on delete cascade,
  slug          text not null unique,

  title_en      text not null,
  title_sw      text not null,
  detail_en     text,
  detail_sw     text,

  -- Marketing and Legal have not signed these off. Anything still indicative
  -- must be labelled as such wherever it is shown.
  is_indicative boolean not null default true,
  approved_by   text,
  approved_at   timestamptz,

  valid_from    timestamptz,
  valid_until   timestamptz,
  is_active     boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint benefit_validity_is_ordered
    check (valid_until is null or valid_from is null or valid_until > valid_from),
  constraint approved_benefit_is_not_indicative
    check (is_indicative = true or (approved_by is not null and approved_at is not null))
);

comment on constraint approved_benefit_is_not_indicative on konekt.benefits is
  'A benefit can stop being labelled indicative only when someone is recorded '
  'as having approved it. Clearing the flag without a name is not possible.';

create table konekt.tier_entitlements (
  benefit_id uuid not null references konekt.benefits(id) on delete cascade,
  tier       konekt.membership_tier not null,
  created_at timestamptz not null default now(),
  primary key (benefit_id, tier)
);

comment on table konekt.tier_entitlements is
  'Which tiers get which benefit. Editable from the admin console — changing '
  'an entitlement must never require a deploy.';

-- -----------------------------------------------------------------------------
-- Opportunities
-- -----------------------------------------------------------------------------
create table konekt.opportunities (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  kind          konekt.opportunity_kind not null,

  title_en      text not null,
  title_sw      text not null,
  body_en       text,
  body_sw       text,

  organisation  text not null,
  -- Never optional, anywhere.
  source_name   text not null,
  source_url    text,

  -- Eligibility. Nulls mean "no restriction", which is why the board can
  -- filter to what a given member actually qualifies for.
  min_age       smallint,
  max_age       smallint,
  education_level konekt.education_level,
  field_of_study  text,
  region_id     uuid references konekt.regions(id) on delete set null,

  deadline_at   timestamptz,
  external_url  text,

  -- Nothing publishes unverified.
  verified_by   uuid references konekt.staff_users(id) on delete set null,
  verified_at   timestamptz,
  published_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint opportunity_age_range_is_ordered
    check (min_age is null or max_age is null or max_age >= min_age),
  constraint published_opportunity_is_verified check (
    published_at is null or (verified_by is not null and verified_at is not null)
  )
);

comment on constraint published_opportunity_is_verified on konekt.opportunities is
  'An opportunity cannot be published without a named verifier. "Nothing '
  'publishes unverified" is a constraint here, not a code review comment.';

create index opportunities_published_ix
  on konekt.opportunities (published_at desc nulls last, deadline_at);
create index opportunities_kind_ix on konekt.opportunities (kind);

create table konekt.saved_opportunities (
  member_id      uuid not null references konekt.members(id) on delete cascade,
  opportunity_id uuid not null references konekt.opportunities(id) on delete cascade,
  saved_at       timestamptz not null default now(),
  reminder_sent_at timestamptz,
  primary key (member_id, opportunity_id)
);

-- -----------------------------------------------------------------------------
-- Sponsorship requests
-- -----------------------------------------------------------------------------
create table konekt.sponsorship_requests (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,

  organisation    text not null,
  contact_name    text not null,
  contact_phone_e164 text not null
                    check (contact_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  contact_email   citext,

  title           text not null,
  description     text not null,
  amount_requested_tzs numeric(14,2) not null check (amount_requested_tzs > 0),
  expected_attendance  integer,
  event_date      date,

  region_id       uuid references konekt.regions(id) on delete set null,
  institution_id  uuid references konekt.institutions(id) on delete set null,

  status          konekt.sponsorship_status not null default 'submitted',

  -- Auto-triage on submission.
  triage_score    smallint check (triage_score between 0 and 100),
  triage_notes    text,
  triaged_at      timestamptz,

  -- Due diligence gate: approval is impossible before it clears.
  due_diligence_cleared_at timestamptz,
  due_diligence_by uuid references konekt.staff_users(id) on delete set null,

  decided_by      uuid references konekt.staff_users(id) on delete set null,
  decided_at      timestamptz,
  decision_note   text,

  submitted_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint approval_requires_due_diligence check (
    status <> 'approved' or due_diligence_cleared_at is not null
  ),
  constraint decision_is_attributed check (
    status not in ('approved', 'declined')
    or (decided_by is not null and decided_at is not null)
  )
);

comment on constraint approval_requires_due_diligence on konekt.sponsorship_requests is
  'A sponsorship cannot reach approved until due diligence is recorded as '
  'cleared. The gate is in the database so no console shortcut can skip it.';

create table konekt.sponsorship_documents (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references konekt.sponsorship_requests(id) on delete cascade,
  storage_path  text not null,
  file_name     text not null,
  content_type  text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  uploaded_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Accounts opened — the acquisition record
--
-- This is what the whole platform exists to produce, and it is the table the
-- reporting hangs off: cost per account, conversion by stage, which event and
-- which agent.
-- -----------------------------------------------------------------------------
create table konekt.accounts_opened (
  id              uuid primary key default gen_random_uuid(),

  -- Unique at the database level. A duplicate account number is a double-count
  -- in every report that follows.
  account_number  text not null unique,
  product         konekt.account_product not null,

  member_id       uuid references konekt.members(id) on delete set null,
  branch_id       uuid not null references konekt.branches(id) on delete restrict,

  -- Source attribution is never optional. Both columns are NOT NULL, so an
  -- account with no traceable origin cannot be recorded at all.
  source          text not null,
  source_reference text not null,

  event_id        uuid references konekt.events(id) on delete set null,
  institution_id  uuid references konekt.institutions(id) on delete set null,
  opened_by_staff_id uuid references konekt.staff_users(id) on delete set null,
  referring_member_id uuid references konekt.members(id) on delete set null,

  opened_on       date not null,
  reconciled_at   timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint source_is_recognised check (
    source in ('event', 'branch_walk_in', 'field_agent', 'referral',
               'campus_activation', 'digital', 'other')
  ),
  constraint event_sourced_accounts_name_the_event check (
    source <> 'event' or event_id is not null
  ),
  constraint referral_sourced_accounts_name_the_referrer check (
    source <> 'referral' or referring_member_id is not null
  )
);

comment on table konekt.accounts_opened is
  'Source attribution is structurally mandatory: source and source_reference '
  'are NOT NULL, and an event- or referral-sourced account must name the event '
  'or the referrer. An HQ analyst can trace any account to its origin because '
  'an untraceable one could not be written.';

create index accounts_opened_branch_date_ix on konekt.accounts_opened (branch_id, opened_on);
create index accounts_opened_event_ix on konekt.accounts_opened (event_id);
create index accounts_opened_member_ix on konekt.accounts_opened (member_id);

-- Monthly deposit submissions, with a window and a zone approval step.
create table konekt.deposit_submissions (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references konekt.branches(id) on delete restrict,
  period_month  date not null,

  total_deposits_tzs numeric(16,2) not null check (total_deposits_tzs >= 0),
  accounts_count integer not null check (accounts_count >= 0),

  submitted_by  uuid references konekt.staff_users(id) on delete set null,
  submitted_at  timestamptz not null default now(),

  locked_at     timestamptz,
  approved_by   uuid references konekt.staff_users(id) on delete set null,
  approved_at   timestamptz,

  unique (branch_id, period_month),
  constraint period_is_first_of_month check (extract(day from period_month) = 1),
  constraint approval_follows_lock check (
    approved_at is null or locked_at is not null
  )
);

-- -----------------------------------------------------------------------------
-- Messaging — consent-aware by construction
-- -----------------------------------------------------------------------------
create table konekt.campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  channel       konekt.consent_channel not null,
  purpose       konekt.consent_purpose not null,

  body_en       text not null,
  body_sw       text not null,

  -- Maker-checker: the person who sends cannot be the person who wrote it.
  created_by    uuid not null references konekt.staff_users(id) on delete restrict,
  approved_by   uuid references konekt.staff_users(id) on delete restrict,
  approved_at   timestamptz,

  scheduled_for timestamptz,
  sent_at       timestamptz,

  estimated_cost_tzs numeric(12,2),
  actual_cost_tzs    numeric(12,2),

  created_at    timestamptz not null default now(),

  constraint maker_is_not_checker check (
    approved_by is null or approved_by <> created_by
  ),
  constraint sending_requires_approval check (
    sent_at is null or approved_at is not null
  )
);

comment on constraint maker_is_not_checker on konekt.campaigns is
  'Maker-checker on send. The author of a campaign cannot approve their own '
  'campaign, and an unapproved campaign cannot be marked sent.';

create table konekt.campaign_deliveries (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references konekt.campaigns(id) on delete cascade,
  member_id    uuid not null references konekt.members(id) on delete cascade,
  -- Recorded at send time from konekt.may_contact, so a suppressed member's
  -- exclusion is provable afterwards rather than merely asserted.
  was_eligible boolean not null,
  skip_reason  text,
  sent_at      timestamptz,
  delivered_at timestamptz,
  failed_at    timestamptz,
  unique (campaign_id, member_id)
);

comment on table konekt.campaign_deliveries is
  'One row per member considered, including the ones skipped. "Confirm a '
  'suppressed user received nothing" is answerable from this table.';

do $$
declare t text;
begin
  foreach t in array array[
    'partners', 'benefits', 'opportunities', 'sponsorship_requests',
    'accounts_opened'
  ] loop
    execute format(
      'create trigger %I_touch before update on konekt.%I
       for each row execute function konekt.touch_updated_at()', t, t);
  end loop;
end $$;

-- Audit every table a staff user can write.
do $$
declare t text;
begin
  foreach t in array array[
    'events', 'accounts_opened', 'sponsorship_requests', 'opportunities',
    'benefits', 'tier_entitlements', 'campaigns', 'deposit_submissions',
    'institutions', 'branches', 'locations'
  ] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on konekt.%I
       for each row execute function konekt.write_audit()', t, t);
  end loop;
end $$;


-- =============================================================================
-- 20260824000600_rls.sql
-- =============================================================================
-- =============================================================================
-- CRDB KONEKT — 0006  Row level security
-- =============================================================================
-- Authorisation lives here, not in the UI. Every policy below is exercised by
-- supabase/tests/authorisation.sql, which asserts that a branch user cannot
-- read another zone's records.
--
-- Scope model (master spec §3):
--   hq          everything
--   zone        one zone
--   branch      one branch
--   field_agent one branch, and only events they are assigned to
--   member      their own rows
--   public      published, verified content only
-- =============================================================================

-- On Supabase these already exist. Created here so the migration set also runs
-- against a bare Postgres for verification.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    create function auth.uid() returns uuid
      language sql stable
      as $fn$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema konekt to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Scope helpers
--
-- SECURITY DEFINER so a policy can read staff_users without that read itself
-- being subject to a policy — which would recurse.
-- -----------------------------------------------------------------------------
create or replace function konekt.current_staff()
returns konekt.staff_users
language sql
stable
security definer
set search_path = konekt, auth, public
as $$
  select * from konekt.staff_users
  where auth_user_id = auth.uid() and is_active
  limit 1;
$$;

create or replace function konekt.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = konekt, auth, public
as $$
  select id from konekt.members where auth_user_id = auth.uid() limit 1;
$$;

create or replace function konekt.is_hq()
returns boolean
language sql stable
as $$ select coalesce((konekt.current_staff()).role = 'hq', false) $$;

create or replace function konekt.is_staff()
returns boolean
language sql stable
as $$ select (konekt.current_staff()).id is not null $$;

-- The single scope predicate. Everything else composes from it, so widening a
-- role's reach is one function, not thirty policies.
create or replace function konekt.staff_can_reach(
  p_zone      konekt.zone_code,
  p_branch_id uuid
)
returns boolean
language sql
stable
as $$
  with s as (select * from konekt.current_staff())
  select case
    when (select id from s) is null then false
    when (select role from s) = 'hq' then true
    when (select role from s) = 'zone' then p_zone is not null
                                          and p_zone = (select zone_code from s)
    when (select role from s) in ('branch', 'field_agent')
      then p_branch_id is not null and p_branch_id = (select branch_id from s)
    else false
  end;
$$;

comment on function konekt.staff_can_reach is
  'The one scope decision. A zone user reaching a null zone is false, not '
  'true: unknown scope is refused rather than allowed.';

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere. Default deny; policies below open specific doors.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'konekt'
  loop
    execute format('alter table konekt.%I enable row level security', t);
    execute format('alter table konekt.%I force row level security', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Reference geography — public read, HQ write
-- -----------------------------------------------------------------------------
create policy zones_public_read on konekt.zones
  for select to anon, authenticated using (true);
create policy regions_public_read on konekt.regions
  for select to anon, authenticated using (true);
create policy districts_public_read on konekt.districts
  for select to anon, authenticated using (true);
create policy wards_public_read on konekt.wards
  for select to anon, authenticated using (true);

-- Locations: the public may read a location only once a human has verified the
-- pin. This is the map rule, enforced in the row filter.
create policy locations_public_read_verified on konekt.locations
  for select to anon, authenticated
  using (geocode_status = 'verified' and point is not null);

create policy locations_staff_read on konekt.locations
  for select to authenticated
  using (konekt.is_staff());

create policy locations_staff_write on konekt.locations
  for update to authenticated
  using (konekt.is_staff())
  with check (konekt.is_staff());

comment on policy locations_public_read_verified on konekt.locations is
  'An unverified pin is invisible to the public API regardless of what the '
  'application asks for. "Never place an unverified pin on the map" cannot be '
  'bypassed by a query.';

-- -----------------------------------------------------------------------------
-- Branches and institutions — public read of active records
-- -----------------------------------------------------------------------------
create policy branches_public_read on konekt.branches
  for select to anon, authenticated using (is_active);
create policy branches_hq_write on konekt.branches
  for all to authenticated
  using (konekt.is_hq()) with check (konekt.is_hq());

create policy institutions_public_read on konekt.institutions
  for select to anon, authenticated using (is_active);
create policy institutions_staff_write on konekt.institutions
  for all to authenticated
  using (konekt.staff_can_reach(zone_code, coordinating_branch_id))
  with check (konekt.staff_can_reach(zone_code, coordinating_branch_id));

create policy institution_branches_public_read on konekt.institution_supporting_branches
  for select to anon, authenticated using (true);

-- -----------------------------------------------------------------------------
-- Events
-- -----------------------------------------------------------------------------
create policy events_public_read_published on konekt.events
  for select to anon, authenticated
  using (status in ('published', 'live', 'completed'));

create policy events_staff_read_in_scope on konekt.events
  for select to authenticated
  using (konekt.staff_can_reach(zone_code, branch_id));

create policy events_staff_write_in_scope on konekt.events
  for all to authenticated
  using (konekt.staff_can_reach(zone_code, branch_id))
  with check (konekt.staff_can_reach(zone_code, branch_id));

-- -----------------------------------------------------------------------------
-- Members — a member sees themselves; staff see members in their scope
-- -----------------------------------------------------------------------------
create policy members_self_read on konekt.members
  for select to authenticated
  using (auth_user_id = auth.uid());

-- A member may edit their own profile. Which columns they may edit is pinned
-- by the trigger below rather than by a subquery in the policy: a WITH CHECK
-- that reads konekt.members is itself filtered by these policies, so it would
-- compare the new row against nothing and silently pass.
create policy members_self_update on konekt.members
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy members_hq_read on konekt.members
  for select to authenticated
  using (konekt.is_hq());

create policy members_staff_read_in_scope on konekt.members
  for select to authenticated
  using (
    konekt.is_staff()
    and exists (
      select 1 from konekt.institutions i
      where i.id = konekt.members.institution_id
        and konekt.staff_can_reach(i.zone_code, i.coordinating_branch_id)
    )
  );

-- Columns a member must never be able to change about themselves. Tier comes
-- from core banking, suppression protects them from us, and kyc_verified is a
-- claim only the bank can make. A crafted PATCH that touches any of them is
-- rejected outright rather than quietly ignored.
create or replace function konekt.protect_member_columns()
returns trigger
language plpgsql
as $$
begin
  -- Staff and the service role act through other paths; this guard applies to
  -- a member editing their own row.
  if new.auth_user_id is distinct from auth.uid() then
    return new;
  end if;

  if new.tier is distinct from old.tier then
    raise exception 'TIER_IS_NOT_SELF_ASSIGNABLE'
      using errcode = 'insufficient_privilege',
            hint = 'Tier is computed in core banking and consumed here.';
  end if;

  if new.is_suppressed is distinct from old.is_suppressed then
    raise exception 'SUPPRESSION_IS_NOT_SELF_ASSIGNABLE'
      using errcode = 'insufficient_privilege',
            hint = 'Opting back in is a consent record, not a flag edit.';
  end if;

  if new.kyc_verified is distinct from old.kyc_verified then
    raise exception 'KYC_IS_NOT_SELF_ASSERTABLE'
      using errcode = 'insufficient_privilege';
  end if;

  if new.referral_code is distinct from old.referral_code then
    raise exception 'REFERRAL_CODE_IS_IMMUTABLE'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger members_protect_columns
  before update on konekt.members
  for each row execute function konekt.protect_member_columns();

-- -----------------------------------------------------------------------------
-- Consent — a member reads and writes only their own, and can never delete
-- -----------------------------------------------------------------------------
create policy consent_self_read on konekt.consent_records
  for select to authenticated
  using (member_id = konekt.current_member_id());

create policy consent_self_insert on konekt.consent_records
  for insert to authenticated
  with check (member_id = konekt.current_member_id());

create policy consent_staff_read on konekt.consent_records
  for select to authenticated using (konekt.is_hq());

-- No UPDATE or DELETE policy exists for consent_records, and the immutability
-- trigger blocks them even for a role that bypasses RLS.

-- -----------------------------------------------------------------------------
-- Registrations, check-ins, certificates
-- -----------------------------------------------------------------------------
create policy registrations_self_read on konekt.registrations
  for select to authenticated
  using (member_id = konekt.current_member_id());

create policy registrations_self_insert on konekt.registrations
  for insert to authenticated
  with check (member_id = konekt.current_member_id());

create policy registrations_self_cancel on konekt.registrations
  for update to authenticated
  using (member_id = konekt.current_member_id())
  with check (member_id = konekt.current_member_id());

create policy registrations_staff_read on konekt.registrations
  for select to authenticated
  using (
    exists (
      select 1 from konekt.events e
      where e.id = konekt.registrations.event_id
        and konekt.staff_can_reach(e.zone_code, e.branch_id)
    )
  );

create policy check_ins_staff_write on konekt.check_ins
  for all to authenticated
  using (
    exists (
      select 1 from konekt.events e
      where e.id = konekt.check_ins.event_id
        and konekt.staff_can_reach(e.zone_code, e.branch_id)
    )
  )
  with check (
    exists (
      select 1 from konekt.events e
      where e.id = konekt.check_ins.event_id
        and konekt.staff_can_reach(e.zone_code, e.branch_id)
    )
  );

create policy check_ins_self_read on konekt.check_ins
  for select to authenticated
  using (member_id = konekt.current_member_id());

-- Certificates are publicly readable: /verify/{code} has to work for an
-- employer holding a printout, with no account.
create policy certificates_public_verify on konekt.certificates
  for select to anon, authenticated using (revoked_at is null);

create policy certificates_staff_issue on konekt.certificates
  for insert to authenticated with check (konekt.is_staff());

-- -----------------------------------------------------------------------------
-- Programme tables
-- -----------------------------------------------------------------------------
create policy partners_public_read on konekt.partners
  for select to anon, authenticated using (is_active);
create policy partners_hq_write on konekt.partners
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

create policy benefits_public_read on konekt.benefits
  for select to anon, authenticated using (is_active);
create policy benefits_hq_write on konekt.benefits
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

create policy entitlements_public_read on konekt.tier_entitlements
  for select to anon, authenticated using (true);
create policy entitlements_hq_write on konekt.tier_entitlements
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

create policy opportunities_public_read on konekt.opportunities
  for select to anon, authenticated
  using (published_at is not null and published_at <= now());
create policy opportunities_staff_write on konekt.opportunities
  for all to authenticated using (konekt.is_staff()) with check (konekt.is_staff());

create policy saved_opportunities_self on konekt.saved_opportunities
  for all to authenticated
  using (member_id = konekt.current_member_id())
  with check (member_id = konekt.current_member_id());

-- Anyone may submit a sponsorship request; only staff may read them.
create policy sponsorship_public_insert on konekt.sponsorship_requests
  for insert to anon, authenticated with check (true);
create policy sponsorship_staff_read on konekt.sponsorship_requests
  for select to authenticated using (konekt.is_staff());
create policy sponsorship_staff_update on konekt.sponsorship_requests
  for update to authenticated using (konekt.is_staff()) with check (konekt.is_staff());

create policy sponsorship_docs_insert on konekt.sponsorship_documents
  for insert to anon, authenticated with check (true);
create policy sponsorship_docs_staff_read on konekt.sponsorship_documents
  for select to authenticated using (konekt.is_staff());

-- -----------------------------------------------------------------------------
-- Accounts opened and deposits — scoped to the branch
-- -----------------------------------------------------------------------------
create policy accounts_staff_scope on konekt.accounts_opened
  for all to authenticated
  using (konekt.staff_can_reach(
           (select b.zone_code from konekt.branches b where b.id = konekt.accounts_opened.branch_id),
           konekt.accounts_opened.branch_id))
  with check (konekt.staff_can_reach(
           (select b.zone_code from konekt.branches b where b.id = konekt.accounts_opened.branch_id),
           konekt.accounts_opened.branch_id));

create policy deposits_staff_scope on konekt.deposit_submissions
  for all to authenticated
  using (konekt.staff_can_reach(
           (select b.zone_code from konekt.branches b where b.id = konekt.deposit_submissions.branch_id),
           konekt.deposit_submissions.branch_id))
  with check (konekt.staff_can_reach(
           (select b.zone_code from konekt.branches b where b.id = konekt.deposit_submissions.branch_id),
           konekt.deposit_submissions.branch_id));

-- -----------------------------------------------------------------------------
-- Messaging and audit — HQ only
-- -----------------------------------------------------------------------------
create policy campaigns_hq on konekt.campaigns
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());
create policy deliveries_hq on konekt.campaign_deliveries
  for select to authenticated using (konekt.is_hq());

create policy audit_hq_read on konekt.audit_log
  for select to authenticated using (konekt.is_hq());

create policy staff_self_read on konekt.staff_users
  for select to authenticated using (auth_user_id = auth.uid() or konekt.is_hq());
create policy staff_hq_write on konekt.staff_users
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

create policy assignments_read on konekt.field_agent_assignments
  for select to authenticated
  using (konekt.is_hq()
         or staff_id = (konekt.current_staff()).id);
create policy assignments_hq_write on konekt.field_agent_assignments
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

create policy guardian_consent_staff on konekt.guardian_consents
  for all to authenticated using (konekt.is_staff()) with check (konekt.is_staff());

create policy referrals_self_read on konekt.referrals
  for select to authenticated
  using (referrer_member_id = konekt.current_member_id()
         or referred_member_id = konekt.current_member_id()
         or konekt.is_hq());

-- -----------------------------------------------------------------------------
-- Grants. RLS decides rows; these decide which tables are addressable at all.
-- -----------------------------------------------------------------------------
grant select on all tables in schema konekt to anon, authenticated;
grant insert, update on
  konekt.members, konekt.registrations, konekt.consent_records,
  konekt.saved_opportunities, konekt.sponsorship_requests,
  konekt.sponsorship_documents
  to authenticated;
grant insert on konekt.sponsorship_requests, konekt.sponsorship_documents to anon;
grant insert, update, delete on
  konekt.events, konekt.check_ins, konekt.certificates,
  konekt.accounts_opened, konekt.deposit_submissions, konekt.opportunities,
  konekt.partners, konekt.benefits, konekt.tier_entitlements,
  konekt.campaigns, konekt.institutions, konekt.branches, konekt.locations,
  konekt.staff_users, konekt.field_agent_assignments, konekt.guardian_consents
  to authenticated;
grant usage, select on all sequences in schema konekt to authenticated;

-- The audit log is never writable through the API. Only the SECURITY DEFINER
-- trigger inserts into it.
revoke insert, update, delete on konekt.audit_log from anon, authenticated;


-- =============================================================================
-- 20260824000700_content.sql
-- =============================================================================
-- =============================================================================
-- CRDB KONEKT — 0007  Editorial content
-- =============================================================================
-- Blog, partner logos and the site's own copy blocks. Bilingual throughout:
-- a post without Swahili cannot be published, because Swahili is not a
-- translation added at the end.
-- =============================================================================

create type konekt.post_status as enum ('draft', 'in_review', 'published', 'archived');

create table konekt.authors (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  role_en     text,
  role_sw     text,
  bio_en      text,
  bio_sw      text,
  avatar_path text,
  staff_id    uuid references konekt.staff_users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table konekt.post_categories (
  id       uuid primary key default gen_random_uuid(),
  slug     text not null unique,
  name_en  text not null,
  name_sw  text not null,
  -- Which brand accent this category carries. Constrained to the four brand
  -- colours so a category cannot introduce a fifth.
  accent   text not null default 'teal'
             check (accent in ('teal', 'green', 'yellow', 'pink')),
  display_order smallint not null default 0
);

create table konekt.posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  category_id   uuid references konekt.post_categories(id) on delete set null,
  author_id     uuid references konekt.authors(id) on delete set null,

  title_en      text not null,
  title_sw      text not null,
  excerpt_en    text not null,
  excerpt_sw    text not null,
  body_en       text not null,
  body_sw       text not null,

  cover_image_path text,
  cover_alt_en  text,
  cover_alt_sw  text,

  status        konekt.post_status not null default 'draft',
  published_at  timestamptz,
  reading_minutes smallint,

  -- Never optional. A post that repeats a statistic has to say where it came
  -- from, the same as everything else on this platform.
  source_name   text,
  source_url    text,

  is_featured   boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint published_post_has_a_date check (
    status <> 'published' or published_at is not null
  ),
  -- Both languages or neither. A published post missing its Swahili would
  -- quietly turn the Swahili site into an English one.
  constraint published_post_is_bilingual check (
    status <> 'published'
    or (length(btrim(body_sw)) > 0 and length(btrim(body_en)) > 0
        and length(btrim(title_sw)) > 0 and length(btrim(title_en)) > 0)
  ),
  constraint cover_image_has_alt_text check (
    cover_image_path is null
    or (cover_alt_en is not null and cover_alt_sw is not null)
  )
);

comment on constraint published_post_is_bilingual on konekt.posts is
  'Swahili and English are peers. A post cannot reach published with one of '
  'them empty, so the Swahili site can never silently degrade into English.';

comment on constraint cover_image_has_alt_text on konekt.posts is
  'An image without alt text in both locales cannot be attached. Accessibility '
  'is not a review step here, it is a write constraint.';

create index posts_published_ix on konekt.posts (status, published_at desc);
create index posts_category_ix on konekt.posts (category_id, published_at desc);

create table konekt.post_tags (
  post_id uuid not null references konekt.posts(id) on delete cascade,
  tag     text not null,
  primary key (post_id, tag)
);

-- -----------------------------------------------------------------------------
-- Partner logos shown on the public site.
--
-- Distinct from konekt.partners, which is the benefits ecosystem: a logo on the
-- landing page is a marketing placement and needs its own approval trail.
-- -----------------------------------------------------------------------------
create table konekt.brand_placements (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid references konekt.partners(id) on delete set null,

  name          text not null,
  logo_path     text,
  -- Inline SVG for the placements that must render without a network request.
  logo_svg      text,
  website_url   text,

  -- Where it appears: 'landing_strip', 'events_page', 'footer'.
  placement     text not null
                  check (placement in ('landing_strip', 'events_page', 'footer')),
  display_order smallint not null default 0,

  -- A logo is someone else's trademark. It does not go on the site until
  -- someone is recorded as having cleared its use.
  usage_approved_by text,
  usage_approved_at timestamptz,

  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint placement_has_a_logo check (logo_path is not null or logo_svg is not null),
  constraint active_placement_is_cleared check (
    is_active = false
    or (usage_approved_by is not null and usage_approved_at is not null)
  )
);

comment on constraint active_placement_is_cleared on konekt.brand_placements is
  'A partner logo cannot go live without a named person recording that its use '
  'was cleared. Publishing someone else than CRDB''s mark is a legal act.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table konekt.authors enable row level security;
alter table konekt.post_categories enable row level security;
alter table konekt.posts enable row level security;
alter table konekt.post_tags enable row level security;
alter table konekt.brand_placements enable row level security;

alter table konekt.authors force row level security;
alter table konekt.post_categories force row level security;
alter table konekt.posts force row level security;
alter table konekt.post_tags force row level security;
alter table konekt.brand_placements force row level security;

create policy authors_public_read on konekt.authors
  for select to anon, authenticated using (true);
create policy categories_public_read on konekt.post_categories
  for select to anon, authenticated using (true);
create policy tags_public_read on konekt.post_tags
  for select to anon, authenticated using (true);

create policy posts_public_read on konekt.posts
  for select to anon, authenticated
  using (status = 'published' and published_at <= now());

create policy posts_staff_read on konekt.posts
  for select to authenticated using (konekt.is_staff());
create policy posts_staff_write on konekt.posts
  for all to authenticated using (konekt.is_staff()) with check (konekt.is_staff());

create policy placements_public_read on konekt.brand_placements
  for select to anon, authenticated using (is_active);
create policy placements_hq_write on konekt.brand_placements
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

create policy authors_hq_write on konekt.authors
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());
create policy categories_hq_write on konekt.post_categories
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

grant select on konekt.authors, konekt.post_categories, konekt.posts,
  konekt.post_tags, konekt.brand_placements to anon, authenticated;
grant insert, update, delete on konekt.posts, konekt.authors,
  konekt.post_categories, konekt.post_tags, konekt.brand_placements
  to authenticated;

do $$
declare t text;
begin
  foreach t in array array['posts', 'brand_placements'] loop
    execute format(
      'create trigger %I_touch before update on konekt.%I
       for each row execute function konekt.touch_updated_at()', t, t);
    execute format(
      'create trigger %I_audit after insert or update or delete on konekt.%I
       for each row execute function konekt.write_audit()', t, t);
  end loop;
end $$;


-- =============================================================================
-- 20260825000800_admin_settings.sql
-- =============================================================================
-- =============================================================================
-- 0008 — ADMIN-EDITABLE SETTINGS, AND SOMEWHERE TO PUT AN UPLOADED LOGO
--
-- Everything an HQ administrator can change from the console without a deploy:
-- the strings on the landing page, the partner strip's own labels, the contact
-- details in the footer, and the switches that decide what is shown at all.
--
-- One table, keyed by a dotted name, with the value in jsonb. Not a column per
-- setting: a column per setting means a migration every time Marketing wants a
-- new sentence, and a migration is exactly what this table exists to avoid.
-- The keys that matter are listed in `konekt.site_setting_keys` so the console
-- can render a form for them, and so a typo writes a row nobody reads rather
-- than silently overriding a real one.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The settings themselves
-- -----------------------------------------------------------------------------
create table konekt.site_settings (
  key          text primary key,
  value        jsonb not null,

  updated_at   timestamptz not null default now(),
  updated_by   uuid references konekt.staff_users(id) on delete set null,

  constraint setting_key_is_dotted check (key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$')
);

comment on table konekt.site_settings is
  'Admin-editable content and switches. A row here changes the live site '
  'without a deploy; every write is audited like any other staff write.';

-- -----------------------------------------------------------------------------
-- What the console offers to edit
--
-- A catalogue rather than a hardcoded list in the application, so adding a
-- setting is a row here and not a release. `kind` decides the input the console
-- renders; `is_localised` says the value carries one string per locale.
-- -----------------------------------------------------------------------------
create table konekt.site_setting_keys (
  key           text primary key,
  label         text not null,
  help          text,
  kind          text not null
                  check (kind in ('text', 'long_text', 'url', 'email', 'phone', 'boolean', 'number')),
  is_localised  boolean not null default false,
  group_name    text not null,
  display_order smallint not null default 0
);

comment on table konekt.site_setting_keys is
  'The catalogue the settings screen is built from. Adding an editable field '
  'is a row here, not a release.';

insert into konekt.site_setting_keys
  (key, label, help, kind, is_localised, group_name, display_order) values
  ('site.hero_eyebrow',      'Hero eyebrow',        'The small line above the headline.', 'text', true, 'Landing page', 10),
  ('site.hero_subline',      'Hero subline',        'The sentence under the headline.', 'long_text', true, 'Landing page', 20),
  ('site.hero_cta_primary',  'Primary button',      null, 'text', true, 'Landing page', 30),
  ('site.hero_cta_secondary','Secondary button',    null, 'text', true, 'Landing page', 40),
  ('partners.title',         'Partner strip title', null, 'text', true, 'Partners', 10),
  ('partners.note',          'Partner strip note',  'Shown beside the title. Keep it honest about what is signed.', 'text', true, 'Partners', 20),
  ('partners.show_strip',    'Show the partner strip', 'Off hides it from the landing page entirely.', 'boolean', false, 'Partners', 30),
  ('contact.support_email',  'Support email',       null, 'email', false, 'Contact', 10),
  ('contact.support_phone',  'Support phone',       null, 'phone', false, 'Contact', 20),
  ('contact.whatsapp_url',   'WhatsApp link',       null, 'url', false, 'Contact', 30),
  ('membership.open',        'Registration is open','Off puts the membership page into "opening soon".', 'boolean', false, 'Switches', 10),
  ('events.show_samples',    'Show sample events',  'Off hides the sample programme once real events are published.', 'boolean', false, 'Switches', 20);

-- -----------------------------------------------------------------------------
-- Partner logo, uploaded rather than committed
--
-- brand_placements already carries logo_path and the clearance columns that
-- stop an uncleared mark going live (migration 0007). This adds the column the
-- console needs to show who uploaded what, and when — the clearance record says
-- a use was approved, which is a different fact from who put the file there.
-- -----------------------------------------------------------------------------
alter table konekt.brand_placements
  add column uploaded_by uuid references konekt.staff_users(id) on delete set null,
  add column uploaded_at timestamptz;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table konekt.site_settings enable row level security;
alter table konekt.site_settings force row level security;
alter table konekt.site_setting_keys enable row level security;
alter table konekt.site_setting_keys force row level security;

-- The public site reads these on every render; they are the copy on the page.
create policy settings_public_read on konekt.site_settings
  for select to anon, authenticated using (true);
create policy setting_keys_public_read on konekt.site_setting_keys
  for select to anon, authenticated using (true);

-- Writing them changes what every visitor sees, nationally. HQ only — the same
-- bar as the partner strip, for the same reason.
create policy settings_hq_write on konekt.site_settings
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());
create policy setting_keys_hq_write on konekt.site_setting_keys
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

grant select on konekt.site_settings, konekt.site_setting_keys to anon, authenticated;
grant insert, update, delete on konekt.site_settings, konekt.site_setting_keys to authenticated;

-- Audited like every other staff write, and stamped on update.
create trigger site_settings_touch
  before update on konekt.site_settings
  for each row execute function konekt.touch_updated_at();

create trigger site_settings_audit
  after insert or update or delete on konekt.site_settings
  for each row execute function konekt.write_audit();

create trigger site_setting_keys_audit
  after insert or update or delete on konekt.site_setting_keys
  for each row execute function konekt.write_audit();

-- -----------------------------------------------------------------------------
-- Storage for uploaded logos
--
-- Guarded: `storage` exists on Supabase and does not exist on a plain
-- PostgreSQL instance, and the migrations have to keep running on both — the
-- authorisation suite in supabase/tests runs against plain PostGIS.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'partner-logos',
      'partner-logos',
      true,                       -- read by every visitor; it is a logo on a public page
      524288,                     -- 512KB. A logo that needs more than that is a photograph.
      array['image/svg+xml', 'image/png', 'image/webp']
    )
    on conflict (id) do update
      set file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    -- Public read, HQ write. The bucket is public, so the read policy is a
    -- formality; the write policy is not.
    drop policy if exists partner_logos_public_read on storage.objects;
    create policy partner_logos_public_read on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'partner-logos');

    drop policy if exists partner_logos_hq_write on storage.objects;
    create policy partner_logos_hq_write on storage.objects
      for all to authenticated
      using (bucket_id = 'partner-logos' and konekt.is_hq())
      with check (bucket_id = 'partner-logos' and konekt.is_hq());

  end if;
end $$;


-- =============================================================================
-- 20260825000900_products_freelancers_campaigns.sql
-- =============================================================================
-- =============================================================================
-- 0009 — ACCOUNT TYPES AS DATA, FREELANCERS UNDER A BRANCH, CAMPAIGNS WITH SCOPE
--
-- Three changes that share one idea: the things a bank actually changes month
-- to month — the products it sells, the people it pays commission to, who a
-- message goes to — belong in tables that HQ and branches can edit, not in
-- enums and code that need a release.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Account types
--
-- `konekt.account_product` was an enum, so adding a product meant a migration,
-- a deploy, and a gap in between where a branch could not record what it had
-- actually opened. It becomes a table HQ maintains, and accounts_opened points
-- at it. The seven enum values are carried over unchanged so nothing that has
-- been recorded changes meaning.
-- -----------------------------------------------------------------------------
create table konekt.account_products (
  code            text primary key check (code ~ '^[a-z][a-z0-9_]*$'),

  label_en        text not null,
  label_sw        text not null,
  description_en  text,
  description_sw  text,

  -- The rules a branch officer needs at the counter, held with the product
  -- rather than in a memo: who it is for, and whether a guardian is required.
  min_age         smallint,
  max_age         smallint,
  requires_guardian boolean not null default false,

  is_active       boolean not null default true,
  display_order   smallint not null default 0,

  created_by      uuid references konekt.staff_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint product_age_range_is_ordered
    check (min_age is null or max_age is null or max_age >= min_age)
);

comment on table konekt.account_products is
  'The products a branch can record an account against. HQ maintains this; a '
  'new product is a row, not a release. Deactivate rather than delete — an '
  'account opened last year still names the product it was opened on.';

insert into konekt.account_products
  (code, label_en, label_sw, min_age, max_age, requires_guardian, display_order) values
  ('junior_jumbo',     'Junior Jumbo',      'Junior Jumbo',        0,  12, true,  10),
  ('teen_account',     'Teen Account',      'Akaunti ya Vijana',  13,  17, true,  20),
  ('scholar_account',  'Scholar Account',   'Akaunti ya Msomi',   18,  35, false, 30),
  ('malkia_account',   'Malkia Account',    'Akaunti ya Malkia',  18, null, false, 40),
  ('personal_current', 'Personal Current',  'Akaunti ya Kawaida', 18, null, false, 50),
  ('sme_account',      'SME Account',       'Akaunti ya Biashara',18, null, false, 60),
  ('other',            'Other',             'Nyingine',         null, null, false, 99);

-- Repoint accounts_opened. The column is backfilled from the enum before it is
-- made NOT NULL, so no existing row loses its product.
alter table konekt.accounts_opened
  add column product_code text references konekt.account_products(code) on delete restrict;

update konekt.accounts_opened set product_code = product::text;

alter table konekt.accounts_opened
  alter column product_code set not null;

alter table konekt.accounts_opened drop column product;
drop type konekt.account_product;

create index accounts_opened_product_ix on konekt.accounts_opened (product_code);

-- -----------------------------------------------------------------------------
-- 2. Freelancers
--
-- Commission-paid recruiters, registered and controlled by a branch. They are
-- not staff: they have no console role, no scope over anyone else's data, and
-- no access to member records. What they have is their own production —
-- the accounts they sourced — and a branch that answers for them.
-- -----------------------------------------------------------------------------
create table konekt.freelancers (
  id            uuid primary key default gen_random_uuid(),

  -- Optional. Set once they have signed in for the first time, so a freelancer
  -- can be registered by a branch before they have an account of their own.
  auth_user_id  uuid unique,

  full_name     text not null,
  phone_e164    text not null unique
                  check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email         citext,

  -- Who registered them and answers for them. Not nullable: a freelancer with
  -- no branch is a person nobody is responsible for.
  branch_id     uuid not null references konekt.branches(id) on delete restrict,
  -- Denormalised from the branch so a zone manager can see their zone's
  -- freelancers in one query. Maintained by trigger, never written by hand.
  zone_code     konekt.zone_code references konekt.zones(code),

  status        text not null default 'pending'
                  check (status in ('pending', 'active', 'suspended', 'ended')),

  -- What they are paid per account they source, in whole shillings. Held here
  -- rather than computed, because a rate that changes must not silently
  -- restate what was already earned.
  commission_tzs_per_account numeric(10,2),

  registered_by uuid references konekt.staff_users(id) on delete set null,
  registered_at timestamptz not null default now(),
  activated_at  timestamptz,
  suspended_at  timestamptz,
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint active_freelancer_has_been_activated
    check (status <> 'active' or activated_at is not null)
);

comment on table konekt.freelancers is
  'Commission-paid recruiters, registered and controlled by a branch. Not '
  'staff: no scope, no member data, only their own production.';

create index freelancers_branch_ix on konekt.freelancers (branch_id, status);
create index freelancers_zone_ix on konekt.freelancers (zone_code, status);

-- The zone follows the branch. Written here so it cannot drift, and so a zone
-- manager's view of "my freelancers" is one indexed predicate.
create or replace function konekt.freelancer_zone_follows_branch()
returns trigger
language plpgsql
as $$
begin
  select b.zone_code into new.zone_code
  from konekt.branches b
  where b.id = new.branch_id;
  return new;
end;
$$;

create trigger freelancer_zone_sync
  before insert or update of branch_id on konekt.freelancers
  for each row execute function konekt.freelancer_zone_follows_branch();

-- Their production. An account sourced by a freelancer names them, so what
-- they are owed is derived from the same rows the branch reconciles.
alter table konekt.accounts_opened
  add column freelancer_id uuid references konekt.freelancers(id) on delete set null;

create index accounts_opened_freelancer_ix on konekt.accounts_opened (freelancer_id);

comment on column konekt.accounts_opened.freelancer_id is
  'Set when source = ''field_agent'' or ''referral'' and a registered '
  'freelancer produced it. Commission is derived from these rows, never typed.';

-- -----------------------------------------------------------------------------
-- 3. Campaign scope
--
-- A campaign was HQ-only and national. A branch needs to be able to write to
-- its own members — an event reminder is a branch's job — while approval stays
-- with HQ, because a bulk send is a national expense and a national risk.
-- -----------------------------------------------------------------------------
alter table konekt.campaigns
  add column scope_zone_code konekt.zone_code references konekt.zones(code),
  add column scope_branch_id uuid references konekt.branches(id) on delete restrict,
  add column audience_tier   konekt.membership_tier,
  add column queued_at       timestamptz;

comment on column konekt.campaigns.queued_at is
  'When the audience was resolved and the delivery rows written. Distinct from '
  'sent_at, which only a gateway that actually sent may set.';

-- -----------------------------------------------------------------------------
-- Resolving an audience
--
-- One row per member considered, eligible or not, with the reason. Written in
-- a single statement so a member cannot be evaluated twice, and so "confirm a
-- suppressed member received nothing" is answerable from the table afterwards
-- rather than from a log.
-- -----------------------------------------------------------------------------
create or replace function konekt.build_campaign_audience(p_campaign_id uuid)
returns table (considered integer, eligible integer)
language plpgsql
security invoker
set search_path = konekt, public
as $$
declare
  v_campaign konekt.campaigns;
  v_considered integer;
  v_eligible integer;
begin
  select * into v_campaign from konekt.campaigns where id = p_campaign_id;
  if not found then
    raise exception 'Campaign % does not exist, or is not visible to this user', p_campaign_id;
  end if;

  if v_campaign.approved_at is null then
    raise exception 'Campaign % is not approved. An unapproved campaign has no audience.', p_campaign_id;
  end if;

  insert into konekt.campaign_deliveries (campaign_id, member_id, was_eligible, skip_reason)
  select
    p_campaign_id,
    m.id,
    konekt.may_contact(m.id, v_campaign.purpose, v_campaign.channel),
    case
      when m.is_suppressed then 'suppressed'
      when not konekt.may_contact(m.id, v_campaign.purpose, v_campaign.channel)
        then 'no consent on record for this purpose and channel'
      else null
    end
  from konekt.members m
  where (v_campaign.audience_tier is null or m.tier = v_campaign.audience_tier)
  on conflict (campaign_id, member_id) do nothing;

  select count(*), count(*) filter (where was_eligible)
    into v_considered, v_eligible
  from konekt.campaign_deliveries
  where campaign_id = p_campaign_id;

  update konekt.campaigns set queued_at = now() where id = p_campaign_id;

  considered := v_considered;
  eligible := v_eligible;
  return next;
end;
$$;

comment on function konekt.build_campaign_audience is
  'Resolves an approved campaign''s audience into campaign_deliveries, one row '
  'per member considered including the skipped ones. Refuses an unapproved '
  'campaign: maker-checker is not advisory.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table konekt.account_products enable row level security;
alter table konekt.account_products force row level security;
alter table konekt.freelancers enable row level security;
alter table konekt.freelancers force row level security;

-- Products are public: the membership page names them, and a branch officer
-- signed out at a counter still needs the list.
create policy products_public_read on konekt.account_products
  for select to anon, authenticated using (true);
create policy products_hq_write on konekt.account_products
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

-- A branch sees and manages its own freelancers; a zone manager sees the
-- zone's; HQ sees all. Exactly the scope rule everything else uses.
create policy freelancers_staff_read on konekt.freelancers
  for select to authenticated
  using (konekt.staff_can_reach(zone_code, branch_id));
create policy freelancers_staff_write on konekt.freelancers
  for all to authenticated
  using (konekt.staff_can_reach(zone_code, branch_id))
  with check (konekt.staff_can_reach(zone_code, branch_id));

-- A freelancer reads their own record and nothing else. No policy gives them
-- another freelancer's row, their branch's members, or any account but the
-- ones that name them.
create policy freelancers_self_read on konekt.freelancers
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy accounts_freelancer_self_read on konekt.accounts_opened
  for select to authenticated
  using (
    freelancer_id is not null
    and freelancer_id in (
      select id from konekt.freelancers where auth_user_id = auth.uid()
    )
  );

-- Campaigns: any staff user may draft one inside their own scope, and read the
-- ones in it. Approving and sending stay HQ — the existing campaigns_hq policy
-- already covers those, and this adds the narrower door beside it.
create policy campaigns_staff_scope on konekt.campaigns
  for select to authenticated
  using (konekt.is_hq() or konekt.staff_can_reach(scope_zone_code, scope_branch_id));

create policy campaigns_staff_draft on konekt.campaigns
  for insert to authenticated
  with check (
    approved_at is null
    and sent_at is null
    and konekt.staff_can_reach(scope_zone_code, scope_branch_id)
  );

grant select on konekt.account_products to anon, authenticated;
grant insert, update, delete on konekt.account_products to authenticated;
grant select, insert, update, delete on konekt.freelancers to authenticated;
grant execute on function konekt.build_campaign_audience(uuid) to authenticated;

-- Touched and audited like every other staff-writable table.
do $$
declare t text;
begin
  foreach t in array array['account_products', 'freelancers'] loop
    execute format(
      'create trigger %I_touch before update on konekt.%I
       for each row execute function konekt.touch_updated_at()', t, t);
    execute format(
      'create trigger %I_audit after insert or update or delete on konekt.%I
       for each row execute function konekt.write_audit()', t, t);
  end loop;
end $$;
