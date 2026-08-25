-- Access, issued rather than signed up for.
--
-- Nobody at a branch or a zone registers themselves. HQ issues a code, hands
-- it over, and whoever holds it turns it into an account by choosing a
-- passphrase. From then on the code is their username: there is no work email
-- in this flow, because half the branches share one and a shared mailbox is
-- not an identity.
--
-- The code is stored as written. It is a bearer credential for exactly as long
-- as it takes to redeem — after that it is a username, and the passphrase is
-- the secret. Storing it lets HQ read a code back to somebody over the phone,
-- which is how these are actually delivered; the alternative is a hash nobody
-- can recover and a reissue every time a branch loses a slip of paper.
--
-- Revoking is the only ending. Rows are never deleted: an account that existed
-- and filed reports must stay explainable afterwards.

create table if not exists konekt.access_grants (
  id              uuid primary key default gen_random_uuid(),

  -- KNK-7QF4-M2XD. No I, O, 0 or 1 anywhere in it — these get read aloud.
  code            text not null unique
                  check (code ~ '^KNK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),

  -- What the grant is for, in the words HQ would use on the phone.
  label           text not null check (length(btrim(label)) between 2 and 120),
  holder_name     text not null check (length(btrim(holder_name)) between 2 and 120),
  holder_phone    text,
  note            text,

  -- The scope the redeemed account gets. Copied onto staff_users at
  -- redemption; changing it afterwards does not move an existing account,
  -- which is why the columns are locked once the grant is redeemed.
  role            konekt.staff_role not null,
  zone_code       konekt.zone_code,
  branch_id       uuid references konekt.branches (id) on delete restrict,

  expires_at      timestamptz,
  issued_by       uuid references konekt.staff_users (id) on delete set null,
  issued_at       timestamptz not null default now(),

  redeemed_at     timestamptz,
  staff_user_id   uuid unique references konekt.staff_users (id) on delete set null,

  revoked_at      timestamptz,
  revoked_by      uuid references konekt.staff_users (id) on delete set null,
  revoked_reason  text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- The scope has to match the level, or a "zone" grant with no zone would
  -- redeem into an account that can reach nothing and reads as broken.
  constraint access_grant_scope_matches_role check (
    case role
      when 'hq'     then zone_code is null and branch_id is null
      when 'zone'   then zone_code is not null and branch_id is null
      else               branch_id is not null
    end
  ),

  -- Redeemed means there is an account. One without the other is a half-state
  -- that every screen would then have to guess at.
  constraint access_grant_redemption_is_whole check (
    (redeemed_at is null) = (staff_user_id is null)
  )
);

comment on table konekt.access_grants is
  'Codes HQ issues so a zone or a branch can get into the tracker without an email account.';

create index if not exists access_grants_open_idx
  on konekt.access_grants (issued_at desc)
  where redeemed_at is null and revoked_at is null;

create index if not exists access_grants_branch_idx
  on konekt.access_grants (branch_id) where branch_id is not null;

drop trigger if exists access_grants_touch on konekt.access_grants;
create trigger access_grants_touch
  before update on konekt.access_grants
  for each row execute function konekt.touch_updated_at();

drop trigger if exists access_grants_audit on konekt.access_grants;
create trigger access_grants_audit
  after insert or update or delete on konekt.access_grants
  for each row execute function konekt.write_audit();

-- A redeemed grant's scope is settled. Editing it here would leave the
-- account it created pointing somewhere else, and the account is what row
-- level security actually reads.
create or replace function konekt.freeze_redeemed_grant()
returns trigger
language plpgsql
as $$
begin
  if old.redeemed_at is not null and (
       new.role is distinct from old.role
    or new.zone_code is distinct from old.zone_code
    or new.branch_id is distinct from old.branch_id
    or new.code is distinct from old.code
  ) then
    raise exception
      'This code has already been redeemed; revoke it and issue a new one instead.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists access_grants_freeze on konekt.access_grants;
create trigger access_grants_freeze
  before update on konekt.access_grants
  for each row execute function konekt.freeze_redeemed_grant();

alter table konekt.access_grants enable row level security;

-- HQ only, all four verbs. A zone manager holding a zone code has no business
-- reading the branch codes below them: a code is a credential, and the whole
-- point of issuing it is that exactly one person receives it.
drop policy if exists access_grants_hq_read on konekt.access_grants;
create policy access_grants_hq_read on konekt.access_grants
  for select to authenticated using (konekt.is_hq());

drop policy if exists access_grants_hq_write on konekt.access_grants;
create policy access_grants_hq_write on konekt.access_grants
  for insert to authenticated with check (konekt.is_hq());

drop policy if exists access_grants_hq_update on konekt.access_grants;
create policy access_grants_hq_update on konekt.access_grants
  for update to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

-- No delete policy, deliberately. Revoke sets revoked_at; the row stays.

grant select, insert, update on konekt.access_grants to authenticated;
