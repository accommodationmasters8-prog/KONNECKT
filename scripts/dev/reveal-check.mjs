import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
mkdirSync('/tmp/claude-0/shots', { recursive: true });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 412, height: 900 }, reducedMotion: 'no-preference' });
await p.goto('http://localhost:3210/en', { waitUntil: 'networkidle' });

const supported = await p.evaluate(() => CSS.supports('animation-timeline: view()'));
console.log('scroll-driven animations supported:', supported);

// Walk down the page and confirm each section actually becomes visible.
for (const id of ['events', 'map', 'membership', 'opportunities']) {
  await p.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'center' }), id);
  await p.waitForTimeout(700);
  const state = await p.evaluate((i) => {
    const el = document.getElementById(i);
    const h = el.querySelector('h2');
    const r = h.getBoundingClientRect();
    const after = getComputedStyle(el, '::after');
    return { heading: h.textContent.slice(0, 30), top: Math.round(r.top), transform: after.transform, bg: after.backgroundColor };
  }, id);
  console.log(`  ${id.padEnd(15)} "${state.heading}" top=${state.top} ::after ${state.transform}`);
  await p.screenshot({ path: `/tmp/claude-0/shots/reveal-${id}.png` });
}
await b.close();
