# Measurement tools

Not part of the build and not acceptance gates — those live one directory up
and run under `npm run verify`. These are for checking claims by hand.

All of them need Chromium. They read `CHROME_PATH`, defaulting to
`/opt/pw-browsers/chromium`.

| Script | What it answers |
|---|---|
| `measure.sh [label]` | Clean rebuild, restart, Lighthouse mobile. Aborts if the page would be measured unstyled — a stale server serves the previous build's HTML with hashed assets that now 500, and Lighthouse then scores an unstyled page *higher* while inventing accessibility failures. |
| `lcp-probe.mjs` | Real LCP in a real browser under real throttling, and which element it is. Lighthouse's default mode simulates rather than measures; the two disagree by roughly 2 seconds on this page. See docs/PERFORMANCE.md §2. |
| `shots.mjs` | Screenshots at 320/412/1440, plus a horizontal-overflow check on each. |
| `overflow.mjs` | When `shots.mjs` reports sideways scroll, this names the element causing it — including whether the culprit is a pseudo-element. |
| `target-probe.mjs` | Rendered size of every link and button, flagging anything under 24×24. |
| `nojs-check.mjs` | Landmarks, headings and readable text with JavaScript disabled. |
| `reveal-check.mjs` | That the chevron reveal actually finishes and does not leave content covered. |
| `pwa-check.mjs` | Service worker registration, manifest contents, and that the install prompt is absent at first paint. |

`measure.sh` leaves a server running on port 3210 for the other scripts to use.
