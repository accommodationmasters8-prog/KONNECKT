/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    /* Inline the stylesheet into the document instead of linking it.
       Re-measured after the stylesheet roughly doubled with the app shell,
       the map and the staff console (Lighthouse mobile, Slow 4G, 4x CPU):
         linked sheet   FCP 1.5s  LCP 2.7s  TBT 80ms  perf 95
         inlined        FCP 1.2s  LCP 2.2s  TBT 40ms  perf 99
       It costs ~22KB per navigation and gives up sheet caching, and it still
       wins: on a connection where a round trip is 150ms, removing the
       render-blocking request is worth more than the cache hit. Re-measure
       again if the document goes much past ~70KB gzipped. */
    inlineCss: true,
  },

  // `/` serves the English landing page without a redirect round trip.
  // On a 3G connection a 301 hop costs a full RTT we cannot afford (Part 0.1),
  // so the default locale is rewritten server-side instead.
  async rewrites() {
    return [{ source: '/', destination: '/en' }];
  },

  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
