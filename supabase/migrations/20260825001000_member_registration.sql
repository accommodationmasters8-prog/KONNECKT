-- =============================================================================
-- 0010 — MEMBER SELF-REGISTRATION
--
-- Until now a member row could only be created by staff or the service role:
-- konekt.members had no INSERT policy at all, so anyone signing themselves up
-- was refused by the database. That was correct while registration ran through
-- a field agent's tablet, and wrong the moment the site grew a sign-up form.
--
-- Two things are needed for someone to create their own record safely: a way
-- to get a referral code without inventing one, and a rule that says what a
-- person may assert about themselves at the moment they register. Neither
-- belongs in the sign-up form, because a form is not where anyone checks it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Referral codes
--
-- Generated in the database rather than by the application: the column is
-- UNIQUE and NOT NULL, so a caller that has to invent one either duplicates it
-- under concurrency or gets it wrong. Ambiguous characters are excluded — this
-- code is read aloud at events and typed by someone else.
-- -----------------------------------------------------------------------------
create or replace function konekt.new_referral_code()
returns text
language plpgsql
volatile
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_tries integer := 0;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from konekt.members where referral_code = v_code);

    v_tries := v_tries + 1;
    if v_tries > 20 then
      raise exception 'Could not allocate a unique referral code after 20 attempts';
    end if;
  end loop;

  return v_code;
end;
$$;

comment on function konekt.new_referral_code is
  'Eight characters, no O/0/I/1/L. The code is read aloud at events and typed '
  'by somebody else, so the ambiguous glyphs are not in the alphabet.';

alter table konekt.members
  alter column referral_code set default konekt.new_referral_code();

-- -----------------------------------------------------------------------------
-- What a person may assert about themselves at registration
--
-- The UPDATE guard in migration 0006 stops a member editing their tier, their
-- KYC flag or their suppression state. Nothing stopped them *arriving* with
-- those values set, which is the same hole one INSERT earlier. This resets them
-- rather than raising: a sign-up that fails because the form posted an extra
-- field teaches the person nothing, and the correct end state is the same.
-- -----------------------------------------------------------------------------
create or replace function konekt.protect_member_columns_on_insert()
returns trigger
language plpgsql
as $$
begin
  -- Staff and the service role create members through other paths; this guard
  -- is for a person registering themselves.
  if new.auth_user_id is distinct from auth.uid() then
    return new;
  end if;

  new.tier := null;
  new.tier_source := 'core_banking';
  new.tier_effective_at := null;
  new.tier_expires_at := null;
  new.in_grace_period := false;

  new.kyc_verified := false;
  new.kyc_verified_at := null;

  new.is_suppressed := false;
  new.suppressed_at := null;
  new.suppressed_reason := null;

  -- Verification is a fact about a check that happened, not a claim in a form.
  new.phone_verified_at := null;

  return new;
end;
$$;

create trigger members_protect_columns_on_insert
  before insert on konekt.members
  for each row execute function konekt.protect_member_columns_on_insert();

comment on function konekt.protect_member_columns_on_insert is
  'Tier comes from core banking, KYC is the bank''s claim, suppression protects '
  'the member from us, and a verified phone is the record of a verification. '
  'None of them can be asserted by the person registering.';

-- -----------------------------------------------------------------------------
-- The policy itself
-- -----------------------------------------------------------------------------
create policy members_self_insert on konekt.members
  for insert to authenticated
  with check (auth_user_id = auth.uid());

comment on policy members_self_insert on konekt.members is
  'A signed-in person may create exactly one record: their own, linked to '
  'their own auth user. The trigger above decides what it may contain.';
