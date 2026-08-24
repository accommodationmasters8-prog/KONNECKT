import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 412, height: 900 } });
const requests = [];
p.on('response', (r) => requests.push([r.status(), r.url().replace('http://localhost:3210', '')]));
await p.goto('http://localhost:3210/en', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

const sw = await p.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.map((r) => ({ scope: r.scope, active: !!r.active, state: r.active?.state }));
});
console.log('service worker registrations:', JSON.stringify(sw));

const manifest = await p.evaluate(async () => {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return 'NO MANIFEST LINK';
  const res = await fetch(link.href);
  const m = await res.json();
  return {
    name: m.name, short_name: m.short_name, display: m.display,
    start_url: m.start_url, theme_color: m.theme_color,
    icons: m.icons.map((i) => `${i.sizes} ${i.type} ${i.purpose}`),
  };
});
console.log('manifest:', JSON.stringify(manifest, null, 1));

// The install prompt must not appear before the value moment.
const early = await p.$('[role="dialog"]');
console.log('install sheet visible at first paint:', !!early, '(must be false)');

console.log('icon requests:', requests.filter(([, u]) => u.includes('icon') || u.includes('manifest')).map(([s, u]) => `${s} ${u}`).join(', '));
await b.close();
