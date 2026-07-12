/**
 * Atmosphere capture — screenshots every zone's overworld with the new
 * depth-graded realistic backgrounds, for review.
 */
import { test } from '@playwright/test';
import { api, bootToMenu, screenshotTo, waitForScene } from './helpers';

async function enter(page: import('@playwright/test').Page, zone: string, scene: string): Promise<void> {
  await api(page, `api.enterZone('${zone}')`);
  await waitForScene(page, scene);
  await page.waitForTimeout(1000);
  await api(page, 'api.dismissTransmission()');
  await page.waitForTimeout(600);
}

test('capture zone atmospheres', async ({ page }) => {
  test.setTimeout(120_000);
  await bootToMenu(page);

  await enter(page, 'miller-field', 'FieldScene');
  await api(page, "api.teleportToCheckpoint('highMeadow')");
  await page.waitForTimeout(600);
  await screenshotTo(page, 'atmo-miller');

  await enter(page, 'motel-nowhere', 'MotelScene');
  await api(page, "api.teleportToCheckpoint('motelLot')");
  await page.waitForTimeout(600);
  await screenshotTo(page, 'atmo-motel');

  await enter(page, 'tiger-stadium', 'StadiumScene');
  await api(page, 'api.teleportTo(560, 470)');
  await page.waitForTimeout(600);
  await screenshotTo(page, 'atmo-stadium');

  await api(page, 'api.divePool()');
  await waitForScene(page, 'UnderwaterScene');
  await page.waitForTimeout(900);
  await screenshotTo(page, 'atmo-underwater');
});
