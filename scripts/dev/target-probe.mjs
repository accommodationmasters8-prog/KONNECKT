import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 412, height: 823 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1.75 });
await page.goto(process.argv[2] || 'http://localhost:3210/en', { waitUntil: 'networkidle' });
const rows = await page.$$eval('a, button', (els) =>
  els.map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName, cls: String(el.className).slice(0, 46),
      w: Math.round(r.width), h: Math.round(r.height),
      display: cs.display, visible: r.width > 0 && r.height > 0,
      text: (el.textContent || '').trim().slice(0, 24),
    };
  }),
);
for (const r of rows) {
  const small = r.visible && (r.w < 24 || r.h < 24);
  console.log(`${small ? 'SMALL' : '     '} ${String(r.w).padStart(4)}x${String(r.h).padStart(3)} ${r.visible ? 'vis' : 'hid'} ${r.display.padEnd(11)} ${r.cls.padEnd(46)} ${r.text}`);
}
await browser.close();
