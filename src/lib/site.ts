/**
 * Absolute origin for canonical URLs, hreflang alternates, the sitemap and
 * social card images.
 *
 * The production hostname is still open — CRDB has not confirmed whether
 * Konekt lives on its own domain or under crdbbank.co.tz. The placeholder
 * below is deliberately obvious so it cannot ship unnoticed; set
 * NEXT_PUBLIC_SITE_URL in the deployment environment. See docs/OPEN-ITEMS.md.
 */
const FALLBACK = 'https://konekt.example.crdb.co.tz';

export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || FALLBACK);

export const usingFallbackOrigin = !process.env.NEXT_PUBLIC_SITE_URL;
