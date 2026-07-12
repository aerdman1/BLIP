/**
 * PORTRAIT GALLERY CAPTURE — earns all five Signal Portraits, asserts every
 * card's <img> actually loaded (naturalWidth > 0, not the ART PENDING fallback),
 * and screenshots the Command Center gallery for eyeball review.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, startGame } from './helpers';

test('all five Signal Portrait cards load their art', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);

  for (const s of ['will', 'chip', 'henry', 'cameron', 'danny']) {
    await api(page, `api.completeSet('${s}')`);
    await page.waitForTimeout(850); // the scout-log modal fires on a 700ms delayedCall
    await api(page, 'api.dismissTransmission()');
    await page.waitForTimeout(200);
  }
  expect(await api<string[]>(page, 'api.getSaveData().earnedPortraits')).toHaveLength(5);

  await api(page, 'api.openCommandCenter()');
  await page.locator('.cc-nav a[data-target="cc-portraits"]').click();
  await expect(page.locator('#cc-portraits-count')).toContainText('5 / 5 RECOVERED');

  // wait for the five 2 MB PNGs to decode, then assert each actually loaded
  await page.waitForFunction(
    () => {
      const imgs = Array.from(document.querySelectorAll('#cc-portraits-grid .cc-portrait-img')) as HTMLImageElement[];
      return imgs.length === 5 && imgs.every((i) => i.complete && i.naturalWidth > 0);
    },
    { timeout: 15_000 }
  );

  const loaded = await page.$$eval('#cc-portraits-grid .cc-portrait-img', (imgs) =>
    (imgs as HTMLImageElement[]).map((i) => ({ src: i.src.split('/').pop(), w: i.naturalWidth, h: i.naturalHeight }))
  );
  expect(loaded).toHaveLength(5);
  for (const im of loaded) expect(im.w, `${im.src} should have decoded`).toBeGreaterThan(0);
  expect(await page.locator('#cc-portraits-grid .cc-portrait-frame.missing').count()).toBe(0);

  await page.locator('#cc-portraits').screenshot({ path: 'test-results/screenshots/signal-portraits-gallery.png' });
  console.log('PORTRAITS LOADED:', JSON.stringify(loaded));
});
