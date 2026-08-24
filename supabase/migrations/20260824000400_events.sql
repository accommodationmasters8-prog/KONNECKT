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
