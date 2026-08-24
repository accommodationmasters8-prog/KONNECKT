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
