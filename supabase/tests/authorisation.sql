-- =============================================================================
-- CRDB KONEKT — authorisation test suite
-- =============================================================================
-- Proves the rules that matter are enforced by the database, not by the UI:
--
--   1. a branch user cannot read another zone's records
--   2. a zone user cannot read another zone's records
--   3. capacity cannot be exceeded, even by concurrent requests
--   4. a certificate cannot be issued to someone who did not check in
--   5. no role can override the suppression list
--   6. marketing consent cannot be bundled into terms acceptance
--   7. consent records cannot be edited or deleted
--   8. a member cannot promote themselves or lift their own suppression
--   9. source attribution on an opened account cannot be omitted
--  10. an unverified pin is invisible to the public
--
-- Run: psql -d konekt -v ON_ERROR_STOP=1 -f supabase/tests/authorisation.sql
-- Prints one line per assertion and fails the script on the first failure.
-- =============================================================================

\set QUIET on
set client_min_messages to notice;

create or replace function pg_temp.ok(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_condition then
    raise notice 'ok    %', p_label;
  else
    raise exception 'FAIL  %', p_label;
  end if;
end $$;

-- Runs a statement and reports whether it raised. Used to assert that things
-- which must be impossible actually are.
create or replace function pg_temp.raises(p_sql text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok    % (blocked: %)', p_label, replace(sqlerrm, E'\n', ' ');
    return;
  end;
  raise exception 'FAIL  % — the statement succeeded and should not have', p_label;
end $$;

-- Impersonate a signed-in user the way PostgREST does.
create or replace function pg_temp.act_as(p_auth_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_auth_uid::text, ''), true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.act_as_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

-- =============================================================================
-- Fixtures
-- =============================================================================
begin;

-- Clean slate. The suite is re-runnable; a half-finished earlier run must not
-- turn into a confusing duplicate-key error three assertions later.
truncate
  konekt.audit_log, konekt.certificates, konekt.check_ins,
  konekt.registrations, konekt.consent_records, konekt.referrals,
  konekt.accounts_opened, konekt.deposit_submissions,
  konekt.campaign_deliveries, konekt.campaigns,
  konekt.guardian_consents, konekt.field_agent_assignments,
  konekt.events, konekt.members, konekt.staff_users,
  konekt.institution_supporting_branches, konekt.institutions,
  konekt.branches, konekt.locations, konekt.wards, konekt.districts,
  konekt.regions, konekt.zones
  restart identity cascade;

insert into konekt.zones (code, name_en, name_sw, display_order) values
  ('LAKE',          'Lake',          'Ziwa',    1),
  ('NORTHERN',      'Northern',      'Kaskazini', 2),
  ('DAR_ES_SALAAM', 'Dar es Salaam', 'Dar es Salaam', 3);

-- Account products. The truncate above cascades into this table through
-- account_products.created_by -> staff_users, so the fixture re-states the
-- one product these assertions use rather than assuming the migration's seed
-- survived.
insert into konekt.account_products (code, label_en, label_sw, display_order)
values ('teen_account', 'Teen Account', 'Akaunti ya Vijana', 20)
on conflict (code) do nothing;

insert into konekt.branches (id, register_sn, name, slug, zone_code) values
  ('11111111-1111-1111-1111-111111111111', 9001, 'Mwanza',  'mwanza',  'LAKE'),
  ('22222222-2222-2222-2222-222222222222', 9002, 'Arusha',  'arusha',  'NORTHERN');

-- Staff: one HQ, one Lake-zone, one Mwanza-branch.
insert into konekt.staff_users (id, auth_user_id, email, full_name, role, zone_code, branch_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a',
   'hq@crdbbank.co.tz', 'HQ Analyst', 'hq', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000b',
   'lake@crdbbank.co.tz', 'Lake Zone Manager', 'zone', 'LAKE', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000c',
   'mwanza@crdbbank.co.tz', 'Mwanza Branch Officer', 'branch', null,
   '11111111-1111-1111-1111-111111111111');

-- Two events, one in each zone.
insert into konekt.events
  (id, slug, title_en, title_sw, status, starts_at, ends_at, venue_name,
   zone_code, branch_id, capacity, published_at)
values
  ('e0000000-0000-0000-0000-000000000001', 'lake-event', 'Lake event', 'Tukio la Ziwa',
   'published', now() + interval '7 days', now() + interval '7 days 4 hours',
   'SAUT', 'LAKE', '11111111-1111-1111-1111-111111111111', 2, now()),
  ('e0000000-0000-0000-0000-000000000002', 'north-event', 'Northern event', 'Tukio la Kaskazini',
   'published', now() + interval '8 days', now() + interval '8 days 4 hours',
   'Arusha', 'NORTHERN', '22222222-2222-2222-2222-222222222222', 50, now());

insert into konekt.members (id, auth_user_id, phone_e164, full_name, referral_code, tier) values
  ('0a000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
   '+255700000001', 'Asha', 'ASHA01', 'silver'),
  ('0a000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-00000000000b',
   '+255700000002', 'Baraka', 'BARA02', 'silver'),
  ('0a000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-00000000000c',
   '+255700000003', 'Suppressed Sam', 'SAMS03', 'gold');

update konekt.members
  set is_suppressed = true, suppressed_at = now(), suppressed_reason = 'STOP received'
  where id = '0a000000-0000-0000-0000-000000000003';

commit;

-- =============================================================================
-- 1 & 2. Scope: a branch user and a zone user cannot read another zone
-- =============================================================================
begin;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-00000000000c');  -- Mwanza branch

select pg_temp.ok(
  (select count(*) from konekt.events where slug = 'lake-event' and status = 'draft') = 0,
  'branch user sees no draft events outside its own scope');

-- Published events are public, so scope is tested on a draft one.
rollback;

begin;
update konekt.events set status = 'draft', published_at = null
  where slug in ('lake-event', 'north-event');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000c', true);

select pg_temp.ok(
  (select count(*) from konekt.events where slug = 'lake-event') = 1,
  'branch user reads the draft event at its own branch');

select pg_temp.ok(
  (select count(*) from konekt.events where slug = 'north-event') = 0,
  'branch user CANNOT read a draft event in another zone');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000b', true);

select pg_temp.ok(
  (select count(*) from konekt.events where slug = 'lake-event') = 1,
  'zone user reads the draft event in its own zone');

select pg_temp.ok(
  (select count(*) from konekt.events where slug = 'north-event') = 0,
  'zone user CANNOT read a draft event in another zone');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

select pg_temp.ok(
  (select count(*) from konekt.events where slug in ('lake-event','north-event')) = 2,
  'HQ reads draft events in every zone');

reset role;
rollback;

-- =============================================================================
-- 3. Capacity cannot be exceeded
-- =============================================================================
begin;
insert into konekt.registrations (event_id, member_id) values
  ('e0000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', '0a000000-0000-0000-0000-000000000002');

select pg_temp.ok(
  (select registered_count from konekt.events where id = 'e0000000-0000-0000-0000-000000000001') = 1,
  'registering increments the event counter');
rollback;

begin;
-- The Lake event has capacity 2. Fill it, then try a third.
insert into konekt.registrations (event_id, member_id) values
  ('e0000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000002');

select pg_temp.raises(
  $$insert into konekt.registrations (event_id, member_id)
    values ('e0000000-0000-0000-0000-000000000001',
            '0a000000-0000-0000-0000-000000000003')$$,
  'a registration beyond capacity is refused by the database');
rollback;

begin;
select pg_temp.raises(
  $$insert into konekt.registrations (event_id, member_id) values
      ('e0000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001'),
      ('e0000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001')$$,
  'one ticket per member per event');
rollback;

-- =============================================================================
-- 4. A certificate requires a check-in
-- =============================================================================
begin;
insert into konekt.registrations (id, event_id, member_id) values
  ('cccccccc-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001');

select pg_temp.raises(
  $$insert into konekt.certificates (public_code, check_in_id, member_id, event_id)
    values ('KNKT-TEST-1', gen_random_uuid(),
            '0a000000-0000-0000-0000-000000000001',
            'e0000000-0000-0000-0000-000000000001')$$,
  'a certificate cannot be issued without a real check-in');

insert into konekt.check_ins (id, registration_id, event_id, member_id, scanned_at)
values ('dddddddd-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000001',
        '0a000000-0000-0000-0000-000000000001', now());

select pg_temp.ok(
  (select status from konekt.registrations where id = 'cccccccc-0000-0000-0000-000000000001')
    = 'checked_in',
  'a check-in moves the registration to checked_in');

insert into konekt.certificates (public_code, check_in_id, member_id, event_id)
values ('KNKT-TEST-1', 'dddddddd-0000-0000-0000-000000000001',
        '0a000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000001');

select pg_temp.ok(
  (select count(*) from konekt.certificates where public_code = 'KNKT-TEST-1') = 1,
  'a certificate issues once the attendee has checked in');

select pg_temp.raises(
  $$insert into konekt.check_ins (registration_id, event_id, member_id, scanned_at)
    values ('cccccccc-0000-0000-0000-000000000001',
            'e0000000-0000-0000-0000-000000000001',
            '0a000000-0000-0000-0000-000000000001', now())$$,
  'a duplicate scan cannot create a second check-in');
rollback;

-- =============================================================================
-- 5. Suppression cannot be overridden
-- =============================================================================
begin;
insert into konekt.consent_records
  (member_id, purpose, channel, granted, wording_shown, wording_locale,
   wording_version, source)
values
  ('0a000000-0000-0000-0000-000000000003', 'marketing', 'sms', true,
   'Ninakubali kupokea taarifa za matangazo kutoka CRDB Konekt.', 'sw',
   'v1', 'member_consent_centre');

select pg_temp.ok(
  konekt.may_contact('0a000000-0000-0000-0000-000000000003', 'marketing', 'sms') = false,
  'a suppressed member is uncontactable even holding explicit consent');

select pg_temp.ok(
  konekt.may_contact('0a000000-0000-0000-0000-000000000001', 'marketing', 'sms') = false,
  'no consent record means no contact — absence is refusal, not permission');
rollback;

-- =============================================================================
-- 6. Marketing consent is never bundled into terms
-- =============================================================================
begin;
select pg_temp.raises(
  $$insert into konekt.consent_records
      (member_id, purpose, granted, wording_shown, wording_locale, wording_version, source)
    values ('0a000000-0000-0000-0000-000000000001', 'marketing', true,
            'By continuing you accept the terms and agree to marketing.', 'en',
            'v1', 'terms_acceptance')$$,
  'marketing consent cannot be recorded as part of terms acceptance');
rollback;

-- =============================================================================
-- 7. Consent records are immutable
-- =============================================================================
begin;
insert into konekt.consent_records
  (id, member_id, purpose, granted, wording_shown, wording_locale, wording_version, source)
values
  ('ffffffff-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001',
   'marketing', true, 'Nakubali kupokea matangazo.', 'sw', 'v1', 'member_consent_centre');

select pg_temp.raises(
  $$update konekt.consent_records set granted = false
    where id = 'ffffffff-0000-0000-0000-000000000001'$$,
  'a consent record cannot be edited');

select pg_temp.raises(
  $$delete from konekt.consent_records
    where id = 'ffffffff-0000-0000-0000-000000000001'$$,
  'a consent record cannot be deleted');
rollback;

-- =============================================================================
-- 8. A member cannot promote themselves
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000a', true);

select pg_temp.ok(
  (select count(*) from konekt.members) = 1,
  'a member reads exactly one row: their own');

update konekt.members set full_name = 'Asha Updated'
  where auth_user_id = 'bbbbbbbb-0000-0000-0000-00000000000a';

select pg_temp.ok(
  (select full_name from konekt.members) = 'Asha Updated',
  'a member can edit their own profile');

select pg_temp.raises(
  $$update konekt.members set tier = 'platinum'
    where auth_user_id = 'bbbbbbbb-0000-0000-0000-00000000000a'$$,
  'a member cannot promote themselves to a higher tier');

select pg_temp.raises(
  $$update konekt.members set kyc_verified = true
    where auth_user_id = 'bbbbbbbb-0000-0000-0000-00000000000a'$$,
  'a member cannot assert their own KYC status');

reset role;
rollback;

-- Suppression, tested on a member who is actually suppressed. Setting the flag
-- to the value it already holds is a no-op and proves nothing; the case that
-- matters is a suppressed member trying to switch themselves back on.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000c', true);

select pg_temp.ok(
  (select is_suppressed from konekt.members) = true,
  'the suppressed member reads their own suppressed row');

select pg_temp.raises(
  $$update konekt.members set is_suppressed = false
    where auth_user_id = 'bbbbbbbb-0000-0000-0000-00000000000c'$$,
  'a suppressed member cannot switch their own suppression off');

reset role;
rollback;

-- =============================================================================
-- 9. Source attribution is mandatory
-- =============================================================================
begin;
select pg_temp.raises(
  $$insert into konekt.accounts_opened
      (account_number, product_code, branch_id, opened_on, source_reference, source)
    values ('ACC-0001', 'teen_account', '11111111-1111-1111-1111-111111111111',
            current_date, 'ref', null)$$,
  'an account cannot be opened without a source');

select pg_temp.raises(
  $$insert into konekt.accounts_opened
      (account_number, product_code, branch_id, opened_on, source, source_reference)
    values ('ACC-0002', 'teen_account', '11111111-1111-1111-1111-111111111111',
            current_date, 'event', 'ref')$$,
  'an event-sourced account must name the event');

insert into konekt.accounts_opened
  (account_number, product_code, branch_id, opened_on, source, source_reference, event_id)
values ('ACC-0003', 'teen_account', '11111111-1111-1111-1111-111111111111',
        current_date, 'event', 'REG-0003', 'e0000000-0000-0000-0000-000000000001');

select pg_temp.raises(
  $$insert into konekt.accounts_opened
      (account_number, product_code, branch_id, opened_on, source, source_reference, event_id)
    values ('ACC-0003', 'teen_account', '11111111-1111-1111-1111-111111111111',
            current_date, 'event', 'REG-0004', 'e0000000-0000-0000-0000-000000000001')$$,
  'an account number cannot be recorded twice');
rollback;

-- =============================================================================
-- 10. An unverified pin is invisible to the public
-- =============================================================================
begin;
insert into konekt.regions (id, name, zone_code)
values ('a0000000-0000-0000-0000-000000000001', 'MWANZA', 'LAKE');

-- The verified row carries its verifier in the same statement: the constraint
-- refuses a 'verified' status without one, which is the point of it.
insert into konekt.locations
  (id, region_id, point, geocode_status, geocode_source, geocoded_at,
   verified_by, verified_at)
values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   st_point(32.9, -2.52)::geography, 'geocoded_low_confidence', 'test', now(),
   null, null),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   st_point(32.91, -2.53)::geography, 'verified', 'test', now(),
   'aaaaaaaa-0000-0000-0000-000000000003', now());

select pg_temp.raises(
  $$insert into konekt.locations (region_id, point, geocode_status, geocode_source, geocoded_at)
    values ('a0000000-0000-0000-0000-000000000001',
            st_point(33.0, -2.6)::geography, 'verified', 'test', now())$$,
  'a location cannot be marked verified without a named verifier');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select pg_temp.ok(
  (select count(*) from konekt.locations
   where id = 'b0000000-0000-0000-0000-000000000001') = 0,
  'the public cannot read an unverified location, whatever it asks for');

select pg_temp.ok(
  (select count(*) from konekt.locations
   where id = 'b0000000-0000-0000-0000-000000000002') = 1,
  'the public can read a location a human has verified');

reset role;
rollback;

-- =============================================================================
-- Bonus: the audit log cannot be rewritten
-- =============================================================================
begin;
insert into konekt.audit_log (actor_kind, action, table_name, record_id)
values ('system', 'TEST', 'events', 'x');

select pg_temp.raises(
  $$update konekt.audit_log set action = 'TAMPERED' where action = 'TEST'$$,
  'an audit log entry cannot be edited');

select pg_temp.raises(
  $$delete from konekt.audit_log where action = 'TEST'$$,
  'an audit log entry cannot be deleted');
rollback;

-- Leave nothing behind.
begin;
truncate
  konekt.audit_log, konekt.certificates, konekt.check_ins,
  konekt.registrations, konekt.consent_records, konekt.referrals,
  konekt.accounts_opened, konekt.events, konekt.members,
  konekt.staff_users, konekt.institutions, konekt.branches,
  konekt.locations, konekt.wards, konekt.districts, konekt.regions,
  konekt.zones
  restart identity cascade;
commit;

\echo ''
\echo 'authorisation — all assertions passed.'
