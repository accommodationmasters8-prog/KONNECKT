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
