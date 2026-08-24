# CRDB Konekt

The public platform for **CRDB Konekt**, the youth banking community of CRDB
Bank Plc, Tanzania.

**This repository is at Phase 1: foundation and landing page.** Public only —
no auth, no database, no writes. Phases 2 and 3 build the product surface and
the back office on top of it.

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
src/styles/tokens.css        Every colour, type size, duration and angle. One source.
src/i18n/                    English and Kiswahili copy, written as peers
src/lib/seed.ts              Register parsing — build time only, never shipped to the client
src/components/              The landing page sections
scripts/                     Acceptance gates (see below)
scripts/dev/                 Measurement tools, not part of the build
docs/                        Open items and the performance report
```

### Routes

| Route | |
|---|---|
| `/` | rewrites to `/en` — no redirect hop, which costs a round trip on 3G |
| `/en`, `/sw` | the landing page |
| `/en/privacy`, `/terms`, `/accessibility` | and the `sw` equivalents — real routes, placeholder text pending Legal |
| `/sitemap.xml`, `/robots.txt` | generated, both locales cross-referenced |

Every page is statically prerendered.

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

### Colour and contrast

Brand teal, green and yellow all **fail** WCAG AA as text on the paper canvas.
Three variants exist for that, and the focus ring is two-tone so it clears
non-text contrast on both canvases. The measurements are in
[docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md) §3.4.

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
npm run check:contrast    # every text run clears AA, both locales, two viewports
npm run budget            # initial JS and payload against the Part 0.1 limits
npm run verify            # all of the above + typecheck + build
```

`check:contrast` and the measurement scripts need Chromium. They read
`CHROME_PATH`, defaulting to `/opt/pw-browsers/chromium`.

Measured results, and the one criterion that is not cleanly met, are in
[docs/PERFORMANCE.md](docs/PERFORMANCE.md).

**Read §3 of that file before starting Phase 2.** The 180 KB JavaScript budget
is already consumed by the framework — 172.5 KB of the 173.2 KB total is
Next.js and React, and application code is 0.7 KB. MapLibre does not fit in
what is left.

---

*Built by Bermi Techs Limited, Dar es Salaam.*
