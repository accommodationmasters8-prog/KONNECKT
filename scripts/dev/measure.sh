#!/usr/bin/env bash
# Rebuild from clean, restart the production server, verify the stylesheets
# actually serve, then take a Lighthouse mobile reading.
#
# The stylesheet check is not paranoia. Starting `next start` over a directory
# that is being rebuilt — or leaving an old server on the port — serves the
# previous build's HTML with hashed assets that now 500. Lighthouse then
# measures an unstyled page, reports a *better* performance score, and invents
# a pile of accessibility failures. Every number below is worthless without it.
set -euo pipefail
cd "$(dirname "$0")/../.."

LABEL="${1:-run}"
PORT="${PORT:-3210}"
OUT="${OUT_DIR:-/tmp/claude-0}"
mkdir -p "$OUT"

# Free the port unconditionally, including servers this script did not start.
for pid in $(pgrep -f 'next-server' || true); do kill "$pid" 2>/dev/null || true; done
if [ -f "$OUT/server.pid" ]; then
  kill "$(cat "$OUT/server.pid")" 2>/dev/null || true
  rm -f "$OUT/server.pid"
fi
sleep 2

# Canonical and hreflang have to resolve to the host under test, or the SEO
# audit fails on URLs that are correct in production.
export NEXT_PUBLIC_SITE_URL="http://localhost:$PORT"

rm -rf .next
npx next build > "$OUT/build-$LABEL.log" 2>&1

npx next start -p "$PORT" > "$OUT/server.log" 2>&1 &
echo $! > "$OUT/server.pid"

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://localhost:$PORT/en" && break
  sleep 1
done

curl -s "http://localhost:$PORT/en" > "$OUT/page.html"
for u in $(grep -o 'href="[^"]*\.css"' "$OUT/page.html" | sed 's/href="//;s/"//'); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT$u")
  if [ "$code" != "200" ]; then
    echo "ABORT: stylesheet $u returned $code — the page would be measured unstyled." >&2
    exit 1
  fi
done
# A styled page always carries the brand tokens, whether the sheet is linked
# or inlined. If they are absent, the page is unstyled and any reading is junk.
if ! grep -q 'konekt-teal' "$OUT/page.html"; then
  echo "ABORT: brand tokens absent from the document — the page is unstyled." >&2
  exit 1
fi

CHROME_PATH=/opt/pw-browsers/chromium npx --yes lighthouse "http://localhost:$PORT/en" \
  --quiet --output=json --output-path="$OUT/lh-$LABEL.json" \
  --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu" \
  --only-categories=performance,accessibility,best-practices,seo > /dev/null 2>&1

node -e "
const r=require('$OUT/lh-$LABEL.json');
const a=r.audits, c=r.categories, pct=k=>String(Math.round(c[k].score*100)).padStart(3);
console.log('$LABEL'.padEnd(14),
  'perf', pct('performance'), '| a11y', pct('accessibility'),
  '| bp', pct('best-practices'), '| seo', pct('seo'),
  '| FCP', a['first-contentful-paint'].displayValue.padStart(6),
  '| LCP', a['largest-contentful-paint'].displayValue.padStart(6),
  '| TBT', a['total-blocking-time'].displayValue.padStart(7),
  '| CLS', a['cumulative-layout-shift'].displayValue);
for (const cat of ['accessibility','seo','best-practices']) {
  for (const ref of c[cat].auditRefs) {
    const au = a[ref.id];
    if (au.score !== null && au.score < 1) console.log('   ' + cat + ' FAIL: ' + ref.id);
  }
}
"
