/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    /* Inline the stylesheet into the document instead of linking it.
       Measured on Lighthouse mobile (Slow 4G, 4x CPU) against this build:
         linked sheet   FCP 1.4s  LCP 2.6s  perf 97
         inlined        FCP 1.1s  LCP 2.0s  perf 99
       It costs ~16KB per navigation and gives up sheet caching. On a
       connection where a round trip is 150ms and the whole sheet is 8.6KB
       gzipped, removing the render-blocking request is worth more than the
       cache hit. Re-measure this if the stylesheet grows past ~30KB. */
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
