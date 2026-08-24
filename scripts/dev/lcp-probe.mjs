import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://localhost:3210/en';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const client = await ctx.newCDPSession(page);
await client.send('Network.enable');
await client.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 150,
  downloadThroughput: (1638.4 * 1024) / 8,
  uploadThroughput: (675 * 1024) / 8,
});
await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

await page.addInitScript(() => {
  window.__lcp = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      window.__lcp.push({
        time: Math.round(e.startTime),
        size: e.size,
        tag: e.element?.tagName,
        cls: e.element?.className?.baseVal ?? e.element?.className,
        text: (e.element?.textContent || '').trim().slice(0, 60),
      });
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  window.__fcp = null;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      if (e.name === 'first-contentful-paint') window.__fcp = Math.round(e.startTime);
  }).observe({ type: 'paint', buffered: true });
});

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(4000);
const out = await page.evaluate(() => ({ fcp: window.__fcp, lcp: window.__lcp }));
console.log('FCP', out.fcp, 'ms');
console.log('LCP candidates:');
for (const c of out.lcp) console.log(' ', String(c.time).padStart(6) + 'ms', String(c.size).padStart(8), c.tag, '|', c.cls, '|', c.text);
await browser.close();
