import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3210';
const out = '/tmp/claude-0/shots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

const routes = process.argv[3]
  ? process.argv[3].split(',')
  : ['/en', '/en/map', '/en/events', '/en/membership', '/en/blog', '/en/me', '/sw'];

const viewports = [
  { name: 'm', width: 412, height: 900 },
  { name: 'd', width: 1440, height: 900 },
];

for (const route of routes) {
  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    // A horizontal snap rail legitimately places cards outside the viewport,
    // and `overflow-x: clip` hides them without changing body.scrollWidth — so
    // a fullPage capture comes out wider than the phone. Pin it for the
    // screenshot only; the real overflow assertion is below.
    // A horizontal snap rail legitimately places cards outside the viewport,
    // and `overflow-x: clip` hides them without changing body.scrollWidth — so
    // an unclipped fullPage capture comes out wider than the phone. Clip to the
    // real viewport width; the overflow assertion below is the actual check.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const name = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({
      path: `${out}/${vp.name}-${name}.png`,
      clip: { x: 0, y: 0, width: vp.width, height: Math.min(height, 12000) },
      fullPage: true,
    });
    const of = await page.evaluate(() => ({
      s: document.documentElement.scrollWidth,
      c: document.documentElement.clientWidth,
    }));
    console.log(
      `${vp.name} ${route.padEnd(18)} ${of.s > of.c + 1 ? `OVERFLOW ${of.s}/${of.c}` : 'ok'}`,
    );
    await page.close();
  }
}
await browser.close();
