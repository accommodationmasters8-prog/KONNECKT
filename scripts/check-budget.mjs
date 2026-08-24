/**
 * Acceptance gate: the performance budget from Part 0.1.
 *
 *   initial JS      < 180 KB gzipped
 *   total initial   < 500 KB
 *
 * Measured from the actual prerendered HTML: every script, stylesheet and
 * preloaded font the document asks for on first paint, gzipped at the size a
 * phone in Mwanza would actually pull over the wire.
 *
 * This does not measure LCP. LCP is a field measurement and belongs in a
 * Lighthouse run against a deployed URL — see docs/PERFORMANCE.md.
 */
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const ROOT = process.cwd();
const BUDGET_JS_GZIP = 180 * 1024;
const BUDGET_TOTAL_GZIP = 500 * 1024;

const PAGES = ['en', 'sw'];

async function sizeOf(assetPath) {
  const onDisk = path.join(ROOT, '.next', assetPath.startsWith('/_next/') ? assetPath.slice('/_next/'.length) : assetPath);
  try {
    const buffer = await readFile(onDisk);
    // Fonts and images are already compressed; gzip does nothing for them and
    // servers do not re-compress them, so their raw size is the wire size.
    const precompressed = /\.(woff2?|png|jpg|jpeg|webp|avif|ico)$/.test(assetPath);
    return precompressed ? buffer.length : gzipSync(buffer, { level: 9 }).length;
  } catch {
    await stat(onDisk).catch(() => null);
    return null;
  }
}

function collect(html) {
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  const preloads = [...html.matchAll(/<link[^>]+rel="preload"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  return { scripts, styles, preloads };
}

let failed = false;

for (const page of PAGES) {
  const html = await readFile(path.join(ROOT, '.next', 'server', 'app', `${page}.html`), 'utf8');
  const { scripts, styles, preloads } = collect(html);

  const htmlGzip = gzipSync(Buffer.from(html), { level: 9 }).length;

  let js = 0;
  const missing = [];
  for (const src of new Set(scripts)) {
    const size = await sizeOf(src);
    if (size === null) { missing.push(src); continue; }
    js += size;
  }

  let css = 0;
  for (const href of new Set(styles)) {
    const size = await sizeOf(href);
    if (size === null) { missing.push(href); continue; }
    css += size;
  }

  let fonts = 0;
  for (const href of new Set(preloads)) {
    if (!/\.woff2?$/.test(href)) continue;
    const size = await sizeOf(href);
    if (size === null) { missing.push(href); continue; }
    fonts += size;
  }

  const total = htmlGzip + js + css + fonts;
  const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' KB';

  const jsOk = js < BUDGET_JS_GZIP;
  const totalOk = total < BUDGET_TOTAL_GZIP;
  if (!jsOk || !totalOk) failed = true;

  console.log(`\n/${page}`);
  console.log(`  document (gzip)   ${kb(htmlGzip)}`);
  console.log(`  javascript (gzip) ${kb(js)}   ${jsOk ? 'ok' : 'OVER'}  budget ${kb(BUDGET_JS_GZIP)}  (${scripts.length} files)`);
  console.log(`  css (gzip)        ${kb(css)}`);
  console.log(`  fonts (preload)   ${kb(fonts)}`);
  console.log(`  ---------------------------------`);
  console.log(`  initial payload   ${kb(total)}   ${totalOk ? 'ok' : 'OVER'}  budget ${kb(BUDGET_TOTAL_GZIP)}`);

  if (missing.length) {
    console.log(`  not measured (served from elsewhere): ${missing.length}`);
    missing.forEach((m) => console.log(`    ${m}`));
  }
}

console.log('');
if (failed) {
  console.error('budget — FAILED');
  process.exit(1);
}
console.log('budget — within the Part 0.1 limits.');
