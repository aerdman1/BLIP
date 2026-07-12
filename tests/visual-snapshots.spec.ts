/**
 * VISUAL SNAPSHOTS — capture the ten canonical moments for AI/human review.
 * These are not pixel-diff assertions; they exist so the QA loop (and the
 * human) can LOOK at the game. Basic sanity: canvas is not a black void.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, screenshotTo, startGame, tap, teleport, waitForScene } from './helpers';

test('capture the ten canonical moments', async ({ page }) => {
  test.setTimeout(180_000);

  await bootToMenu(page);
  await screenshotTo(page, 'main-menu');

  await startGame(page);
  await screenshotTo(page, 'miller-field-start');

  // scan reveal in the dip
  await teleport(page, 'dip');
  await tap(page, 'q');
  await page.waitForTimeout(900);
  await screenshotTo(page, 'scan-reveal-hidden-platforms');

  // badge area revealed (Will's trail) — wait out the scan cooldown first
  await teleport(page, 'badge');
  await page.waitForTimeout(2600);
  await tap(page, 'q');
  await page.waitForTimeout(1100);
  await screenshotTo(page, 'will-badge-found');

  // blipstream room
  await api(page, `api.setQuestStep('enterNode')`);
  await teleport(page, 'node');
  await tap(page, 'e');
  await waitForScene(page, 'BlipstreamScene');
  await page.waitForTimeout(900);
  await screenshotTo(page, 'blipstream-node-room');

  // puzzle complete (gate open) — solve, snap before exiting completes
  await api(page, 'api.completeBlipstreamPuzzle()');
  await page.waitForTimeout(250);
  await screenshotTo(page, 'blipstream-puzzle-complete');
  await waitForScene(page, 'FieldScene');
  await page.waitForTimeout(1500);

  // boss fight
  await teleport(page, 'bossArena');
  await expect.poll(() => api(page, 'api.getBossState()?.state ?? "none"'), { timeout: 15_000 }).toBe('fighting');
  await tap(page, 'q');
  await page.waitForTimeout(1400);
  await screenshotTo(page, 'boss-fight');

  // fragment collected (transmission card visible)
  await api(page, 'api.damageBoss(99)');
  await page.waitForTimeout(2500);
  await api(page, 'api.collectFragment()');
  await page.waitForTimeout(600);
  await screenshotTo(page, 'fragment-collected');
  await api(page, 'api.dismissTransmission()');

  // command center
  await page.keyboard.press('c');
  await page.waitForTimeout(500);
  await screenshotTo(page, 'command-center-overview');
  await page.locator('.cc-nav a[data-target="cc-scouts"]').click();
  await page.waitForTimeout(600);
  await screenshotTo(page, 'command-center-scouts');

  // sanity: key snapshots are not empty/black voids. A flat black PNG at this
  // viewport compresses to ~5 KB; a real scene is far larger. (The WebGL
  // buffer can't be read directly without preserveDrawingBuffer.)
  const { statSync } = await import('node:fs');
  for (const name of ['main-menu', 'miller-field-start', 'blipstream-node-room', 'command-center-overview']) {
    const size = statSync(`test-results/screenshots/${name}.png`).size;
    expect(size, `${name}.png should contain a real scene`).toBeGreaterThan(15_000);
  }
});
