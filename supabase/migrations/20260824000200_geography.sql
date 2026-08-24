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
