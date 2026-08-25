-- =============================================================================
-- 0011 — THE TRACKER
--
-- The internal tool: what CRDB is tracking, where, who reported it, and what it
-- adds up to. Three levels and no more — HQ, zone, branch — reusing the scope
-- rule the rest of the schema already enforces (konekt.staff_can_reach).
--
-- The shape:
--
--   category            a kind of place worth tracking — Universities,
--                       Secondary schools, SACCOS, Companies, Barracks
--     station           one named institution, organisation, school or group,
--                       belonging to exactly one branch
--       report          what that station looked like in one month:
--                       portfolio, accounts, deposits, dormancy, loans
--         by product    the same month broken down by account type
--         by loan       and by loan type
--
-- Reports are monthly snapshots rather than running totals. A running total
-- cannot answer "what changed in March", cannot be corrected without losing
-- the original, and cannot be charted. A snapshot per period can do all three,
-- and the unique constraint on (station, month) is what stops the same month
-- being reported twice by two people.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Loan products — the same pattern as account_products in 0009.
-- HQ maintains the list; a new loan type is a row, not a release.
-- -----------------------------------------------------------------------------
create table konekt.loan_products (
  code          text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  label_en      text not null,
  label_sw      text not null,
  description_en text,
  is_active     boolean not null default true,
  display_order smallint not null default 0,
  created_by    uuid references konekt.staff_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

insert into konekt.loan_products (code, label_en, label_sw, display_order) values
  ('salaried_worker', 'Salaried worker loan', 'Mkopo wa mwajiriwa', 10),
  ('student_loan',    'Student loan',         'Mkopo wa mwanafunzi', 20),
  ('sme_loan',        'SME loan',             'Mkopo wa biashara ndogo', 30),
  ('agri_loan',       'Agriculture loan',     'Mkopo wa kilimo', 40),
  ('group_loan',      'Group loan',           'Mkopo wa kikundi', 50),
  ('asset_finance',   'Asset finance',        'Ufadhili wa mali', 60),
  ('overdraft',       'Overdraft',            'Overdraft', 70),
  ('other_loan',      'Other',                'Mkopo mwingine', 99);

-- -----------------------------------------------------------------------------
-- Categories
--
-- National. A category created by one branch and a near-identical one created
-- by another is how the same report becomes two incomparable reports, so the
-- list is HQ's — the same argument as account types.
-- -----------------------------------------------------------------------------
create table konekt.tracker_categories (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z][a-z0-9-]*$'),
  name_en       text not null,
  name_sw       text not null,
  description   text,

  -- What a "person" is in this category, so the portfolio figure means
  -- something: students, employees, members, residents.
  member_noun_en text not null default 'people',
  member_noun_sw text not null default 'watu',

  colour        text not null default 'teal'
                  check (colour in ('teal', 'green', 'gold', 'pink', 'ink')),
  is_active     boolean not null default true,
  display_order smallint not null default 0,

  created_by    uuid references konekt.staff_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table konekt.tracker_categories is
  'What kind of place is being tracked. National and HQ-maintained: two '
  'branches inventing "University" and "Universities" produce two reports '
  'nobody can add together.';

-- -----------------------------------------------------------------------------
-- Stations
--
-- One named place. Belongs to exactly one branch, which is what makes the
-- whole hierarchy work: a branch sees its own, a zone sees its branches', HQ
-- sees all, from one predicate rather than three queries.
-- -----------------------------------------------------------------------------
create table konekt.stations (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references konekt.tracker_categories(id) on delete restrict,

  name          text not null,
  short_name    text,

  branch_id     uuid not null references konekt.branches(id) on delete restrict,
  -- Denormalised from the branch by trigger. A zone manager's whole view
  -- depends on this column, and it must never disagree with the branch.
  zone_code     konekt.zone_code references konekt.zones(code),

  region_id     uuid references konekt.regions(id) on delete set null,
  district_name text,
  address       text,

  -- Coordinates, for the map. Nullable and unverified by default: a pin that
  -- was guessed is worse than no pin, and the public map reads only the ones
  -- a person has confirmed.
  point         geography(Point, 4326),
  point_verified_at timestamptz,
  point_verified_by uuid references konekt.staff_users(id) on delete set null,

  contact_name  text,
  contact_role  text,
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  contact_email text,

  status        text not null default 'active'
                  check (status in ('prospect', 'active', 'paused', 'closed')),
  notes         text,

  -- The last reported headcount, maintained by trigger from the newest report
  -- so a list of 300 stations does not need 300 subqueries to show coverage.
  portfolio     integer check (portfolio is null or portfolio >= 0),
  last_report_month date,

  created_by    uuid references konekt.staff_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (category_id, branch_id, name)
);

comment on column konekt.stations.portfolio is
  'The headcount from the most recent report, kept here by trigger. The '
  'authoritative history is in station_reports; this is a cache so a list '
  'view is one query.';

create index stations_category_ix on konekt.stations (category_id, status);
create index stations_branch_ix on konekt.stations (branch_id, status);
create index stations_zone_ix on konekt.stations (zone_code, status);
create index stations_point_gix on konekt.stations using gist (point);

-- -----------------------------------------------------------------------------
-- Reports — one row per station per month
-- -----------------------------------------------------------------------------
create table konekt.station_reports (
  id            uuid primary key default gen_random_uuid(),
  station_id    uuid not null references konekt.stations(id) on delete cascade,
  period_month  date not null,

  -- The denominator for every coverage figure on this station.
  portfolio     integer not null check (portfolio >= 0),

  accounts_opened  integer not null default 0 check (accounts_opened >= 0),
  active_accounts  integer not null default 0 check (active_accounts >= 0),
  dormant_accounts integer not null default 0 check (dormant_accounts >= 0),

  deposits_tzs     numeric(16,2) not null default 0 check (deposits_tzs >= 0),

  loans_count      integer not null default 0 check (loans_count >= 0),
  loans_value_tzs  numeric(16,2) not null default 0 check (loans_value_tzs >= 0),

  note          text,

  submitted_by  uuid references konekt.staff_users(id) on delete set null,
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (station_id, period_month),
  constraint report_period_is_first_of_month check (extract(day from period_month) = 1),
  -- Cumulative accounts cannot be smaller than the parts of them that are
  -- still active or have gone dormant.
  constraint accounts_add_up check (active_accounts + dormant_accounts <= accounts_opened)
);

comment on table konekt.station_reports is
  'A monthly snapshot, not a running total. A running total cannot say what '
  'changed in March, cannot be corrected without losing the original, and '
  'cannot be charted.';

comment on constraint accounts_add_up on konekt.station_reports is
  'Active plus dormant cannot exceed the accounts ever opened there. The '
  'commonest data-entry error in a branch report, caught at write time.';

create index station_reports_period_ix on konekt.station_reports (period_month desc);
create index station_reports_station_ix on konekt.station_reports (station_id, period_month desc);

-- Breakdown by account type. Present when the branch has it; the header totals
-- stand on their own when it does not.
create table konekt.station_report_accounts (
  report_id     uuid not null references konekt.station_reports(id) on delete cascade,
  product_code  text not null references konekt.account_products(code) on delete restrict,

  opened        integer not null default 0 check (opened >= 0),
  active        integer not null default 0 check (active >= 0),
  dormant       integer not null default 0 check (dormant >= 0),
  deposits_tzs  numeric(16,2) not null default 0 check (deposits_tzs >= 0),

  primary key (report_id, product_code)
);

create table konekt.station_report_loans (
  report_id     uuid not null references konekt.station_reports(id) on delete cascade,
  loan_code     text not null references konekt.loan_products(code) on delete restrict,

  count         integer not null default 0 check (count >= 0),
  value_tzs     numeric(16,2) not null default 0 check (value_tzs >= 0),

  primary key (report_id, loan_code)
);

-- -----------------------------------------------------------------------------
-- Keeping the station's cached figures true
-- -----------------------------------------------------------------------------
create or replace function konekt.station_follows_latest_report()
returns trigger
language plpgsql
as $$
declare
  v_station uuid := coalesce(new.station_id, old.station_id);
begin
  update konekt.stations s
  set portfolio = r.portfolio,
      last_report_month = r.period_month
  from (
    select portfolio, period_month
    from konekt.station_reports
    where station_id = v_station
    order by period_month desc
    limit 1
  ) r
  where s.id = v_station;

  return coalesce(new, old);
end;
$$;

create trigger station_reports_update_station
  after insert or update or delete on konekt.station_reports
  for each row execute function konekt.station_follows_latest_report();

-- The zone follows the branch, always.
create or replace function konekt.station_zone_follows_branch()
returns trigger
language plpgsql
as $$
begin
  select b.zone_code into new.zone_code
  from konekt.branches b where b.id = new.branch_id;
  return new;
end;
$$;

create trigger stations_zone_sync
  before insert or update of branch_id on konekt.stations
  for each row execute function konekt.station_zone_follows_branch();

-- -----------------------------------------------------------------------------
-- Events tracker
--
-- Not registration. This records events that happened or are planned, with the
-- numbers that make them comparable: who came, what it cost, what it produced.
-- Past or upcoming is derived from the date rather than typed, because a
-- status somebody has to remember to change is a status that goes stale.
-- -----------------------------------------------------------------------------
create table konekt.tracked_events (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,

  event_date    date not null,
  end_date      date,

  branch_id     uuid not null references konekt.branches(id) on delete restrict,
  zone_code     konekt.zone_code references konekt.zones(code),
  station_id    uuid references konekt.stations(id) on delete set null,
  category_id   uuid references konekt.tracker_categories(id) on delete set null,

  venue         text not null,
  address       text,
  point         geography(Point, 4326),

  participants  integer check (participants is null or participants >= 0),
  budget_tzs    numeric(14,2) check (budget_tzs is null or budget_tzs >= 0),
  actual_spend_tzs numeric(14,2) check (actual_spend_tzs is null or actual_spend_tzs >= 0),

  -- What the event produced, in the same words the station reports use.
  accounts_opened integer check (accounts_opened is null or accounts_opened >= 0),
  deposits_tzs    numeric(16,2) check (deposits_tzs is null or deposits_tzs >= 0),

  -- An album lives wherever Marketing keeps it; this is the link to it.
  album_url     text,
  notes         text,

  created_by    uuid references konekt.staff_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint event_ends_after_it_starts check (end_date is null or end_date >= event_date)
);

comment on table konekt.tracked_events is
  'The events tracker. Nobody registers through this — it records what took '
  'place, what it cost and what it produced, so events can be compared.';

create index tracked_events_date_ix on konekt.tracked_events (event_date desc);
create index tracked_events_branch_ix on konekt.tracked_events (branch_id, event_date desc);
create index tracked_events_zone_ix on konekt.tracked_events (zone_code, event_date desc);

create or replace function konekt.tracked_event_zone_follows_branch()
returns trigger
language plpgsql
as $$
begin
  select b.zone_code into new.zone_code
  from konekt.branches b where b.id = new.branch_id;
  return new;
end;
$$;

create trigger tracked_events_zone_sync
  before insert or update of branch_id on konekt.tracked_events
  for each row execute function konekt.tracked_event_zone_follows_branch();

-- Ten images, enforced. A limit that lives in a form is a limit until somebody
-- writes a second form.
create table konekt.tracked_event_images (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references konekt.tracked_events(id) on delete cascade,
  storage_path  text,
  external_url  text,
  caption       text,
  display_order smallint not null default 0,
  uploaded_by   uuid references konekt.staff_users(id) on delete set null,
  uploaded_at   timestamptz not null default now(),

  constraint image_has_a_source check (storage_path is not null or external_url is not null)
);

create index tracked_event_images_event_ix on konekt.tracked_event_images (event_id, display_order);

create or replace function konekt.limit_event_images()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from konekt.tracked_event_images
  where event_id = new.event_id;

  if v_count >= 10 then
    raise exception 'An event carries at most 10 images'
      using errcode = 'check_violation',
            hint = 'Remove one first, or put the rest in the album link.';
  end if;

  return new;
end;
$$;

create trigger tracked_event_images_cap
  before insert on konekt.tracked_event_images
  for each row execute function konekt.limit_event_images();

-- -----------------------------------------------------------------------------
-- Reporting views
--
-- The analytics read from here rather than from the application computing the
-- same ratio four different ways on four different screens.
-- -----------------------------------------------------------------------------
-- security_invoker so the view is filtered by the *reader's* row level
-- security, not the view owner's. Without it a view is a hole straight
-- through RLS: it runs as whoever created it, and every branch would read
-- every other branch's reports through it.
create or replace view konekt.station_latest
with (security_invoker = true) as
  select distinct on (r.station_id)
    r.station_id,
    r.id as report_id,
    r.period_month,
    r.portfolio,
    r.accounts_opened,
    r.active_accounts,
    r.dormant_accounts,
    r.deposits_tzs,
    r.loans_count,
    r.loans_value_tzs,
    -- Coverage: how much of the place actually banks with CRDB.
    case when r.portfolio > 0
      then round((r.accounts_opened::numeric / r.portfolio) * 100, 1)
      else null end as coverage_pct,
    -- Of the accounts opened, how many are still alive.
    case when r.accounts_opened > 0
      then round((r.active_accounts::numeric / r.accounts_opened) * 100, 1)
      else null end as active_pct,
    case when r.accounts_opened > 0
      then round((r.dormant_accounts::numeric / r.accounts_opened) * 100, 1)
      else null end as dormancy_pct
  from konekt.station_reports r
  order by r.station_id, r.period_month desc;

comment on view konekt.station_latest is
  'The newest report per station, with the three ratios every screen shows. '
  'Computed once, here, so coverage cannot mean one thing on the station page '
  'and another on the overview.';

create or replace view konekt.category_totals
with (security_invoker = true) as
  select
    c.id as category_id,
    c.slug,
    c.name_en,
    c.name_sw,
    c.colour,
    count(s.id) filter (where s.status = 'active') as active_stations,
    count(s.id) as stations,
    coalesce(sum(l.portfolio), 0) as portfolio,
    coalesce(sum(l.accounts_opened), 0) as accounts_opened,
    coalesce(sum(l.active_accounts), 0) as active_accounts,
    coalesce(sum(l.dormant_accounts), 0) as dormant_accounts,
    coalesce(sum(l.deposits_tzs), 0) as deposits_tzs,
    coalesce(sum(l.loans_count), 0) as loans_count,
    coalesce(sum(l.loans_value_tzs), 0) as loans_value_tzs,
    case when coalesce(sum(l.portfolio), 0) > 0
      then round((coalesce(sum(l.accounts_opened), 0)::numeric
                  / sum(l.portfolio)) * 100, 1)
      else null end as coverage_pct
  from konekt.tracker_categories c
  left join konekt.stations s on s.category_id = c.id
  left join konekt.station_latest l on l.station_id = s.id
  group by c.id, c.slug, c.name_en, c.name_sw, c.colour;

comment on view konekt.category_totals is
  'A category as one row. Every figure is the sum of its stations newest '
  'reports — never a stored total that drifts from the rows under it.';

-- -----------------------------------------------------------------------------
-- RLS — the same three levels, the same one predicate
-- -----------------------------------------------------------------------------
alter table konekt.loan_products enable row level security;
alter table konekt.loan_products force row level security;
alter table konekt.tracker_categories enable row level security;
alter table konekt.tracker_categories force row level security;
alter table konekt.stations enable row level security;
alter table konekt.stations force row level security;
alter table konekt.station_reports enable row level security;
alter table konekt.station_reports force row level security;
alter table konekt.station_report_accounts enable row level security;
alter table konekt.station_report_accounts force row level security;
alter table konekt.station_report_loans enable row level security;
alter table konekt.station_report_loans force row level security;
alter table konekt.tracked_events enable row level security;
alter table konekt.tracked_events force row level security;
alter table konekt.tracked_event_images enable row level security;
alter table konekt.tracked_event_images force row level security;

-- Reference lists: any signed-in staff user reads them, HQ maintains them.
create policy loan_products_staff_read on konekt.loan_products
  for select to authenticated using (konekt.is_staff());
create policy loan_products_hq_write on konekt.loan_products
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

create policy categories_staff_read on konekt.tracker_categories
  for select to authenticated using (konekt.is_staff());
create policy categories_hq_write on konekt.tracker_categories
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

-- Stations, and everything hanging off them, are scoped by branch and zone.
create policy stations_scope_read on konekt.stations
  for select to authenticated
  using (konekt.staff_can_reach(zone_code, branch_id));
create policy stations_scope_write on konekt.stations
  for all to authenticated
  using (konekt.staff_can_reach(zone_code, branch_id))
  with check (konekt.staff_can_reach(zone_code, branch_id));

create policy station_reports_scope on konekt.station_reports
  for all to authenticated
  using (exists (
    select 1 from konekt.stations s
    where s.id = konekt.station_reports.station_id
      and konekt.staff_can_reach(s.zone_code, s.branch_id)))
  with check (exists (
    select 1 from konekt.stations s
    where s.id = konekt.station_reports.station_id
      and konekt.staff_can_reach(s.zone_code, s.branch_id)));

create policy report_accounts_scope on konekt.station_report_accounts
  for all to authenticated
  using (exists (
    select 1 from konekt.station_reports r
    join konekt.stations s on s.id = r.station_id
    where r.id = konekt.station_report_accounts.report_id
      and konekt.staff_can_reach(s.zone_code, s.branch_id)))
  with check (exists (
    select 1 from konekt.station_reports r
    join konekt.stations s on s.id = r.station_id
    where r.id = konekt.station_report_accounts.report_id
      and konekt.staff_can_reach(s.zone_code, s.branch_id)));

create policy report_loans_scope on konekt.station_report_loans
  for all to authenticated
  using (exists (
    select 1 from konekt.station_reports r
    join konekt.stations s on s.id = r.station_id
    where r.id = konekt.station_report_loans.report_id
      and konekt.staff_can_reach(s.zone_code, s.branch_id)))
  with check (exists (
    select 1 from konekt.station_reports r
    join konekt.stations s on s.id = r.station_id
    where r.id = konekt.station_report_loans.report_id
      and konekt.staff_can_reach(s.zone_code, s.branch_id)));

create policy tracked_events_scope on konekt.tracked_events
  for all to authenticated
  using (konekt.staff_can_reach(zone_code, branch_id))
  with check (konekt.staff_can_reach(zone_code, branch_id));

create policy event_images_scope on konekt.tracked_event_images
  for all to authenticated
  using (exists (
    select 1 from konekt.tracked_events e
    where e.id = konekt.tracked_event_images.event_id
      and konekt.staff_can_reach(e.zone_code, e.branch_id)))
  with check (exists (
    select 1 from konekt.tracked_events e
    where e.id = konekt.tracked_event_images.event_id
      and konekt.staff_can_reach(e.zone_code, e.branch_id)));

-- The public map shows pins, and only pins a person has confirmed.
create policy stations_public_pins on konekt.stations
  for select to anon
  using (point is not null and point_verified_at is not null and status = 'active');

grant select on konekt.tracker_categories, konekt.loan_products,
  konekt.stations, konekt.station_reports, konekt.station_report_accounts,
  konekt.station_report_loans, konekt.tracked_events,
  konekt.tracked_event_images, konekt.station_latest, konekt.category_totals
  to authenticated;
grant select on konekt.stations to anon;
grant insert, update, delete on konekt.tracker_categories, konekt.loan_products,
  konekt.stations, konekt.station_reports, konekt.station_report_accounts,
  konekt.station_report_loans, konekt.tracked_events, konekt.tracked_event_images
  to authenticated;

-- Touched and audited like everything else a staff user writes.
do $$
declare t text;
begin
  foreach t in array array[
    'loan_products', 'tracker_categories', 'stations', 'station_reports',
    'tracked_events'
  ] loop
    execute format(
      'create trigger %I_touch before update on konekt.%I
       for each row execute function konekt.touch_updated_at()', t, t);
    execute format(
      'create trigger %I_audit after insert or update or delete on konekt.%I
       for each row execute function konekt.write_audit()', t, t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- The same hole, in views that already shipped
--
-- konekt.consent_current and konekt.institution_rollup were created before
-- security_invoker was set on anything, and migration 0006 grants SELECT on
-- every table in the schema — which includes views. A view without
-- security_invoker executes with its owner's rights, so consent_current was
-- returning every member's consent history to any signed-in user, straight
-- past the policy on consent_records that was written to stop exactly that.
--
-- Closed here rather than in a migration of its own because it is the same
-- mistake as the one above, and finding it twice is worth fixing once.
-- -----------------------------------------------------------------------------
alter view konekt.consent_current set (security_invoker = true);
alter view konekt.institution_rollup set (security_invoker = true);
alter view konekt.verified_locations set (security_invoker = true);
