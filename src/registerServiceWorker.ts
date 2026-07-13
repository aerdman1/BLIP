export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        void registration.update();
      })
      .catch((err) => {
        console.warn('[BLIP] Service worker registration failed', err);
      });
  });
}
