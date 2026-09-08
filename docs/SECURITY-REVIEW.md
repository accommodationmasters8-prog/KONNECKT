# Security review

Carried out against the live project (`hapcnlkwqcvygzhzddpa`, Postgres 17,
`eu-west-1`) on 8 September 2026, before the CRDB presentation.

This is not a reading of the code. Every claim below with a result attached
was executed against the real database, impersonating the real roles the way
PostgREST does — `set local role authenticated` with the account's own
`request.jwt.claims`. Where something is reasoned rather than executed, it says
so.

---

## 1. The shape of the boundary

There is one authorisation boundary and it is in the database. The application
never decides who may see what; it asks under the caller's own rights and gets
back whatever the row policies allow. Three facts make that hold:

- Every one of the 55 tables in the `konekt` schema has row level security
  enabled and at least one policy. None is left open.
- Every scope decision resolves from `auth.uid()` — the subject of a JWT the
  database itself verified — and never from anything the client sent in a form
  or a query string.
- `konekt.my_staff_profile()` also requires `is_active`, so revoking an
  account takes effect on its next request rather than at its next sign-in.

Hiding a navigation link is not part of this. A hidden link is still a
reachable URL, and the pages behave correctly when one is typed in directly
because the data behind them is scoped, not the menu.

## 2. What was attempted, and what happened

Signed in as the branch officer (`branch@konekt.co.tz`, 86 stations in scope):

| # | Attack | Result |
| --- | --- | --- |
| 1 | Read the register | 86 stations — its own branch, not 21,685 |
| 2 | Read a station outside scope by its id | blocked, 0 rows |
| 3 | Rename a station outside scope | blocked, 0 rows matched |
| 4 | Create a station inside another branch | blocked, RLS violation |
| 5 | Promote itself to HQ | blocked, 0 rows matched |
| 6 | Clear its own `branch_id` to widen its scope | blocked, 0 rows matched |
| 7 | Mint itself a second, HQ-role account | blocked, RLS violation |
| 8 | List colleagues | its own row only |
| 9 | Read the audit log | blocked, 0 rows |
| 10 | Read the access grants | blocked, 0 rows |
| 11 | Hand one of its own visits to another branch | blocked, `WITH CHECK` violation |

Signed out entirely (the `anon` role, which is what a stranger with the
publishable key has):

| Attack | Result |
| --- | --- |
| Read `stations`, `staff_users`, `engagements`, `station_reports`, `branches`, `zones`, `audit_log`, `submissions`, `tracker_categories`, `metrics`, `events`, `access_grants` | blocked on all twelve — no table grant at all, before RLS is even consulted |
| File a contact-form submission already assigned to a zone | blocked, RLS violation |
| File one already marked answered | blocked, RLS violation |
| Read submissions back after filing one | blocked, no grant |

Number 11 is the one worth dwelling on. Reading and writing are separate
permissions, and a policy that only says `USING` lets a row be *moved* out of
scope even though it could not have been read there. The scoped tables carry
`WITH CHECK` as well, so a branch cannot launder a record into another
branch's figures.

`anon` holds exactly two privileges in the whole schema: `SELECT` on
`public_station_pins` (the map on the public site) and `INSERT` on
`submissions` (the contact form). The insert is fenced by a `WITH CHECK` that
pins `status` to `new` and requires every assignment and answer column to be
null, so the form cannot be used to inject a pre-triaged or pre-answered item
into the queue.

## 3. Privilege escalation

`staff_users` is the only table that decides anyone's rights, and it has no
policy that a non-HQ account can write through — `staff_hq_write` is gated on
`is_hq()` for all four verbs. So role, zone and branch cannot be edited by
their holder. Tests 5, 6 and 7 confirm it in all three directions: change the
role, widen the scope, or add a second account.

The one code path that bypasses row security is `redeemAccess()`, which turns
an access code into an account. It has to: there is no session yet, because
the whole point is that the person holding the code has no account. It is
correct, and specifically:

- `role`, `zone_code` and `branch_id` are taken from the **grant row**. The
  form's contents are never consulted for scope, so a redeemer cannot ask for
  HQ.
- Every failure returns one identical message. Telling "no such code" apart
  from "already used" would tell somebody guessing which guesses landed.
- The grant is claimed by a conditional update, not by read-then-write, so two
  simultaneous redemptions cannot both pass.
- Failure part-way through rolls back the auth user and the staff row.

Codes are 31^8 ≈ 850 billion, drawn from the platform CSPRNG with rejection
sampling rather than `byte % 31` — a modulo would have made A–H about 12% more
likely in every position, which is a smaller keyspace than it looks.

## 4. Two things that look like weaknesses and are not

**The middleware decodes the session cookie without verifying its signature.**
It does, deliberately, and only to decide whether the token has enough time
left that it need not be refreshed. It is not an authorisation check. A forged
cookie with a distant expiry would skip the refresh and then fail at the
database, because `auth.uid()` returns nothing for a token whose signature does
not verify — and every policy hangs off `auth.uid()`. The saving is a network
round trip in front of every navigation. *(Reasoned, not executed: the
signature check happens at Supabase's edge, which this environment cannot
reach.)*

**The console filters navigation by role.** That is a convenience, not a
control, and the code says so where it does it.

## 5. Findings

**Fixed in this pass.** A signed-out visitor to `/staff` was handed
`role: 'hq'`, so the rail advertised Access, Settings, Activity and Import by
name to anyone who opened the URL. No data was reachable — `anon` has no
grants at all — but it published the shape of the administration surface for
no reason. The signed-out default is now `branch`, the least any account has.

**Open, and needs the Supabase dashboard rather than this repository:**

1. **Leaked-password protection is off.** Supabase can check new passphrases
   against Have I Been Pwned. For a bank console with ten-character minimums
   this is worth the switch. Authentication → Policies.
2. **`public.spatial_ref_sys` grants `anon` INSERT, UPDATE, DELETE and
   TRUNCATE.** It is PostGIS's own table, owned by the extension, and its
   grants cannot be revoked from a migration without superuser. It holds
   coordinate-system definitions and nothing of the bank's, so the exposure is
   nuisance rather than disclosure — but it is a writable table reachable by a
   stranger and Supabase support can revoke it.
3. **No rate limit on code redemption.** The keyspace makes guessing
   infeasible (roughly one in 10^10 per attempt against a hundred live codes),
   so this is low severity, but the endpoint will answer as fast as it is
   asked.

**Credential hygiene, outside the code entirely.** The project's secret key and
the three demonstration passwords were typed into a chat transcript during
development. They should be rotated before this is in front of anyone, and the
demonstration accounts given real passphrases. No secret is committed — `.env*`
is ignored and `git ls-files` shows only `.env.example`.

## 6. What was not covered

Sign-in throttling, session fixation and password reset are Supabase Auth's,
not this application's, and were not exercised. No penetration testing was done
over the network: this environment's egress policy returns 403 for the Supabase
host, so everything above was executed through the database rather than
through the running site.
