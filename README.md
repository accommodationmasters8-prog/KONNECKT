# CRDB Konekt

The public platform for **CRDB Konekt**, the youth banking community of CRDB
Bank Plc, Tanzania.

A bilingual progressive web app, a PostGIS database on Supabase, a member area
and a staff back office.

**Runs with or without a database.** Every data path checks whether Supabase is
configured; with no project attached the app serves the committed CRDB register
and honest empty states rather than crashing or inventing content. See
[docs/DATABASE.md](docs/DATABASE.md) to attach one.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 → rewrites to /en
```

```bash
npm run verify       # every acceptance gate, then a production build
npm run build && npm start
```

Set `NEXT_PUBLIC_SITE_URL` before deploying, or canonical URLs, hreflang and
the sitemap fall back to an obviously-fake placeholder. See
[docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md) §2.2.

---

## What is here

```
data/konekt-seed-data.json   The CRDB register, byte-identical to what was supplied
supabase/migrations/         Seven migrations, verified against real PostGIS
supabase/tests/              32 authorisation assertions
scripts/db/seed.mjs          Idempotent register seed
scripts/geo/                 Builds the Tanzania map from Natural Earth
src/styles/tokens.css        Every colour, type size, duration and angle. One source.
src/i18n/                    English and Kiswahili copy, written as peers
src/lib/supabase/            Browser, server and service-role clients
src/lib/tanzania-map.ts      GENERATED — 30 real region boundaries as SVG paths
src/components/shell/        The app shell: top bar, bottom tab bar
src/components/staff/        The staff console frame and panels
scripts/                     Acceptance gates (see below)
scripts/dev/                 Measurement tools, not part of the build
docs/                        Database, open items, performance
```

### Routes

Every page is a real full page, statically prerendered, in both languages.

| Route | |
|---|---|
| `/` | rewrites to `/en` — no redirect hop, which costs a round trip on 3G |
| `/{locale}` | the landing page: a highlight reel that routes into the rest |
| `/{locale}/events` | the full calendar |
| `/{locale}/map` | the zone map, the figures, and why there are no pins yet |
| `/{locale}/membership` | tiers and the partner network |
| `/{locale}/opportunities` | the board, with its eligibility model |
| `/{locale}/blog` | stories |
| `/{locale}/me` | the member area — tier, tickets, referrals, consent |
| `/{locale}/staff` | the back office: overview, check-in, accounts, pin verification |
| `/{locale}/privacy`, `/terms`, `/accessibility` | real routes, placeholder text pending Legal |
| `/sitemap.xml`, `/robots.txt` | generated, both locales cross-referenced |

The member area and staff console are `noindex`. Lighthouse marks them down for
it; that is the correct trade.

---

## It is an app, not a website with a menu

On a phone the chrome is real application chrome — a compact frosted top bar
and a fixed bottom tab bar, with content scrolling between them. Above tablet
width the tab bar gives way to a horizontal nav, because a thumb-reach tab bar
on a laptop is a phone pattern being cargo-culted.

Both navs are plain links. No client component, no hydration, no bytes, and
they work with JavaScript disabled.

The tab bar marks where you are with the brand's own triangle, at the brand's
own angle — the third sanctioned use of the mark.

Safe-area insets are honoured, so installed on a phone with a home indicator
the tab bar sits above the gesture area rather than under a thumb.

---

## The brand system

Extracted from the official Konekt logo artwork. All of it lives in
`src/styles/tokens.css`, and `npm run check:tokens` fails the build if a hex
value appears anywhere else.

**The chevron is the entire structural vocabulary**, used three ways and no
others:

1. **Section edges.** Sections meet on the mark's own 58° angle. The notch is
   sized in pixels on both axes so `depth ÷ (width ÷ 2)` stays at `tan(58°)` at
   every viewport — one angle, everywhere. The notched section is pulled up over
   its predecessor so the cut reveals the real section above rather than the
   page background.
2. **The reveal.** Content enters by wiping along that angle, driven by CSS
   `animation-timeline: view()`. Zero JavaScript, zero payload. Scoped to
   section headings — a skewed cover cannot reliably cover a 2000px section's
   corners, and a curtain dragged across a whole screen is not a reveal.
3. **Triangle markers.** Yellow and pink mark *where things are* — live, a
   place, an active state. They are event colours, never decoration, and never
   a generic button fill.

Both the mark component and the PWA icon generator carry the same path data,
and the generator asserts they have not drifted apart.

### The map

Real geography. All 30 Tanzanian regions from Natural Earth 1:10m
administrative boundaries, grouped into CRDB's eight zones, projected and
simplified at build time into about 8KB gzipped of SVG path data.

No map library, no tile server, no network request — MapLibre alone would be
~200KB gzipped, which does not fit the budget and does not work with the radio
off. Regenerate with `npm run map:build`.

There are no pins on it. Not one record in the CRDB register carries a
coordinate, so there is nothing truthful to plot; the map page says so rather
than leaving a gap.

### Colour and contrast

Brand teal, green and yellow all **fail** WCAG AA as text on the paper canvas.
Four variants exist for that, and the focus ring is two-tone so it clears
non-text contrast on both canvases. The measurements are in
[docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md) §3.4.

The frosted app bars sit at 92% ink rather than 86% for the same reason: a
fixed bar can end up over any section, so its worst case is ink composited over
the paper canvas, where 86% drops brand teal to 3.77:1.

### Type

Display is **Gotham**, the logo face — which needs a paid web licence CRDB has
not bought. **This build ships Archivo.** Swapping in licensed Gotham is one
line: `--font-display` in `tokens.css`. Nothing else names a font.

---

## Language

English and Kiswahili are peers, not a base language and a translation layer.
Both are written copy. Both have real URLs. `<html lang>` carries the actual
language of the document, which is why the root layout lives inside the locale
segment. The switch is a plain anchor — no client component, no hydration, no
bytes, and it works with JavaScript off.

Counted nouns carry both plural forms in both languages
(`campus`/`campuses`, `chuo`/`vyuo`, `mkoa`/`mikoa`). Rendering "1 regions" is
a translation nobody read.

Swahili wording is real but **not yet client-approved** — the sign-off owner is
still open.

---

## Honesty rules this build already follows

Phase 1 has no database, but the standing rules from the brief apply from the
first line:

- **The sample events are marked as samples**, in both languages, on every card
  and in a notice the section is described by. Nothing is registrable and
  nothing pretends to be.
- **The opportunities board is empty and says so.** No invented listings.
- **The map is a schematic, not a drawn coastline.** Not one record in the
  supplied register has coordinates, so there is nothing to plot. An
  approximated outline would be a drawing nobody verified, shown next to a rule
  that says never display an unverified location.
- **Branch and barracks counts are national totals**, because the register gives
  them no zone. Splitting 252 branches across eight zones would mean inventing
  the zone.
- **Partner benefits are marked indicative, pending Marketing and Legal.**
- **The install prompt waits for the value moment** — it never fires on first
  load, and a dismissal is remembered.

Where the supplied data and the brief disagree, the register wins and the
disagreement is documented rather than smoothed over. See
[docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md) §1 — the largest is that twenty
institutions are campuses of another, not the nine the brief expected.

---

## Acceptance gates

```bash
npm run check:tokens      # no hex outside tokens.css; no copy needing latin-ext
npm run check:stats       # every published figure matches the register
npm run check:contrast    # every text run clears AA — 17 pages, two viewports
npm run budget            # initial JS and payload against the Part 0.1 limits
npm run verify            # all of the above + typecheck + build
npm run db:test           # 32 authorisation assertions (needs DATABASE_URL)
```

`check:contrast` walks every text node and computes the real ratio against its
composited background. It has now caught four things a sampled audit missed:
brand teal failing on the busiest zone's map tile, the frosted bar's worst-case
composite, an 80% opacity that dropped 11px text to 3.55:1, and gradient-clipped
text whose declared colour is `transparent`.

`check:contrast` and the measurement scripts need Chromium. They read
`CHROME_PATH`, defaulting to `/opt/pw-browsers/chromium`.

Measured results, and the one criterion that is not cleanly met, are in
[docs/PERFORMANCE.md](docs/PERFORMANCE.md).

**Read §3 of that file before starting Phase 2.** The 180 KB JavaScript budget
is already consumed by the framework — 172.5 KB of the 173.2 KB total is
Next.js and React, and application code is 0.7 KB. MapLibre does not fit in
what is left.

---

## Things that are deliberately missing

- **CRDB's logo.** Not supplied, and not approximated — see
  [docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md) §2.2.
- **Partner logos.** Same reason. The strip renders typographic plates and is
  labelled indicative, pending Marketing and Legal.
- **Pins on the map.** No record has a coordinate.
- **A hero video.** No encode clears the §2.2 gate. §3.2b of the open items has
  the recommendation on the map background video that was asked about.
- **Content in the blog and opportunities board.** Nothing publishes unverified,
  so both are empty and say so.

---

*Built by Bermi Techs Limited, Dar es Salaam.*
