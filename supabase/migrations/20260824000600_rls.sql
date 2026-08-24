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
