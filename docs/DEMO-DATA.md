# Demonstration data

Seeded 25 August 2026 for the walkthrough. **None of it is real.** The
institution names are real Tanzanian institutions; every figure attached to
them was generated.

Each seeded row carries this marker in its `notes` column:

```
DEMO — sample data for the August 2026 walkthrough. Safe to delete.
```

## What was seeded

| What | Count |
|---|---|
| Stations | 12, across all five categories |
| Monthly reports | 72 — six months each |
| Account-type splits | 48, on the newest month |
| Loan-type splits | 36, on the newest month |
| Events | 7 — four past, three upcoming |

Spread across three branches so the roll-up is visible: Dodoma (Central),
Mwanza and Geita (Lake), Arusha (Northern).

## Removing it — from the console

HQ → **Settings** → **Sample data is loaded** → type `CLEAR`. That removes
every seeded figure and leaves the 69 stations loaded from the CRDB register
in place with nothing filed against them, which is the honest starting point
for going live. The panel disappears once there is nothing left to clear.

## Removing it — by hand

Deleting the stations is enough. `station_reports` cascades from `stations`,
and the account and loan splits cascade from `station_reports`, so one
statement clears the lot:

```sql
delete from konekt.tracked_events
where notes like 'DEMO —%';

delete from konekt.stations
where notes like 'DEMO —%';
```

Run the events delete first: an event may reference a station, and the
reference is `on delete set null` rather than cascade, so deleting stations
first would leave the demo events behind with their station link blanked.

Nothing else was touched. In particular the fifteen branches that were given a
`zone_code` are **not** demo data — those are real assignments, made where the
branch name is exactly a region name, and they should be kept. The remaining
237 branches are still unzoned and need someone at CRDB to assign them in
Settings → Branches and their zones.

## Verifying it is gone

```sql
select count(*) from konekt.stations where notes like 'DEMO —%';
select count(*) from konekt.tracked_events where notes like 'DEMO —%';
```

Both should return 0, and the console's overview should go back to showing
em-dashes rather than figures.
