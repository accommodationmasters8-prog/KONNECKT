/**
 * Acceptance gate: the page is fully usable for reading with JS disabled.
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:3210';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

for (const path of ['/en', '/sw']) {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 412, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'load' });

  const state = await page.evaluate(() => ({
    headings: [...document.querySelectorAll('h1, h2')].map((h) => h.textContent.trim().slice(0, 34)),
    sections: [...document.querySelectorAll('main section')].map((s) => s.id),
    links: document.querySelectorAll('a[href]').length,
    bodyText: document.body.innerText.length,
    landmarks: {
      header: !!document.querySelector('header'),
      main: !!document.querySelector('main'),
      footer: !!document.querySelector('footer'),
      nav: document.querySelectorAll('nav').length,
    },
    lang: document.documentElement.lang,
    // Nothing should be left invisible by a reveal that never runs.
    hiddenByReveal: [...document.querySelectorAll('.reveal-head')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height === 0;
    }).length,
  }));

  console.log(`\n${path}  lang=${state.lang}  text=${state.bodyText} chars  links=${state.links}`);
  console.log('  landmarks:', JSON.stringify(state.landmarks));
  console.log('  sections:', state.sections.join(', '));
  console.log('  headings:', state.headings.join(' | '));
  console.log('  reveal blocks collapsed:', state.hiddenByReveal);
  await ctx.close();
}
await browser.close();
