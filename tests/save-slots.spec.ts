/**
 * SAVE SLOTS — 3 independent slots, slot-picker menu, per-slot erase, and the
 * contextual top-bar RESET (hidden on the menu, shown during a run).
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu } from './helpers';

async function waitScene(page: import('@playwright/test').Page, name: string) {
  await page.waitForFunction(
    (n) => (window as never as { __BLIP_TEST_API__: { getSceneName: () => string } }).__BLIP_TEST_API__.getSceneName() === n,
    name,
    { timeout: 15_000 }
  );
}

test('fresh boot shows three empty slots and hides the top-bar reset', async ({ page }) => {
  await bootToMenu(page);
  await expect(page.locator('.menu-item.slot')).toHaveCount(3);
  await expect(page.locator('.menu-item.slot.empty')).toHaveCount(3);
  await expect(page.locator('#menu-slot-0')).toContainText('NEW GAME');
  await expect(page.locator('#btn-reset')).toBeHidden(); // nothing to reset from the menu
});

test('slots are independent; playing one leaves the others empty', async ({ page }) => {
  await bootToMenu(page);
  // play slot 2 (index 1)
  await page.click('#menu-slot-1');
  await waitScene(page, 'FieldScene');
  await expect(page.locator('#btn-reset')).toBeVisible(); // reset the active run in-game
  expect(await page.evaluate(() => Number(localStorage.getItem('blip_active_slot')))).toBe(1);
  await api(page, `api.setQuestStep('reachDoor')`);
  await api(page, 'api.collectFragment()');
  await api(page, 'api.dismissTransmission()');

  // back to the menu — slot 2 now occupied, slots 1 & 3 still empty
  await page.evaluate(() => (window as never as { __BLIP_TEST_API__: { getSceneName: () => string } }).__BLIP_TEST_API__);
  await page.keyboard.press('Escape');
  await page.click('#pause-main-menu');
  await waitScene(page, 'MainMenuScene');
  await expect(page.locator('#menu-slot-1')).toContainText('CONTINUE');
  await expect(page.locator('#menu-slot-1')).toContainText('MILLER FIELD');
  await expect(page.locator('#menu-slot-0')).toContainText('NEW GAME');
  await expect(page.locator('#menu-slot-2')).toContainText('NEW GAME');
  // the occupied slot's save is real
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('blip_save_v1_slot1') ?? '{}'));
  expect(s.signalFragments).toBe(1);
  // slot 0's key was never created
  expect(await page.evaluate(() => localStorage.getItem('blip_save_v1'))).toBeNull();
});

test('erasing an occupied slot returns it to empty', async ({ page }) => {
  await bootToMenu(page);
  await page.click('#menu-slot-0');
  await waitScene(page, 'FieldScene');
  await api(page, 'api.collectFragment()');
  await api(page, 'api.dismissTransmission()');
  await page.keyboard.press('Escape');
  await page.click('#pause-main-menu');
  await waitScene(page, 'MainMenuScene');
  await expect(page.locator('#menu-slot-0')).toContainText('CONTINUE');

  page.on('dialog', (d) => void d.accept());
  await page.locator('#menu-slot-0 .mi-erase').click();
  await expect(page.locator('#menu-slot-0')).toContainText('NEW GAME');
  expect(await page.evaluate(() => localStorage.getItem('blip_save_v1'))).toBeNull();
});
