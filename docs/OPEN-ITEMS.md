# Open items — CRDB Konekt

Decisions this build is waiting on, and the assumptions shipped in their place.
Nothing here is blocking Phase 1; several items block Phase 2 or Phase 3 and are
marked as such.

---

## 1. Discrepancies found in the supplied data

These came out of the register itself, not from the brief. `npm run check:stats`
re-checks all of them on every build.

### 1.1 Twenty institutions are children, not nine — needs confirmation

The build prompt states that nine of the 54 TCU institutions are campuses or
centres under a mother university. The register carries **twenty**, under eight
mother institutions: MU, MUST, MoCU, SAUT, SJUIT, SMMUCo, SUA, TUMA, UDSM.

This matters because campus roll-up is the difference between counting 54
institutions and counting 34. Any national or zone report built on the brief's
figure will over-count campuses by eleven.

**Shipped assumption:** the register is authoritative. `institution.isChild` is
derived by parsing the `AFFILIATION` column rather than hardcoding a count, so
if CRDB corrects the register the number follows automatically.

**Needs from CRDB:** confirmation that all twenty are genuine children and
should roll up to their mother institution in reporting.

### 1.2 Five branch names on institution records match no branch

The institution and JKT lists reference these coordinating or supporting
branches, and none of them appears in the 252-branch register:

| Name as written | Referenced by |
|---|---|
| `CRDB UPANGA` | Mzumbe University – Dar es Salaam Campus College |
| `CRDB KURASINI` | St. Joseph University College of Health and Allied Sciences |
| `KIBITI` | KIBITI barracks (830KJ) — coordinating **and** supporting |
| `BUTIAMA` | MUHEMBA barracks (822KJ) — supporting |
| `CHANG'OMBE` | MGULANI barracks (831KJ) — supporting |

Three institutions therefore have no coordinating branch resolved. The seed
reports them on every run rather than silently linking them to something
approximate.

**Needs from CRDB:** either the canonical branch names, or confirmation that
these are branches the register is missing.

### 1.3 One institution nests two levels deep

`STEPHANO MOSHI MEMORIAL UNIVERSITY COLLEGE, MWIKA CENTRE` is a university
centre under `SMMUCo`, which is itself a university college under `TUMA`. The
register also spells the parent `STEFANO` and the child `STEPHANO`.

The seed resolves children in dependency order and `institution_rollup` is
recursive, so this rolls up correctly. It is worth confirming the spelling is a
typo rather than two different institutions.

### 1.4 One typo in the register

`MUST –RUKWA CAMPUS COLLEGE (MUST-RC)` carries the affiliation
`CAMPUS COLLGE UNDER MUST` — "COLLGE". The parser matches both spellings rather
than editing the supplied file, so the source stays byte-identical to what CRDB
sent. Worth correcting at source before Phase 2 seeds the database.

### 1.5 `SUMBAWANGA` appears as a region

The `regions_seen` list includes `SUMBAWANGA`, which is a district and town in
**Rukwa** region. `MUST –RUKWA CAMPUS COLLEGE` has `head_office: RUKWA` but
`region: SUMBAWANGA`. One of the two is wrong.

**Needs from CRDB:** which is the region of record. This has to be settled
before geocoding, because ward/district/region strings are the only input the
geocoder has.

### 1.6 Branch records carry no geography at all

252 branches, and not one has a region, zone, district or coordinate. The
`NEAR BRANCH` / `coordinating_branch` values on the institution list are the
only cross-reference available, and they cover roughly 40 branches.

**Consequence:** the landing page reports branches as a national total only.
Breaking 252 branches down by zone would require inventing the zone.

### 1.7 No record anywhere has coordinates

Confirmed by the check script: zero of 327 records (252 branches, 54
institutions, 21 barracks) carry a latitude or longitude.

**Consequence for Phase 2:** geocoding is a budgeted task with a human
verification queue, not a script that runs once. No pin goes on the map until a
branch officer has confirmed it.

---

## 2. Before Phase 1 ships to production

### 2.1 Gotham web licence — buy, or ship Archivo?

The logo is set in Gotham. Gotham requires a paid web font licence
(Hoefler&Co / Monotype). **This build ships Archivo**, which is metrically
similar, geometric, and free.

Swapping in licensed Gotham is a one-line change to `--font-display` in
`src/styles/tokens.css`. Nothing else in the codebase names a font.

**Decision needed:** budget for the licence, or sign off on Archivo.

### 2.2 The CRDB logo

**The build does not have CRDB's logo artwork**, and does not draw an
approximation of it. A bank's mark is a registered trademark; shipping a
lookalike is not a placeholder, it is a misuse of their identity.

The hero and the top bar render a typographic wordmark labelled
`LOGO PENDING`, deliberately visible so it cannot ship unnoticed. To swap in
the real thing:

1. drop the official SVG at `public/brand/crdb-logo.svg`
2. set `NEXT_PUBLIC_CRDB_LOGO=1`

Nothing else changes.

The same applies to the partner strip: Bolt, Air Tanzania and the rest render
as typographic plates, not as their logos, and the strip is labelled indicative
pending Marketing and Legal sign-off — which is what the membership framework
says they are.

### 2.3 Production hostname

`NEXT_PUBLIC_SITE_URL` is unset, so canonical URLs, hreflang alternates and the
sitemap currently fall back to an obviously-fake placeholder
(`https://konekt.example.crdb.co.tz`). **Set this environment variable before
the first deploy** or the site will publish wrong canonical URLs.

**Decision needed:** own domain, or a path under `crdbbank.co.tz`?

### 2.4 Swahili copy sign-off owner

Every Swahili string is real copy, written rather than machine-translated, but
none of it is client-approved. Terminology in particular needs a named owner —
for example whether membership tiers stay as "Silver / Gold / Platinum" in the
Swahili build or take Swahili names.

**Decision needed:** who signs off Swahili wording, and by when.

### 2.5 CRDB brand guidelines beyond the logo

The palette and the chevron geometry are extracted from the logo artwork. If
CRDB has a fuller brand book — a licensed type stack, tone-of-voice rules,
photography direction, co-branding rules with the parent CRDB identity — this
build has not seen it.

### 2.6 Legal copy

Privacy, terms and accessibility routes exist and resolve in both locales, but
carry placeholder text saying the real wording is with Legal. Registration
cannot open until privacy and terms are approved in **both** languages.

---

## 3. Design decisions taken, for review

### 3.1 No hero video

The brief allows a hero video behind a strict gate (§2.2): poster paints first,
loaded only on 4g without `saveData`, ≤1.2MB, ≤8s, separate vertical crop.

No encode exists that clears that gate, so **no video ships**. The mark
assembly is the motion and it is about 1KB of inline SVG. When a clip exists it
drops in behind the current composition, which already works as its own poster
state — no layout change required.

### 3.2 The map is real geography, from Natural Earth

Superseded. The first build shipped a schematic, because approximating a
coastline by hand would have been a drawing nobody verified.

It now draws **all 30 Tanzanian regions from Natural Earth 1:10m administrative
boundaries** (public domain), grouped into CRDB's eight zones, projected and
simplified at build time by `scripts/geo/build-tanzania-map.mjs`. About 8KB
gzipped of path data, no map library, no tile server, and it renders with the
radio off.

Two things about it need CRDB's attention:

- **Thirteen of the thirty region-to-zone assignments are geographic, not from
  the register.** The register names a zone for 17 regions; the rest are
  assigned by where they are. Each is flagged `confirmedByRegister: false` in
  the generated file. **Please confirm the thirteen.**
- **Songwe region is missing.** It was created in 2016 and is absent from this
  edition of Natural Earth, so it is not drawn. Its institutions still appear
  in every count. A newer boundary source fixes it.

There are still no pins on it, and the map page says why. That rule has not
changed.

### 3.2b A background video for the map — asked for, and worth deciding

**A looping video of Tanzania behind the map would cost more than it returns.**

The §2.2 gate exists for a reason: 1.2MB on a 3G connection in Mwanza is real
money out of someone's bundle, spent on decoration. The map's own boundaries
already do that job at 8KB. A video also sits *behind* a shape it cannot align
with, because the map is a projection and the footage is not — so the two would
drift against each other at every viewport width.

Three options if movement is wanted:

1. **Animate the map itself.** Regions wipe in on the chevron angle, zone by
   zone, in CSS. Costs nothing, uses geometry that is already exact, works on
   every device. **This is the recommendation.**
2. **A short silent clip on the landing hero only**, behind the full §2.2 gate:
   poster paints first, loads only on 4g with `saveData` false, 8 seconds,
   ≤1.2MB, separate vertical crop, reduced motion respected. Needs an actual
   encode, which does not exist yet.
3. **Both** — animate the map, and gate a hero clip once there is footage.

CRDB would need to supply or commission footage for (2). Nothing in the current
build blocks adding it later.


### 3.3 Fonts ship the `latin` subset only

The brief expects `latin-ext` "which Swahili needs". Standard Kiswahili
orthography uses the plain 26-letter Latin alphabet with no diacritics, and a
scan of every string in both dictionaries and the entire CRDB register finds no
character in the Latin Extended ranges.

Shipping `latin-ext` cost **111KB** — a third of the initial payload. It is
dropped, and `npm run check:tokens` fails the build if any copy ever needs
those glyphs.

### 3.4 Green and teal cannot carry text on the paper canvas

Measured against `--konekt-paper`:

| Colour | On paper | On ink |
|---|---|---|
| `--konekt-teal` `#37A694` | **2.87:1 — fails** | 5.72:1 |
| `--konekt-green` `#44AC34` | **2.81:1 — fails** | 5.84:1 |
| `--konekt-yellow` `#F6B30B` | **1.78:1 — fails** | 9.23:1 |
| `--konekt-pink` `#EC4363` | 3.65:1 — large text only | 4.51:1 |

Three darkened or lightened variants were added and are the only ones permitted
to carry text on the surfaces named:

- `--konekt-teal-deep` `#226E62` — 5.83:1 on paper
- `--konekt-green-deep` `#2E7524` — 5.49:1 on paper
- `--konekt-teal-light` `#73C1B4` — 4.75:1 on the lightest map tile

The focus ring is two-tone for the same reason: yellow alone is 1.78:1 on
paper, so it is backed by an ink hairline that carries the 3:1.

---

## 4. Before Phase 2

- **Data residency.** Must Tanzanian personal data stay in Tanzania? This
  decides the hosting region and possibly the provider.
- **Geocoding budget and provider**, and who verifies pins. 327 records, and
  ward-level accuracy in rural Tanzania is not something any commercial
  geocoder does well unaided.
- **Map tile provider and licence.** MapLibre is the renderer; tiles are a
  separate commercial decision.
- **The 180KB JavaScript budget is already spent.** See
  [PERFORMANCE.md](./PERFORMANCE.md) — this needs a decision before the map is
  built, not after.

## 5. Before Phase 3

- Core banking integration: read-only reconciliation feed, or manual upload?
- How `tier` and `kyc_verified` reach Konekt. **Konekt must never store NIDA
  numbers or identity documents** — it consumes a verified boolean.
- Agent commission model.
- SMS aggregator and registered sender ID.
- Consent wording approved by CRDB Legal in both languages.
- Under-18 messaging policy. The membership tiers are 18–35, but Junior Jumbo,
  Teen and Scholar accounts serve minors, and events and account opening still
  reach them. All under-18 consent controls stand.
- Certificate wording approved by Legal.
