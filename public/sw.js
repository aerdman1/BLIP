/* BLIP PWA service worker.
   Keeps the static Vite build available offline after the first online load. */
/* CACHE_NAME is stamped per build: the Vite plugin (see vite.config.ts) replaces
   the __SW_VERSION__ token at build time so every deploy invalidates old caches
   and the byte content of sw.js changes (the browser then sees a real update). */
const CACHE_NAME = 'blip-pwa-__SW_VERSION__';
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
  // HD top-down art (surface-z1) — the game's only file-loaded game assets.
  // Precached so the arena works offline; images are served cache-first below.
  '/assets/topdown/topdown-z1.webp',
  '/assets/topdown/topdown-z1.json',
  '/assets/topdown/td-ground.webp',
  '/assets/topdown/td-ground-lit.webp',
  '/assets/topdown/td-ground-dark.webp',
  '/assets/topdown/td-path.webp',
  '/assets/topdown/td-wall-top.webp',
  '/assets/topdown/td-wall-face.webp',
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

  // App shell (navigations) and hashed JS/CSS bundles are network-first: always
  // try the network so a fresh deploy is picked up, falling back to cache offline.
  const isDocument = request.mode === 'navigate' || request.destination === 'document';
  const isCodeAsset =
    request.destination === 'script' ||
    request.destination === 'style' ||
    /\.(?:js|mjs|css)$/.test(url.pathname);

  if (isDocument || isCodeAsset) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static images / icons / fonts stay cache-first for speed and offline use.
  event.respondWith(cacheFirst(request));
});
