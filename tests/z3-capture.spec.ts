/**
 * Zone 3 visual capture — screenshots the key beats (stadium stealth, the
 * underwater reflection node, the Weather Balloon fight) for review. Playwright
 * drives the real clock (the preview panel throttles rAF), so timed scene
 * switches actually fire here.
 */
import { test } from '@playwright/test';
import { api, bootToMenu, screenshotTo, waitForScene } from './helpers';

test('capture Zone 3 beats', async ({ page }) => {
  test.setTimeout(90_000);
  await bootToMenu(page);
  await api(page, "api.enterZone('tiger-stadium')");
  await waitForScene(page, 'StadiumScene');
  await page.waitForTimeout(900);
  await api(page, 'api.dismissTransmission()');
  await page.waitForTimeout(500);

  // stadium: stand under the light-cone gauntlet by the scoreboard
  await api(page, 'api.teleportTo(760, 472)');
  await page.waitForTimeout(700);
  await screenshotTo(page, 'z3-stadium');

  // dive → underwater reflection node
  await api(page, "api.setQuestStep('poolDive')");
  await api(page, 'api.divePool()');
  await waitForScene(page, 'UnderwaterScene');
  await page.waitForTimeout(900); // fade-in + echo settle
  await screenshotTo(page, 'z3-underwater');

  // surface, then wake the Weather Balloon
  await api(page, 'api.completeBlipstreamPuzzle()');
  await waitForScene(page, 'StadiumScene');
  await page.waitForTimeout(400);
  await api(page, "api.setQuestStep('bossFight')");
  // stand in the arena (centerX ~ col 171) so the balloon is in frame
  await api(page, 'api.teleportTo(2680, 460)');
  await page.waitForTimeout(300);
  await api(page, 'api.spawnBoss()');
  await page.waitForFunction(
    () => (window as never as Record<string, { getBossState?: () => { state: string } | null }>).__BLIP_TEST_API__?.getBossState?.()?.state === 'fighting',
    { timeout: 15_000 }
  );
  await page.waitForTimeout(900); // let it bob + vent a wave
  await screenshotTo(page, 'z3-boss');
});
