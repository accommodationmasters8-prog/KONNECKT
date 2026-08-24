/*
 * CRDB Konekt service worker — Phase 1.
 *
 * Static assets only. It does not cache HTML, does not cache any API response,
 * and stores nothing about the person using it. Tickets, the offline attendee
 * list and the check-in queue are Phase 2 and Phase 3 problems; caching a
 * document now would only mean shipping stale copy to a client demo.
 *
 * Strategy:
 *   - Precache the app shell's own icons on install so the home-screen icon
 *     survives a cold, offline launch.
 *   - Runtime cache-first for build-hashed assets under /_next/static, which
 *     are immutable by construction.
 *   - Everything else goes straight to the network, untouched.
 */

const VERSION = 'konekt-static-v1';
const PRECACHE = [
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isImmutableAsset =
    url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');

  if (!isImmutableAsset) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
