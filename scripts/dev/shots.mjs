import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3210';
const out = '/tmp/claude-0/shots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--force-prefers-reduced-motion'],
});

const targets = [
  { name: 'mobile-en', url: `${base}/en`, w: 412, h: 900, full: true },
  { name: 'mobile-sw', url: `${base}/sw`, w: 412, h: 900, full: true },
  { name: 'narrow-320', url: `${base}/en`, w: 320, h: 900, full: true },
  { name: 'desktop-en', url: `${base}/en`, w: 1440, h: 900, full: true },
];

for (const t of targets) {
  const page = await browser.newPage({
    viewport: { width: t.w, height: t.h },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  await page.goto(t.url, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${t.name}.png`, fullPage: t.full });

  // Horizontal overflow check — the body must never scroll sideways.
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  console.log(
    `${t.name.padEnd(12)} ${t.w}px  scrollWidth ${overflow.scrollW} / client ${overflow.clientW}` +
      (overflow.scrollW > overflow.clientW + 1 ? '   HORIZONTAL OVERFLOW' : '   ok'),
  );
  await page.close();
}
await browser.close();
