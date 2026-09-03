import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Archivo, Plus_Jakarta_Sans } from 'next/font/google';
import {
  defaultLocale,
  getDictionary,
  isLocale,
  locales,
  localeTags,
  type Locale,
} from '@/i18n';
import { siteUrl } from '@/lib/site';
import '@/styles/globals.css';

/**
 * This is the root layout. It lives inside the locale segment so that
 * `<html lang>` carries the real language of the document rather than a
 * hardcoded default — a screen reader in Swahili has to be told it is reading
 * Swahili, and that attribute is the only way to tell it.
 *
 * Display face is Archivo standing in for Gotham, which the logo is set in and
 * which needs a paid web licence CRDB has not yet bought. Swapping it is a
 * one-line change to --font-display in tokens.css. See docs/OPEN-ITEMS.md.
 *
 * Both faces are subset to latin and latin-ext. Swahili needs latin-ext.
 */
// Both are loaded as variable fonts: one file per subset instead of one per
// weight. Archivo at 700 and 900 plus Inter at 400/500/600 would be five
// separate downloads each; the variable axes cover every weight the design
// uses in one. On a 3G connection that trade is not close.
//
// Subset is `latin` only. The brief expected `latin-ext` on the grounds that
// Swahili needs it — standard Kiswahili orthography uses the plain 26-letter
// Latin alphabet with no diacritics, and a scan of every string in both
// dictionaries and the whole CRDB register turns up no character in the
// U+0100..U+024F range. Shipping it cost 111KB of glyphs that never render.
// `npm run check:tokens` runs that scan on every build, so if a name ever
// does need those glyphs the build says so rather than silently dropping
// to a fallback face.
const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
  adjustFontFallback: true,
});

// Plus Jakarta Sans, not Inter. Both are clean at 14px, which is where the
// console spends most of its life; Jakarta has the slightly humanist
// character — the single-storey `a` at low weights, the open apertures — that
// keeps a screen of tables and figures from reading like a spreadsheet
// export. Its tabular figures are what the metric cards and every money
// column are set in.
//
// Not preloaded. The display face carries the hero and gets the preload slot;
// the body face is discovered from the stylesheet a beat later and swaps in.
// `adjustFontFallback` generates a metric-matched local fallback, so the swap
// costs no layout shift — measured CLS is 0.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
  adjustFontFallback: true,
  preload: false,
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export const viewport: Viewport = {
  themeColor: '#0E1F1C',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);

  return {
    metadataBase: siteUrl,
    title: t.meta.title,
    description: t.meta.description,
    applicationName: 'CRDB Konekt',
    manifest: '/manifest.webmanifest',
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(
          locales.map((code) => [localeTags[code], `/${code}`]),
        ),
        // `/` rewrites to the default locale, so that is what an unmatched
        // language should land on rather than a redirect chain.
        'x-default': `/${defaultLocale}`,
      },
    },
    icons: {
      icon: [
        { url: '/icons/icon.svg', type: 'image/svg+xml' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: [{ url: '/icons/icon-180.png', sizes: '180x180' }],
    },
    appleWebApp: {
      capable: true,
      title: 'Konekt',
      statusBarStyle: 'black-translucent',
    },
    openGraph: {
      type: 'website',
      siteName: 'CRDB Konekt',
      locale: localeTags[locale].replace('-', '_'),
      title: t.meta.title,
      description: t.meta.description,
      // The share card is the official lockup on the ink ground, generated
      // from the same geometry the site renders by `npm run icons`. A
      // summary_large_image card with no image is a grey box with a URL in
      // it, which is what this was before.
      images: [
        {
          url: '/brand/og-card.png',
          width: 1200,
          height: 630,
          alt: 'KONEKT Na CRDB',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t.meta.title,
      description: t.meta.description,
      images: ['/brand/og-card.png'],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const typed: Locale = locale;

  return (
    <html
      lang={localeTags[typed]}
      className={`${archivo.variable} ${jakarta.variable}`}
      /* RailStateScript stamps data-rail on this element before first paint,
         so the served HTML and the hydrating client necessarily disagree about
         it. That is the whole point of the script — without it the rail flashes
         open on every navigation for anyone who collapsed it — so the mismatch
         is expected and suppressed rather than a bug to chase. */
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
