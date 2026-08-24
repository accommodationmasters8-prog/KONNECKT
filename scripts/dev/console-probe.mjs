import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:3311/en';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 412, height: 900 } });
p.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) console.log(`[${m.type()}] ${m.text().slice(0, 900)}`);
});
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 900)));
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await b.close();
