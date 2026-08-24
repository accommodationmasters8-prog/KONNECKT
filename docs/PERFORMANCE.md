# Performance — CRDB Konekt

> Your user is on a mid-range Android phone on 3G in Mwanza, not a MacBook on
> fibre. A beautiful page that takes nine seconds to paint has failed.

Every figure below is measured, not estimated. Reproduce with
`bash scripts/dev/measure.sh` (Lighthouse) and `npm run budget` (payload).

---

## Against the acceptance criteria

Measured on the full build: nine public routes, the member area and the staff
console, in both languages.

| Criterion | Target | Measured | |
|---|---|---|---|
| Lighthouse mobile — Performance | ≥ 90 | **96–99** | pass |
| Lighthouse mobile — Accessibility | 100 | **100** on every route | pass |
| Lighthouse mobile — Best practices | — | **100** | |
| Lighthouse mobile — SEO | — | **100** public, 66 on `/me` and `/staff` | intentional: both are `noindex` |
| Initial JS, gzipped | < 180 KB | **173.2 KB** | pass, no headroom — see §3 |
| Total initial payload | < 500 KB | **272 KB** | pass |
| Cumulative layout shift | — | **0 – 0.019** | |
| LCP, simulated Slow 4G | < 2.5 s | **2.0 – 2.6 s** | see §2 |
| WCAG AA contrast | every text run | **34 page/viewport combinations pass** | pass |
| Authorisation | proven, not asserted | **32 database assertions pass** | pass |

The map adds ~8 KB gzipped of real boundary data and no library. Everything
below is the same page weight as the landing-only build plus that.

---

## 1. What was changed, and what each change bought

Measured on Lighthouse mobile (Slow 4G, 4× CPU) against this build.

| Change | Effect |
|---|---|
| Dropped the `latin-ext` font subset | fonts 196.6 KB → 81.4 KB |
| Stopped preloading the body face | one fewer critical download; LCP 2.6 s → 2.2 s |
| Inlined the stylesheet | FCP 1.5 s → 1.2 s, LCP 2.7 s → 2.2 s, perf 95 → 99 (re-measured after the stylesheet doubled) |
| Drew the map instead of shipping MapLibre | ~200 KB gzipped avoided; 8 KB of path data instead |
| Turned off `next/link` prefetch | 19 requests → 13, 295 KB → 256 KB over the wire |
| Total initial payload | 389 KB → **272 KB**, with nine routes instead of one |

The font subset is the one worth explaining. `latin-ext` was in the brief on the
grounds that Swahili needs it. Standard Kiswahili orthography uses the plain
26-letter Latin alphabet with no diacritics, and a scan of both locale
dictionaries and the entire CRDB register finds no character in the Latin
Extended ranges. It was 111 KB of glyphs that never render — a third of the
payload. `npm run check:tokens` fails the build if any copy ever needs them.

The prefetch finding is the one worth watching. Next prefetches the React
payload of every `<Link>` that scrolls into view. On this page that meant the
entire other-language version and three legal pages downloading in the
background while the hero was still painting. On 3G that is bandwidth stolen
from the thing the user is actually looking at.

---

## 2. LCP: two numbers that disagree, and which one to believe

**Lighthouse reports 2.0–2.7 s.** The same build, measured five times with no
changes in between:

```
run 1  perf 97 | LCP 2.6 s      run 4  perf 99 | LCP 2.0 s
run 2  perf 97 | LCP 2.6 s      run 5  perf 98 | LCP 2.5 s
run 3  perf 99 | LCP 2.0 s
```

That straddles the 2.5 s budget. **Reported as not reliably met.**

**A real browser under the same throttling reports 516 ms.** Measured with
Chromium, CDP network emulation at Lighthouse's own numbers (150 ms RTT,
1.6 Mbps down) and 4× CPU throttling, reading the actual
`largest-contentful-paint` PerformanceObserver entry:

```
FCP 516 ms
LCP 516 ms  — <p class="subline">, 27158 px²
```

The two disagree because Lighthouse's default mode does not measure LCP under
throttling. It loads the page unthrottled — where it records LCP at **140 ms** —
and then feeds the request graph through a simulator ("Lantern") that models
what a slow connection would have done. The simulator's estimate is what gets
reported, and it varies run to run on a shared CI container even with identical
input.

**What this means:** the page paints its largest element as soon as the document
and the inlined stylesheet arrive — there is no image, no blocking script and no
font blocking that paint. The simulated figure is dominated by the JavaScript
in §3 and by a 458 ms simulated TTFB from `next start` on a local container,
neither of which reflects a CDN-served production deployment.

**What is still owed:** a Lighthouse run against the deployed URL on real
hosting, plus a field reading (CrUX or RUM) once there is traffic. Field data
is the only LCP number that actually describes users in Mwanza. Until then this
is reported as *probably comfortably within budget, not yet proven*.

---

## 3. The JavaScript budget is already spent — and this blocks Phase 2

173.2 KB of the 180 KB budget is gzipped JavaScript. **Almost none of it is
ours.**

Measured by removing the page's only client component and rebuilding:

```
with the client component      173.2 KB
with no client components      172.5 KB
```

**0.7 KB is application code.** The other 172.5 KB is the Next.js App Router
runtime plus React — the floor for this framework, on a page that is otherwise
entirely static HTML. Verified: none of the 63 KB seed register leaks into a
client chunk, and the largest chunk carries 29 KB of unused React internals
that cannot be tree-shaken.

Phase 2 adds MapLibre GL (~200 KB gzipped on its own), an OTP form, a QR ticket
renderer and a service worker with real offline behaviour. **Every one of those
starts from 7 KB of remaining headroom.**

This needs a decision before the map is built, not after. The options, roughly:

1. **Raise the budget for map routes only** and hold 180 KB everywhere else.
   Simplest, and honest — a map genuinely is a heavier page. Needs CRDB to
   accept a slower first load on `/map`.
2. **Route-split the map behind an explicit interaction.** The map page ships
   static HTML with a "Load the map" control; MapLibre downloads on tap. The
   user chooses to spend the data, which on a metered Tanzanian connection is
   arguably the right default anyway.
3. **Server-render map tiles as images** for the first paint, hydrating to an
   interactive map only where the connection supports it. Most work, best
   result on the target device.
4. **Re-platform the public pages** onto something with a smaller runtime
   (Astro, or Next with React Server Components and no client router). Large
   change; only worth it if the 180 KB figure is a hard commitment.

Recommendation: **(2), with (1) as the fallback.** It keeps the budget honest
everywhere, and it puts the data cost in the user's hands rather than spending
it on their behalf.

---

## 4. What is checked automatically

| Command | Gate |
|---|---|
| `npm run check:tokens` | No hex outside `tokens.css`; no copy needing `latin-ext` |
| `npm run check:stats` | Every published figure matches the CRDB register |
| `npm run check:contrast` | Every rendered text run clears WCAG AA, both locales, two viewports |
| `npm run budget` | Initial JS and total payload against the Part 0.1 limits |
| `npm run verify` | All of the above, plus typecheck and build |

`npm run check:contrast` walks every text node across 34 page/viewport
combinations and computes the real ratio against its composited background,
rather than sampling. It has now caught four things:

- **Brand teal on the busiest zone's map tile.** The wash was data-driven, so
  the label got harder to read exactly where the data was most interesting.
- **The frosted app bars at 86% ink.** A fixed bar can end up over any section,
  so its worst case is ink composited over the paper canvas — where teal
  measured 3.77:1. Raised to 92%.
- **An 80% opacity on 11px text** in the staff console, rendering at 3.55:1
  while the declared colour measured 5.21:1. The checker was extended to
  account for element opacity, which it had been ignoring.
- **Gradient-clipped text**, whose declared colour is `transparent`. The
  checker now evaluates every stop of the gradient and takes the worst.

Two of those were bugs in the checker itself, found because the tool and the
thing it checks were built against each other.

`npm run db:test` runs 32 authorisation assertions against a real PostGIS
instance, impersonating roles the way PostgREST does. Two of those assertions
found real problems the first time they ran — see
[DATABASE.md](./DATABASE.md).

Two developer scripts are not gates but are worth knowing about:
`scripts/dev/measure.sh` (clean rebuild + Lighthouse, with a guard that aborts
if the page would be measured unstyled) and `scripts/dev/lcp-probe.mjs` (real
browser LCP under real throttling).
