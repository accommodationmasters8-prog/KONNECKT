# Demonstration data

**None of the figures in this database are real.** The institutions are real
— they come from CRDB's own registers — but every account, deposit, visit and
event attached to them was generated to give the console something to show.

Last regenerated 3 September 2026.

## What is real, and what is not

| | Real | Generated |
|---|---|---|
| Institutions | 21,685 from the registers | 638 informal-sector ones (below) |
| Branches | 252, from the branch register | their zone assignment (below) |
| Reports | — | 52,182, across 8,378 institutions |
| Filed against added figures | — | 13,740 |
| Visits | — | 3,528, one run per branch |
| Events | — | 772, two to four per branch |

The generated institutions are the ones no national register lists: boda
stands, barbershops, salons, health centres and creator hubs. A branch visits
them, so the categories exist in the tracker and had nothing in them; there
is one to five per branch and they are marked like everything else here.

Reports run monthly from April to September 2026, plus twelve weeks of weekly
filing for the boda stands and barbershops — the two categories whose
`reporting_kind` is `weekly`, which is what makes the reports screen's
"filed as" filter show anything.

## What each category tracks

The ten built-in figures are columns on `station_reports` and every category
starts out tracking all ten. Seven more were added to show what the feature is
for — a figure that belongs to one kind of place and not another:

| Category | Also tracks |
|---|---|
| Universities | Graduating this year, Campus staff |
| Bodaboda | Riders in the stand, Daily float |
| Hospitals | Health workers |
| Content creators | Followers reached |
| Mawinga, Vinyozi | Chairs |

Two categories were also narrowed, so the screens genuinely differ rather than
every category quietly tracking everything: the salons and barbershops do not
track cards issued or loan value, and the creators do not track loans or
dormancy. All of it is editable at HQ → Categories → the category → **What
this category tracks**, and the figures filed against a metric survive it
being switched off.

## The markers

Each generated row says so in its own text column:

| Table | Column | Marker |
|---|---|---|
| `station_reports` | `note` | `Sample figure` |
| `engagements` | `notes` | `DEMO engagement` |
| `tracked_events` | `notes` | `DEMO event` |
| `stations` | `notes` | `DEMO informal-sector institution` |

## Removing it — from the console

HQ → **Settings** → **Sample data is loaded** → type `CLEAR`. That removes
every generated figure and leaves the institutions from the registers in
place with nothing filed against them, which is the honest starting point for
going live. The panel disappears once there is nothing left to clear.

## Removing it — by hand

```sql
delete from konekt.tracked_events where notes like 'DEMO %';
delete from konekt.station_reports where note like 'Sample figure%';
delete from konekt.engagements   where notes like 'DEMO%';
delete from konekt.stations      where notes like 'DEMO %';
```

Values filed against the added figures go with the reports they belong to —
`station_report_values` cascades from `station_reports`. The *definitions* do
not: `metrics` and `category_metrics` are the bank's configuration, not sample
data, and clearing figures should not throw away the decision about what to
measure.

Events first: an event's station reference is `on delete set null` rather
than a cascade, so clearing stations first would leave the demo events behind
with their link blanked. Reports cascade from stations, but they are deleted
explicitly because most of them hang off *register* institutions that stay.

## What is NOT demonstration data, and must be kept

**Zone and branch on every institution.** Each of the 21,685 institutions now
carries a `zone_code` derived from the region the register puts it in, and a
`branch_id`. 13,245 of those branch assignments are a real match — the
institution's district is the branch's own name. The rest were spread evenly
across the branches of the same zone so that the zone and branch scoreboards
have something to rank; they are a placeholder for the real
institution-to-branch mapping, not an invention that needs deleting.

**Zone on every branch.** All 252 branches were zoned by name against the
eight zones in `konekt.zones`. This was done from the branch names and is
**provisional** — six or so of them (Majengo, Mbuyuni, Mapato, Soko Kuu, Kwa
Mromboo, Mandela) are place names that occur in more than one region and were
placed on the balance of probability. Somebody at CRDB should check the list
against the official zoning; Settings → Branches is where to correct it.

Neither survives a `CLEAR`, because neither is removed by it: clearing sample
data takes figures away, not the shape of the network.

## Verifying it is gone

```sql
select count(*) from konekt.station_reports where note like 'Sample figure%';
select count(*) from konekt.engagements    where notes like 'DEMO%';
select count(*) from konekt.tracked_events where notes like 'DEMO %';
select count(*) from konekt.stations       where notes like 'DEMO %';
```

All four should return 0, and the console's overview should go back to
showing em-dashes rather than figures.
