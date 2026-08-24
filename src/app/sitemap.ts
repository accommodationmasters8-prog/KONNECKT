import type { MetadataRoute } from 'next';
import { locales, localeTags } from '@/i18n';
import { siteUrl } from '@/lib/site';

const ROUTES = ['', '/privacy', '/terms', '/accessibility'];

/**
 * Every page exists in both languages, and each one declares the other as an
 * alternate. Swahili is not a translation bolted onto an English site; the two
 * are peers in the sitemap as well as in the copy.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) =>
    ROUTES.map((route) => ({
      url: new URL(`/${locale}${route}`, siteUrl).toString(),
      lastModified: new Date(),
      changeFrequency: route === '' ? ('weekly' as const) : ('yearly' as const),
      priority: route === '' ? 1 : 0.4,
      alternates: {
        languages: Object.fromEntries(
          locales.map((code) => [
            localeTags[code],
            new URL(`/${code}${route}`, siteUrl).toString(),
          ]),
        ),
      },
    })),
  );
}
