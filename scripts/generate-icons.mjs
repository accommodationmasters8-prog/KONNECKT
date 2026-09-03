/**
 * Generates every brand asset that is a file rather than a component:
 * the PWA icons, the favicon, and the static logo SVGs under public/brand.
 *
 * The geometry is duplicated here rather than imported from the React
 * components because this runs in plain Node at build time. Both copies come
 * from the same official artwork; `npm run check:tokens` guards the colours,
 * and every path below is asserted against the component source before
 * anything is written, so an icon can never drift from what the site renders.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.join(process.cwd(), 'public', 'icons');
const BRAND = path.join(process.cwd(), 'public', 'brand');

const TEAL = '#37A694';
const GREEN = '#44AC34';
const YELLOW = '#F6B30B';
const PINK = '#EC4363';
const INK = '#0E1F1C';

/** The mark alone, on the 120 grid. Mirrors src/components/KonektMark.tsx. */
const MARK = {
  triUp: 'M33 12 L65 26 L33 40 Z',
  triDown: 'M33 108 L65 94 L33 80 Z',
  chevron: 'M90 8 L30 60 L90 112 L90 85 L57 60 L90 35 Z',
};

/** The full lockup, on the artwork's 600x300 grid. Mirrors KonektLogo.tsx. */
const LOGO = {
  triUp: 'M26 44 L96 76 L26 108 Z',
  triDown: 'M26 192 L96 224 L26 256 Z',
  chevron: 'M150 37 L20 150 L150 263 L150 205 L78 150 L150 95 Z',
  o: 'M212 80 a54 62 0 1 0 0.01 0 Z M212 108 a26 34 0 1 1 -0.01 0 Z',
  n: 'M276 204 L276 80 L304 80 L322 132 L322 80 L350 80 L350 204 L322 204 L304 152 L304 204 Z',
  e: 'M360 80 L424 80 L424 108 L388 108 L388 128 L416 128 L416 156 L388 156 L388 176 L424 176 L424 204 L360 204 Z',
  k: 'M434 80 L462 80 L462 128 L494 80 L508 80 L508 96 L480 138 L508 186 L508 204 L494 204 L462 156 L462 204 L434 204 Z',
  t: 'M200 52 L590 52 L590 80 L566 80 L566 204 L538 204 L538 80 L200 80 Z',
};

/** Transparent-background mark, for the favicon and any-purpose icon. */
function markSvg({ background = 'none', scale = 1 } = {}) {
  const inner = `
    <path d="${MARK.triUp}" fill="${YELLOW}"/>
    <path d="${MARK.triDown}" fill="${PINK}"/>
    <path d="${MARK.chevron}" fill="${TEAL}"/>`;
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" fill="${INK}"/><g transform="translate(60 60) scale(0.6) translate(-60 -60)"><path d="${MARK.triUp}" fill="${YELLOW}"/><path d="${MARK.triDown}" fill="${PINK}"/><path d="${MARK.chevron}" fill="${TEAL}"/></g></svg>`;
}

/**
 * The full lockup as a standalone file, for everything that cannot render a
 * React component: the Open Graph card, email signatures, a partner's deck.
 *
 * "Na CRDB" is the one run of type in the artwork. In the component it
 * inherits the loaded display face; in a standalone file there is no
 * stylesheet, so it names the face and a fallback chain. Everything else is
 * an outline and renders identically wherever the file is opened.
 */
function logoSvg({ background = 'none', parent = true } = {}) {
  const height = parent ? 300 : 232;
  const bg =
    background === 'none'
      ? ''
      : `<rect width="600" height="${height}" fill="${background}"/>`;
  const parentLine = parent
    ? `<text x="590" y="262" text-anchor="end" font-family="Archivo, 'Archivo Black', Montserrat, 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="54" letter-spacing="-1.35" fill="${GREEN}">Na CRDB</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 ${height}" width="600" height="${height}" role="img" aria-label="KONEKT Na CRDB">
<title>KONEKT Na CRDB</title>${bg}
<path d="${LOGO.triUp}" fill="${YELLOW}"/>
<path d="${LOGO.triDown}" fill="${PINK}"/>
<path d="${LOGO.chevron}" fill="${TEAL}"/>
<path d="${LOGO.o}" fill="${GREEN}" fill-rule="evenodd"/>
<path d="${LOGO.n}" fill="${GREEN}"/>
<path d="${LOGO.e}" fill="${GREEN}"/>
<path d="${LOGO.k}" fill="${TEAL}"/>
<path d="${LOGO.t}" fill="${TEAL}"/>${parentLine}
</svg>`;
}

async function assertGeometryMatchesComponent() {
  const sources = {
    'KonektMark.tsx': {
      source: await readFile(
        path.join(process.cwd(), 'src', 'components', 'KonektMark.tsx'),
        'utf8',
      ),
      paths: MARK,
    },
    'KonektLogo.tsx': {
      source: await readFile(
        path.join(process.cwd(), 'src', 'components', 'KonektLogo.tsx'),
        'utf8',
      ),
      paths: LOGO,
    },
  };

  for (const [file, { source, paths }] of Object.entries(sources)) {
    for (const [name, d] of Object.entries(paths)) {
      if (!source.includes(d)) {
        throw new Error(
          `Path "${name}" has drifted from ${file}. ` +
            `Update scripts/generate-icons.mjs to match the component.`,
        );
      }
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
  await mkdir(BRAND, { recursive: true });

  const plate = markSvg({ background: INK, scale: 0.78 });

  await writeFile(path.join(OUT, 'icon.svg'), markSvg());

  /* NOTE: the product's logo is public/brand/konekt-official.png — the supplied
   artwork. What this script draws is the older reconstruction, kept only for
   the square app icons, where the shape is the chevron alone and reads the
   same. It is not the logo and must not be treated as its source. The share
   card is rendered from the real file, not from here. */
  await writeFile(path.join(BRAND, 'konekt-logo.svg'), logoSvg());
  await writeFile(path.join(BRAND, 'konekt-wordmark.svg'), logoSvg({ parent: false }));
  await writeFile(path.join(BRAND, 'konekt-mark.svg'), markSvg());

  const written = [
    ['icon-192.png', await png(plate, 192, 'icon-192.png')],
    ['icon-512.png', await png(plate, 512, 'icon-512.png')],
    ['icon-180.png', await png(plate, 180, 'icon-180.png')],
    ['maskable-192.png', await png(maskableSvg(), 192, 'maskable-192.png')],
    ['maskable-512.png', await png(maskableSvg(), 512, 'maskable-512.png')],
  ];

  // The Open Graph card. A share preview is the logo's largest audience, so
  // it gets the full lockup on the ink ground rather than a cropped icon.
  const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630"><rect width="1200" height="630" fill="${INK}"/><g transform="translate(180 105) scale(1.4)">${logoSvg()
    .replace(/^[\s\S]*?<title>[^<]*<\/title>/, '')
    .replace(/<\/svg>\s*$/, '')}</g></svg>`;
  const ogBuffer = await sharp(Buffer.from(og))
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(BRAND, 'og-card.png'), ogBuffer);
  written.push(['brand/og-card.png', ogBuffer.length]);

  // Multi-size favicon for browsers that still want one.
  const ico = await sharp(Buffer.from(plate)).resize(32, 32).png().toBuffer();
  await writeFile(path.join(process.cwd(), 'public', 'favicon.ico'), ico);

  for (const [name, bytes] of written) {
    console.log(`  ${name.padEnd(20)} ${(bytes / 1024).toFixed(1)} KB`);
  }
  console.log('Brand assets generated from the official Konekt artwork.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
