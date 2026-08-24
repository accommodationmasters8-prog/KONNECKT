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

### 1.2 One typo in the register

`MUST –RUKWA CAMPUS COLLEGE (MUST-RC)` carries the affiliation
`CAMPUS COLLGE UNDER MUST` — "COLLGE". The parser matches both spellings rather
than editing the supplied file, so the source stays byte-identical to what CRDB
sent. Worth correcting at source before Phase 2 seeds the database.

### 1.3 `SUMBAWANGA` appears as a region

The `regions_seen` list includes `SUMBAWANGA`, which is a district and town in
**Rukwa** region. `MUST –RUKWA CAMPUS COLLEGE` has `head_office: RUKWA` but
`region: SUMBAWANGA`. One of the two is wrong.

**Needs from CRDB:** which is the region of record. This has to be settled
before geocoding, because ward/district/region strings are the only input the
geocoder has.

### 1.4 Branch records carry no geography at all

252 branches, and not one has a region, zone, district or coordinate. The
`NEAR BRANCH` / `coordinating_branch` values on the institution list are the
only cross-reference available, and they cover roughly 40 branches.

**Consequence:** the landing page reports branches as a national total only.
Breaking 252 branches down by zone would require inventing the zone.

### 1.5 No record anywhere has coordinates

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

### 2.2 Production hostname

`NEXT_PUBLIC_SITE_URL` is unset, so canonical URLs, hreflang alternates and the
sitemap currently fall back to an obviously-fake placeholder
(`https://konekt.example.crdb.co.tz`). **Set this environment variable before
the first deploy** or the site will publish wrong canonical URLs.

**Decision needed:** own domain, or a path under `crdbbank.co.tz`?

### 2.3 Swahili copy sign-off owner

Every Swahili string is real copy, written rather than machine-translated, but
none of it is client-approved. Terminology in particular needs a named owner —
for example whether membership tiers stay as "Silver / Gold / Platinum" in the
Swahili build or take Swahili names.

**Decision needed:** who signs off Swahili wording, and by when.

### 2.4 CRDB brand guidelines beyond the logo

The palette and the chevron geometry are extracted from the logo artwork. If
CRDB has a fuller brand book — a licensed type stack, tone-of-voice rules,
photography direction, co-branding rules with the parent CRDB identity — this
build has not seen it.

### 2.5 Legal copy

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

### 3.2 The map teaser is a schematic, not a drawn coastline

The brief asks for "a static, stylised map of Tanzania showing the 8 zones".
This ships as a schematic: eight tiles in roughly their national arrangement,
carrying the real campus counts, with fill weight driven by the data.

An approximated outline of Tanzania would be a drawing nobody has verified,
presented next to a rule that says never show an unverified location. The
numbers are the pitch and every one of them is traceable to the register.

**If CRDB supplies an approved outline or shapefile, this becomes a real map
immediately** — the component already computes everything it would need.

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
