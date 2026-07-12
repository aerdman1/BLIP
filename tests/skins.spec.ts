/**
 * SIGNAL SKINS — wardrobe, set-completion unlock + Scout Echo, live equip,
 * and stat-mod application. Drives the real unlock path via the Test API.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, playerState, startGame } from './helpers';

test('wardrobe: all skins listed, scout skins locked until unlocked', async ({ page }) => {
  await bootToMenu(page);
  await page.keyboard.press('c');
  await page.locator('.cc-nav a[data-target="cc-wardrobe"]').click();
  await expect(page.locator('#cc-wardrobe-grid')).toContainText('CONTACT-47');
  for (const name of ['WILLOW', 'SPARK', 'ANCHOR', 'ECHO', 'ROCKET']) {
    await expect(page.locator('#cc-wardrobe-grid')).toContainText(name);
  }
  // contact47 equipped, five scout skins locked
  await expect(page.locator('#cc-wardrobe-grid .cc-card.skin.locked')).toHaveCount(5);
  await expect(page.locator('#cc-skin-current')).toHaveText('CONTACT-47');
});

test('completing a Signal Set unlocks the skin + fires a Scout Echo', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  expect(await api(page, `api.getSkinState().unlocked`)).toEqual(['contact47']);

  const unlocked = await api<boolean>(page, `api.completeSet('will')`);
  expect(unlocked).toBe(true);
  expect(await api(page, `api.getSkinState().unlocked`)).toContain('will');
  // the echo fires a transmission
  await expect(page.locator('#transmission-modal')).toBeVisible();
  await expect(page.locator('#transmission-title')).toContainText('WILLOW UNLOCKED');
  await api(page, 'api.dismissTransmission()');
});

test('equipping a skin recolors the unit badge and applies stat mods live', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await api(page, 'api.unlockAllSkins()');

  // ROCKET: -1 max hull → hp clamps to 4 on equip
  await api(page, `api.selectSkin('danny')`);
  await page.waitForTimeout(200);
  expect((await playerState(page)).hp).toBe(4);
  await expect(page.locator('#unit-badge .badge-text')).toContainText('ROCKET');

  // back to baseline
  await api(page, `api.selectSkin('contact47')`);
  await expect(page.locator('#unit-badge .badge-text')).toContainText('CONTACT-47');
});

test('selected skin persists across reload', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await api(page, 'api.unlockAllSkins()');
  await api(page, `api.selectSkin('henry')`);
  await page.reload();
  await page.waitForFunction(() => !!(window as never as Record<string, unknown>).__BLIP_TEST_API__);
  expect(await api(page, 'api.getSaveData().selectedSkin')).toBe('henry');
});
