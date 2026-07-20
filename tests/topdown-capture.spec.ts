/**
 * Top-down visual review storyboard.
 *
 * Captures a fixed set of beats to qa-reports/topdown/ for critical review
 * against TOPDOWN_VISUAL_SPEC.md's acceptance criteria. Capturing is not the
 * point — LOOKING at these and naming what is wrong is.
 */
import { test } from '@playwright/test';
import { api, bootToMenu, screenshotTo, waitForScene } from './helpers';

const OUT = 'qa-reports/topdown';

async function enterArena(page: import('@playwright/test').Page) {
  await bootToMenu(page);
  await api(page, `api.enterSweep('surface-z1')`);
  await waitForScene(page, 'SweepScene');
  await page.waitForTimeout(1400); // let the fade-in finish and lights settle
}

test('survey: representative locations', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await enterArena(page);
  await screenshotTo(page, `${OUT}/s0-spawn`);
  // walk a route past open ground, a wall run, and the node
  const legs: Array<[string, number]> = [['KeyD', 1500], ['KeyW', 1200], ['KeyD', 1400], ['KeyS', 900]];
  let i = 1;
  for (const [k, ms] of legs) {
    await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    await page.keyboard.up(k);
    await page.waitForTimeout(250);
    await screenshotTo(page, `${OUT}/s${i++}-leg`);
  }
});

/**
 * Close-combat readability proof. The brief's non-negotiable is that drones can
 * never visually hide CONTACT-47, so these captures FORCE the worst cases:
 * enemies teleported adjacent, from several directions, in numbers.
 */
test('close combat: enemies cannot hide the player', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await enterArena(page);
  await screenshotTo(page, `${OUT}/c0-alone`);

  const stage = (n: number, radius: number) =>
    page.evaluate(([count, r]) => {
      const api = (window as any).__BLIP_TEST_API__;
      api.stageSweepEnemies(count, r);
    }, [n, radius] as const);

  await stage(1, 26);
  await page.waitForTimeout(900);
  await screenshotTo(page, `${OUT}/c1-one-beside`);

  await stage(4, 18);
  await page.waitForTimeout(1100);
  await screenshotTo(page, `${OUT}/c2-four-close`);

  await stage(6, 40);
  await page.waitForTimeout(1100);
  await screenshotTo(page, `${OUT}/c3-multi-direction`);
});

test('scale reference: player, node, terrain', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await enterArena(page);
  await page.evaluate(() => (window as any).__BLIP_TEST_API__.warpToNode());
  await page.waitForTimeout(1000);
  await screenshotTo(page, `${OUT}/c4-at-node`);
});

test.describe('top-down visual storyboard', () => {
  test('beats', async ({ page }) => {
    await enterArena(page);
    await screenshotTo(page, `${OUT}/01-spawn`);

    // walk toward the node so the mid-arena and the node light pool are seen
    for (const [key, ms] of [['KeyD', 900], ['KeyW', 700]] as const) {
      await page.keyboard.down(key);
      await page.waitForTimeout(ms);
      await page.keyboard.up(key);
    }
    await screenshotTo(page, `${OUT}/02-traverse`);

    await api(page, 'api.toggleGodMode(true)');
    await page.waitForTimeout(600);
    await screenshotTo(page, `${OUT}/03-combat`);

    // node at full charge — the bloom-out + cyan shift
    await api(page, 'api.completeBlipstreamPuzzle()');
    await page.waitForTimeout(500);
    await screenshotTo(page, `${OUT}/04-breach`);
  });

  test('responsive', async ({ page }) => {
    for (const [w, h, name] of [
      [1920, 1080, 'desktop'],
      [1024, 768, 'tablet'],
      [844, 390, 'phone-landscape'],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await enterArena(page);
      await screenshotTo(page, `${OUT}/10-${name}`);
    }
  });

  test('side-view regression reference', async ({ page }) => {
    await bootToMenu(page);
    await api(page, `api.enterZone('miller-field')`);
    await waitForScene(page, 'FieldScene');
    await page.waitForTimeout(1200);
    await screenshotTo(page, `${OUT}/20-sideview-miller`);
  });
});
