// Build stamp injected by Vite (`define` in vite.config.ts). Matches the value
// stamped into the service worker's CACHE_NAME so the client and SW agree.
declare const __SW_VERSION__: string;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  // Reload once when a freshly-activated worker takes control, so a new deploy
  // applies automatically. The guard prevents an infinite reload loop.
  let reloaded = false;
  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  };
  // Only reload on controllerchange if a worker was ALREADY controlling this page
  // (i.e. a genuine update). On a first-ever visit, skipWaiting()+clients.claim()
  // also fires controllerchange, and reloading then is gratuitous jank.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) reloadOnce();
  });

  window.addEventListener('load', () => {
    // Version query + updateViaCache:'none' force the browser to re-fetch sw.js
    // on every load rather than serving a stale, byte-identical copy.
    navigator.serviceWorker
      .register(`/sw.js?v=${__SW_VERSION__}`, { updateViaCache: 'none' })
      .then((registration) => {
        void registration.update();

        const watch = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            // A new worker activated while an old one already controlled the page
            // => this is an update (not a first install). Reload to pick it up.
            if (worker.state === 'activated' && navigator.serviceWorker.controller) reloadOnce();
          });
        };
        watch(registration.installing);
        registration.addEventListener('updatefound', () => watch(registration.installing));

        // Re-check for a new deploy whenever the tab regains focus.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration.update();
        });
      })
      .catch((err) => {
        console.warn('[BLIP] Service worker registration failed', err);
      });
  });
}
