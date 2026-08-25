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
