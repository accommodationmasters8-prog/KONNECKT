/**
 * Generates every PWA and favicon asset from the chevron mark.
 *
 * The mark geometry is duplicated here rather than imported from the React
 * component because this runs in plain Node at build time. Both copies come
 * from the same 58deg construction; `npm run check:tokens` guards the colours,
 * and the paths are asserted against the component below.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.join(process.cwd(), 'public', 'icons');

const TEAL = '#37A694';
const YELLOW = '#F6B30B';
const PINK = '#EC4363';
const INK = '#0E1F1C';

const PATHS = {
  triUp: 'M38 14 L58 46 L18 46 Z',
  triDown: 'M38 106 L18 74 L58 74 Z',
  arrow: 'M79.75 18 L106 60 L79.75 102 L55.75 102 L82 60 L55.75 18 Z',
};

/** Transparent-background mark, for the favicon and any-purpose icon. */
function markSvg({ background = 'none', scale = 1 } = {}) {
  const inner = `
    <path d="${PATHS.triUp}" fill="${YELLOW}"/>
    <path d="${PATHS.triDown}" fill="${PINK}"/>
    <path d="${PATHS.arrow}" fill="${TEAL}"/>`;
  const bg =
    background === 'none'
      ? ''
      : `<rect width="120" height="120" rx="26" fill="${background}"/>`;
  const group =
    scale === 1
      ? inner
      : `<g transform="translate(60 60) scale(${scale}) translate(-60 -60)">${inner}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">${bg}${group}</svg>`;
}

/**
 * Maskable icons are cropped to a circle of 80% diameter on some launchers, so
 * the mark is scaled into that safe zone and the ink plate carries the rest.
 */
function maskableSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" fill="${INK}"/><g transform="translate(60 60) scale(0.6) translate(-60 -60)"><path d="${PATHS.triUp}" fill="${YELLOW}"/><path d="${PATHS.triDown}" fill="${PINK}"/><path d="${PATHS.arrow}" fill="${TEAL}"/></g></svg>`;
}

async function assertGeometryMatchesComponent() {
  const source = await readFile(
    path.join(process.cwd(), 'src', 'components', 'KonektMark.tsx'),
    'utf8',
  );
  for (const [name, d] of Object.entries(PATHS)) {
    if (!source.includes(d)) {
      throw new Error(
        `Icon path "${name}" has drifted from KonektMark.tsx. ` +
          `Update scripts/generate-icons.mjs to match the component.`,
      );
    }
  }
}

async function png(svg, size, file) {
  const buffer = await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  await writeFile(path.join(OUT, file), buffer);
  return buffer.length;
}

async function main() {
  await assertGeometryMatchesComponent();
  await mkdir(OUT, { recursive: true });

  const plate = markSvg({ background: INK, scale: 0.78 });

  await writeFile(path.join(OUT, 'icon.svg'), markSvg());

  const written = [
    ['icon-192.png', await png(plate, 192, 'icon-192.png')],
    ['icon-512.png', await png(plate, 512, 'icon-512.png')],
    ['icon-180.png', await png(plate, 180, 'icon-180.png')],
    ['maskable-192.png', await png(maskableSvg(), 192, 'maskable-192.png')],
    ['maskable-512.png', await png(maskableSvg(), 512, 'maskable-512.png')],
  ];

  // Multi-size favicon for browsers that still want one.
  const ico = await sharp(Buffer.from(plate)).resize(32, 32).png().toBuffer();
  await writeFile(path.join(process.cwd(), 'public', 'favicon.ico'), ico);

  for (const [name, bytes] of written) {
    console.log(`  ${name.padEnd(20)} ${(bytes / 1024).toFixed(1)} KB`);
  }
  console.log('Icons generated from the chevron mark.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
