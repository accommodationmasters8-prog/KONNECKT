/**
 * Acceptance gate: WCAG 2.1 AA contrast, on every rendered text node.
 *
 * Lighthouse samples. This walks the whole page in both locales and computes
 * the real ratio for every visible run of text against its effective
 * background, including the data-driven tile washes where the background
 * differs per element. It caught brand teal failing on the busiest zone's
 * tile, which is exactly the case a sampled audit is most likely to miss.
 *
 * Usage: node scripts/check-contrast.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || process.env.BASE_URL || 'http://localhost:3210';
const EXECUTABLE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const PAGES = [
  '/en', '/sw',
  '/en/map', '/sw/map',
  '/en/events', '/sw/events',
  '/en/membership', '/sw/membership',
  '/en/opportunities', '/en/blog', '/en/me',
  '/en/staff', '/en/staff/verification', '/en/staff/accounts', '/en/staff/check-in',
  '/en/privacy', '/sw/terms',
];
const VIEWPORTS = [
  { name: 'phone', width: 412, height: 900 },
  { name: 'desktop', width: 1440, height: 900 },
];

const audit = () => {
  const srgb = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  // Chrome serialises color-mix() as `color(srgb r g b / a)` with 0..1
  // channels, not as rgba(). Parsing only rgba() silently treated the frosted
  // app bars as having no background at all, which made the checker walk up to
  // the page canvas and report nonsense.
  const parse = (value) => {
    if (!value || value === 'transparent') return null;
    if (/^rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(value.replace(/\s+/g, ' '))) return null;

    const srgbFn = value.match(/^color\(\s*srgb\s+([^)]+)\)/i);
    if (srgbFn) {
      const parts = srgbFn[1].split(/[\s/]+/).filter(Boolean).map(Number);
      if (parts.length < 3 || parts.some(Number.isNaN)) return null;
      return {
        r: parts[0] * 255,
        g: parts[1] * 255,
        b: parts[2] * 255,
        a: parts.length > 3 ? parts[3] : 1,
      };
    }

    const rgbFn = value.match(/rgba?\(([^)]+)\)/);
    if (rgbFn) {
      const parts = rgbFn[1].split(/[,/\s]+/).filter(Boolean).map(Number);
      if (parts.length < 3 || parts.some(Number.isNaN)) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }

    // Anything else — a colour space this parser does not know — must fail
    // loudly rather than be treated as transparent.
    throw new Error(`check:contrast cannot parse the colour "${value}"`);
  };
  const lum = ({ r, g, b }) =>
    0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
  const ratio = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });

  // Walk up until an opaque background is found, compositing translucent
  // layers on the way — the tile washes are opaque but cards are not always.
  // An element's rendered colour is its own colour faded by every opacity
  // between it and the root. Ignoring that let an 80% opacity on 11px text
  // pass this checker at 5.21:1 while actually rendering at 3.55:1.
  const effectiveOpacity = (el) => {
    let value = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const o = parseFloat(getComputedStyle(n).opacity);
      if (!Number.isNaN(o)) value *= o;
    }
    return value;
  };

  const backgroundOf = (el) => {
    let stack = [];
    let node = el;
    while (node && node !== document.documentElement.parentNode) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) {
        stack.push(bg);
        if (bg.a === 1) break;
      }
      node = node.parentElement;
    }
    if (!stack.length) return { r: 255, g: 255, b: 255, a: 1 };
    return stack.reduceRight((acc, layer) => over(layer, acc));
  };

  // Text inside an aria-hidden subtree is not exposed to anyone reading the
  // page as content — it is decoration, and SC 1.4.3 exempts it. This is the
  // same exclusion axe applies. It is reported rather than dropped silently,
  // so mislabelling real content as decoration shows up in the output.
  const decorative = (el) => {
    for (let n = el; n; n = n.parentElement) {
      if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return true;
    }
    return false;
  };

  const results = [];
  const skipped = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();

  while (walker.nextNode()) {
    const text = walker.currentNode.nodeValue.trim();
    if (!text) continue;
    const el = walker.currentNode.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);

    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const opacity = effectiveOpacity(el);
    if (opacity === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    // Visually hidden helpers are not rendered text.
    if (rect.width <= 1 && rect.height <= 1) continue;

    // Text painted through background-clip: text has `color: transparent` and
    // takes its colour from the background image. Checking the declared colour
    // would score it 1:1 and miss the real question, which is whether every
    // stop of that gradient clears AA against the ground behind it.
    const clip = cs.webkitBackgroundClip || cs.backgroundClip;
    const isGradientText =
      clip === 'text' && parse(cs.color) === null;

    let fgRaw = parse(cs.color);

    if (isGradientText) {
      const stops = [...(cs.backgroundImage || '').matchAll(/(rgba?\([^)]+\)|color\(srgb[^)]+\))/g)]
        .map((m) => parse(m[0]))
        .filter(Boolean);
      if (stops.length === 0) continue;
      // The worst stop decides. A gradient whose light end is legible and
      // whose dark end is not has still failed for the letters at that end.
      const bgHere = backgroundOf(el.parentElement ?? el);
      let worst = null;
      let worstRatio = Infinity;
      for (const stop of stops) {
        const composited = stop.a < 1 ? over(stop, bgHere) : stop;
        const r = ratio(composited, bgHere);
        if (r < worstRatio) { worstRatio = r; worst = composited; }
      }
      fgRaw = worst;
    }

    if (!fgRaw) continue;

    if (decorative(el)) {
      skipped.push({ text: text.slice(0, 32), selector: el.tagName.toLowerCase() });
      continue;
    }
    // Gradient text takes the background of its parent: its own background is
    // the gradient being clipped, which is not a ground.
    const bg = backgroundOf(isGradientText ? (el.parentElement ?? el) : el);
    const alpha = fgRaw.a * opacity;
    const fg = alpha < 1 ? over({ ...fgRaw, a: alpha }, bg) : fgRaw;

    const px = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    // AA: 3:1 for large text (>=24px, or >=18.66px bold), else 4.5:1.
    const large = px >= 24 || (px >= 18.66 && weight >= 700);
    const required = large ? 3 : 4.5;
    const value = ratio(fg, bg);

    if (value + 0.005 < required) {
      results.push({
        text: text.slice(0, 48),
        selector: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
        ratio: Math.round(value * 100) / 100,
        required,
        fontSize: px,
        weight,
      });
    }
  }
  return { results, skipped };
};

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--no-sandbox'] });
let failures = 0;
let checked = 0;
const reportedSkips = new Set();

for (const viewport of VIEWPORTS) {
  for (const path of PAGES) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      // The reveal covers sit over content mid-animation; with motion reduced
      // they never exist, so every text node is measured against its real
      // background rather than an in-flight overlay.
      reducedMotion: 'reduce',
    });
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const { results: bad, skipped } = await page.evaluate(audit);
    checked += 1;
    if (skipped.length && !reportedSkips.has(path)) {
      reportedSkips.add(path);
      console.log(
        `  ${path}: ${skipped.length} decorative (aria-hidden) run(s) excluded: ` +
          skipped.map((s) => `"${s.text}"`).join(', '),
      );
    }
    if (bad.length) {
      failures += bad.length;
      console.error(`\n${path} @ ${viewport.name} — ${bad.length} failure(s):`);
      for (const b of bad) {
        console.error(
          `  ${String(b.ratio).padStart(5)}:1 (needs ${b.required}) ` +
            `${b.fontSize}px/${b.weight}  ${b.selector}  "${b.text}"`,
        );
      }
    }
    await page.close();
  }
}

await browser.close();

if (failures) {
  console.error(`\ncheck:contrast — FAILED (${failures} text runs below AA)`);
  process.exit(1);
}
console.log(`check:contrast — every rendered text run clears WCAG 2.1 AA across ${checked} page/viewport combinations.`);
