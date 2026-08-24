/**
 * Finds a hydration mismatch by diffing the server HTML against the DOM after
 * React has hydrated. React's own message names the tree but not the node.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://localhost:3311/en';
const serverHtml = await (await fetch(url)).text();

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 412, height: 900 } });
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const clientHtml = await p.evaluate(() => document.body.innerHTML);
await b.close();

const strip = (h) =>
  h
    .replace(/<!--[\s\S]*?-->/g, '')
    // Next injects its own scripts and a hidden bootstrap div into the client
    // DOM after hydration; they are not part of the mismatch.
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<div hidden=""><\/div>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><');

const serverBody = strip(
  serverHtml.slice(serverHtml.indexOf('<body'), serverHtml.lastIndexOf('</body>')),
).replace(/^<body[^>]*>/, '');
const clientBody = strip(clientHtml);

// Walk both until they diverge, then print the neighbourhood.
let i = 0;
while (i < Math.min(serverBody.length, clientBody.length) && serverBody[i] === clientBody[i]) i += 1;

if (i >= Math.min(serverBody.length, clientBody.length) - 2) {
  console.log('No structural difference found in the body.');
} else {
  console.log('First divergence at character', i);
  console.log('\n--- server ---');
  console.log(serverBody.slice(Math.max(0, i - 260), i + 260));
  console.log('\n--- client ---');
  console.log(clientBody.slice(Math.max(0, i - 260), i + 260));
}
