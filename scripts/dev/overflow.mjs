import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 412, height: 900 }, reducedMotion: 'reduce' });
await p.goto('http://localhost:3210/en', { waitUntil: 'networkidle' });
const res = await p.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), left: Math.round(r.left), right: Math.round(r.right) });
    }
  }
  window.scrollTo(9999, 0);
  const canScroll = window.scrollX;
  window.scrollTo(0, 0);
  return { vw, canScroll, bad: bad.slice(0, 12), hasStyle: document.querySelector('style')?.textContent.includes('overflow-x:clip') };
});
console.log('viewport', res.vw, '| actual sideways scroll possible:', res.canScroll, 'px');
console.log('overflow-x:clip present in CSS:', res.hasStyle);
res.bad.forEach(x => console.log('  ', x.tag, x.left, '->', x.right, '|', x.cls));
await b.close();
