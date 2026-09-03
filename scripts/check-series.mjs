/**
 * Acceptance gate: the chart series ramps stay tellable apart.
 *
 * A categorical palette fails quietly. Two series that are 8 units apart in
 * Lab still look like two colours to whoever picked them, and like one colour
 * to the reader — so this measures rather than trusts:
 *
 *   1. contrast against the panel the marks are drawn on (>= 3:1, the
 *      non-text floor in WCAG 2.1),
 *   2. separation between every pair in normal vision (>= 15 dE),
 *   3. separation between every pair under protanopia and deuteranopia
 *      (>= 15 dE), simulated with the Vienot 1999 matrices.
 *
 * Both ramps are checked: the light one on the white panel, the dark one on
 * the raised dark surface. Values are read out of tokens.css rather than
 * repeated here, so editing a token is what this test is testing.
 *
 * Usage: node scripts/check-series.mjs
 */
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

/** Pull one custom property's literal hex out of tokens.css. */
function token(name) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`tokens.css has no literal value for --${name}`);
  return match[1];
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const luminance = (h) => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** CIE Lab, D65. dE76 — cruder than dE2000 and stricter in the blues, which
    is the safe direction for a gate. */
const lab = ([R, G, B]) => {
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const CVD = {
  protanopia: [[0.1120, 0.8853, -0.0005], [0.1084, 0.8914, 0.0003], [0.0041, -0.0139, 1.0]],
  deuteranopia: [[0.2929, 0.7058, 0.0011], [0.3006, 0.6974, 0.0019], [-0.0210, 0.0286, 0.9925]],
};
const through = (h, matrix) => {
  const v = hex(h).map(lin);
  return matrix.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
};

const CONTRAST_FLOOR = 3;
const SEPARATION_FLOOR = 15;

const ramps = [
  {
    name: 'light',
    panel: token('surface-raised'),
    series: [1, 2, 3, 4, 5].map((n) => token(`series-${n}`)),
  },
  {
    name: 'dark',
    panel: token('dark-raised'),
    series: [1, 2, 3, 4, 5].map((n) => token(`dark-series-${n}`)),
  },
];

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`  FAIL  ${message}`);
};

for (const ramp of ramps) {
  console.log(`\n${ramp.name} ramp, on ${ramp.panel}`);

  for (const colour of ramp.series) {
    const value = contrast(colour, ramp.panel);
    const line = `${colour}  ${value.toFixed(2)}:1 on panel`;
    if (value < CONTRAST_FLOOR) fail(`${line} (needs ${CONTRAST_FLOOR})`);
    else console.log(`  ok    ${line}`);
  }

  const views = { 'normal vision': (c) => hex(c).map(lin), ...Object.fromEntries(
    Object.entries(CVD).map(([name, matrix]) => [name, (c) => through(c, matrix)]),
  ) };

  for (const [view, project] of Object.entries(views)) {
    let worst = { value: Infinity, pair: '' };
    for (let i = 0; i < ramp.series.length; i += 1) {
      for (let j = i + 1; j < ramp.series.length; j += 1) {
        const value = distance(lab(project(ramp.series[i])), lab(project(ramp.series[j])));
        if (value < worst.value) worst = { value, pair: `${ramp.series[i]} / ${ramp.series[j]}` };
      }
    }
    const line = `${view}: worst pair ${worst.pair} at dE ${worst.value.toFixed(1)}`;
    if (worst.value < SEPARATION_FLOOR) fail(`${line} (needs ${SEPARATION_FLOOR})`);
    else console.log(`  ok    ${line}`);
  }
}

if (failures) {
  console.error(`\ncheck:series — FAILED (${failures} check(s) below floor)`);
  process.exit(1);
}
console.log('\ncheck:series — both ramps clear the contrast and separation floors.');
