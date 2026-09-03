/* The project's own Supabase origin, for the connect-src allowance. Read from
   the same variable the client uses, so a project swap cannot leave the policy
   pointing at the previous one. Falls back to the wildcard when unset, which
   is the case for a build with no database attached. */
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return 'https://*.supabase.co';
  }
})();

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

          /* Clickjacking. The console has one-click destructive actions —
             delete a station, clear the sample data, revoke a grant — and
             without this any site could load it in an invisible frame over
             its own buttons and harvest the clicks. `frame-ancestors` in the
             policy below is the modern rule; the header stays for the older
             browsers a branch desktop still runs. */
          { key: 'X-Frame-Options', value: 'DENY' },

          /* Nothing here needs a camera, a microphone or a location, so no
             embedded frame gets to ask for one either. */
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },

          /* HSTS. Vercel already redirects to HTTPS; this stops the first
             plaintext request from being made at all, which is the one an
             attacker on a branch's wifi gets to answer. */
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },

          /* The content policy.
             `'unsafe-inline'` on scripts is not a choice while Next inlines
             its own bootstrap without a nonce — issuing one needs the
             middleware to rewrite every response, which would cost a render
             on requests that are currently static. Everything else is shut:
             no plugins, no other origin's frames, no form posting away from
             this site, and connections only to this origin and Supabase. */
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "form-action 'self'",
              /* React's development build reconstructs stack traces with
                 eval(), so a dev server under this policy logs an error on
                 every page. Production never needs it and never gets it. */
              process.env.NODE_ENV === 'development'
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                : "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              `connect-src 'self' ${supabaseOrigin} https://*.supabase.co wss://*.supabase.co`,
              "worker-src 'self'",
              "manifest-src 'self'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
