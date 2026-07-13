/* BLIP PWA service worker.
   Keeps the static Vite build available offline after the first online load. */
const CACHE_NAME = 'blip-pwa-2026-07-13-1';
const CORE_URLS = [
  '/',
  '/index.html',
  '/command-center.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/assets/portraits/will.png',
  '/assets/portraits/chip.png',
  '/assets/portraits/henry.png',
  '/assets/portraits/cameron.png',
  '/assets/portraits/danny.png',
  '/qa-status.json',
];

async function putIfOk(cache, url) {
  try {
    const response = await fetch(url, { cache: 'reload' });
    if (response && response.ok) await cache.put(url, response);
  } catch {
    /* Offline or missing optional asset: keep install resilient. */
  }
}

async function cacheHtmlAssets(cache, htmlUrl) {
  try {
    const response = await fetch(htmlUrl, { cache: 'reload' });
    if (!response || !response.ok) return;
    const text = await response.clone().text();
    await cache.put(htmlUrl, response);
    const assetUrls = new Set();
    const pattern = /["'(](\/assets\/[^"'()?\s]+)[?"')\s]/g;
    let match = pattern.exec(text);
    while (match) {
      assetUrls.add(match[1]);
      match = pattern.exec(text);
    }
    await Promise.all(Array.from(assetUrls).map((assetUrl) => putIfOk(cache, assetUrl)));
  } catch {
    /* Keep install resilient. */
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(CORE_URLS.map((url) => putIfOk(cache, url)));
      await cacheHtmlAssets(cache, '/');
      await cacheHtmlAssets(cache, '/command-center.html');
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME && key.startsWith('blip-pwa-')).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match('/index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    eventlessRefresh(cache, request);
    return cached;
  }
  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

function eventlessRefresh(cache, request) {
  fetch(request)
    .then((response) => {
      if (response && response.ok) return cache.put(request, response);
      return undefined;
    })
    .catch(() => undefined);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
