# Database — CRDB Konekt

PostgreSQL with PostGIS, deployed on Supabase. Seven migrations in
`supabase/migrations/`, all verified against a real PostGIS 16 instance rather
than only read.

Everything lives in the `konekt` schema. Nothing lives in `public`.

---

## Setting it up

### Against Supabase

1. Create a project. In **Database → Extensions**, enable `postgis`.
2. Run the migrations in filename order (`supabase db push`, or paste them into
   the SQL editor one at a time).
3. Seed the register:

```bash
DATABASE_URL="postgres://postgres:...@db.<ref>.supabase.co:5432/postgres" \
  npm run db:seed
```

4. Point the app at the project:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server only, never a bundle
```

Without those three the app still runs. Every data path checks
`isConfigured` and falls back to the committed register with honest empty
states, so a preview deploy or a fresh clone renders rather than 500s.

### Locally

```bash
createdb konekt
psql -d konekt -c 'create extension postgis'
for f in supabase/migrations/*.sql; do psql -d konekt -v ON_ERROR_STOP=1 -f "$f"; done
DATABASE_URL=postgres://localhost/konekt npm run db:seed
DATABASE_URL=postgres://localhost/konekt npm run db:test
```

---

## What the seed produces

```
zones                        8
branches                   252
universities and colleges   54
JKT barracks                21
nested under a mother       20
supporting-branch links     34
locations queued to geocode 75
locations with a coordinate  0   <- correct: the register has none
```

The seed is idempotent — running it twice produces the same 75 locations, not
150 — and it never touches a location a human has already verified.

It also reports the gaps it finds rather than smoothing them over. Currently:

- **Five branch names on institution records match no branch in the register**:
  `BUTIAMA`, `CHANG'OMBE`, `CRDB KURASINI`, `CRDB UPANGA`, `KIBITI`. Three
  institutions are therefore left with no coordinating branch.
- **`STEPHANO MOSHI MEMORIAL UNIVERSITY COLLEGE, MWIKA CENTRE`** nests two
  levels deep (under SMMUCo, which is itself under TUMA). The register also
  spells the parent `STEFANO` and the child `STEPHANO`.

Both are in [OPEN-ITEMS.md](./OPEN-ITEMS.md) for CRDB to resolve.

---

## Rules the schema enforces, rather than the application

These are the platform's standing rules. Each one is a constraint, a policy or
a trigger — not a code review comment — and each is exercised by
`supabase/tests/authorisation.sql`.

| Rule | How |
|---|---|
| Capacity cannot be exceeded, even concurrently | `registrations_never_exceed_capacity` check plus a `FOR UPDATE` row lock in the counter trigger |
| One ticket per verified phone per event | Members are unique by phone; `unique (event_id, member_id)` |
| A certificate only for someone who checked in | `certificates.check_in_id` is a NOT NULL foreign key to `check_ins` |
| A duplicate scan cannot overwrite an arrival time | `unique (registration_id)` on `check_ins`; first `scanned_at` wins |
| No role can override the suppression list | `konekt.may_contact()` evaluates suppression first and takes no override parameter |
| Marketing consent is never bundled into terms | `marketing_is_never_bundled_with_terms` check constraint |
| Consent records reproduce what was shown | Append-only; UPDATE and DELETE blocked by trigger; the exact wording and locale are stored per record |
| A member cannot promote themselves | `protect_member_columns` trigger rejects self-edits to tier, suppression, KYC and referral code |
| Source attribution is never optional | `source` and `source_reference` are NOT NULL; event- and referral-sourced accounts must name the event or referrer |
| An account number cannot be recorded twice | `unique` on `accounts_opened.account_number` |
| Never place an unverified pin on the map | RLS on `locations` restricts anon and authenticated reads to `geocode_status = 'verified'` |
| A branch user cannot read another zone | `konekt.staff_can_reach()` composed into every scoped policy |
| Nothing publishes unverified | `published_opportunity_is_verified` check |
| Sponsorship cannot skip due diligence | `approval_requires_due_diligence` check |
| Maker-checker on campaign send | `maker_is_not_checker` and `sending_requires_approval` checks |
| A blog post cannot publish in one language | `published_post_is_bilingual` check |
| A partner logo cannot go live uncleared | `active_placement_is_cleared` check |
| Konekt never stores identity documents | There is no column for one. `members.kyc_verified` is a boolean sourced from core banking |
| Tier is never computed here | `tier_source` is constrained to `core_banking`, `migration` or `manual_override` |
| Every staff write is audited | `write_audit` trigger on every staff-writable table, into an append-only log |

---

## The authorisation test suite

```bash
DATABASE_URL=postgres://localhost/konekt npm run db:test
```

32 assertions. It impersonates real roles the way PostgREST does — setting
`request.jwt.claim.sub` and `set local role authenticated` — so the policies
are exercised exactly as they will be in production, not approximated.

It is re-runnable: it truncates its own fixtures at both ends.

Two of the assertions were written expecting a pass and found bugs instead:

- The first version asserted that a member could not clear their own
  suppression, but tested it on a member who was not suppressed — setting
  `false` to `false` is a no-op and proved nothing. Rewritten to use a
  genuinely suppressed member.
- The location fixture set `geocode_status = 'verified'` and added the verifier
  in a second statement, which the `verified_location_has_verifier` constraint
  correctly refused. The constraint was right; the test was wrong.

---

## Schema corrections the real data forced

All four from the build prompt's §3.2, plus a fifth the data made obvious.

1. **A branch relationship is coordinating plus supporting, not "nearest".**
   `institutions.coordinating_branch_id` (one) and
   `institution_supporting_branches` (many).
2. **Institutions nest.** `parent_institution_id` and `affiliation_type`,
   parsed from the TCU `AFFILIATION` column. Twenty of the 54 are children, not
   the nine the brief expected — and one nests two levels deep, which is why
   `institution_rollup` is recursive.
3. **Institutions carry status.** `ownership` and `accreditation_status` are
   real enums, including `provisional_licence`.
4. **Zones are a fixed set of eight.** A `zone_code` enum plus a table for
   display order. A ninth zone requires a migration, because it is an
   organisational change rather than a data entry.
5. **Nothing has coordinates.** Geocoding is a first-class workflow with a
   human verification gate, not a script that runs once.
