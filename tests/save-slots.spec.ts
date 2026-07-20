/**
 * SAVE SLOTS — 3 independent slots, slot-picker menu, per-slot erase.
 *
 * The picker uses PROGRESSIVE DISCLOSURE (ShellUI.buildMenuEntries, b1d7ef9):
 * it lists every OCCUPIED slot plus the NEXT empty one — so a fresh boot shows
 * exactly one "NEW GAME" entry, not three. The underlying slot system is still
 * 3 independent slots; only the menu presentation is progressive.
 * (RESET SAVE now lives in the pause menu, not a contextual top-bar button.)
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

test('fresh boot shows a single empty slot (progressive disclosure)', async ({ page }) => {
  await bootToMenu(page);
  await expect(page.locator('.menu-item.slot')).toHaveCount(1);
  await expect(page.locator('.menu-item.slot.empty')).toHaveCount(1);
  await expect(page.locator('#menu-slot-0')).toContainText('NEW GAME');
  // slots 1 and 2 are not offered until slot 0 is in use
  await expect(page.locator('#menu-slot-1')).toHaveCount(0);
});

test('slots are independent; playing one leaves the others empty', async ({ page }) => {
  await bootToMenu(page);
  // Only slot 0 is offered on a fresh boot, so occupy it first; slot 1 then
  // becomes the next-empty entry and can be played independently.
  await page.click('#menu-slot-0');
  await waitScene(page, 'SweepScene');
  await page.keyboard.press('Escape');
  await page.click('#pause-main-menu');
  await waitScene(page, 'MainMenuScene');
  await expect(page.locator('#menu-slot-1')).toBeVisible();
  // play slot 2 (index 1)
  await page.click('#menu-slot-1');
  await waitScene(page, 'SweepScene');
  expect(await page.evaluate(() => Number(localStorage.getItem('blip_active_slot')))).toBe(1);
  await api(page, `api.enterZone('miller-field')`);
  await waitScene(page, 'FieldScene');
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
  // slot 2 is now the next-empty entry
  await expect(page.locator('#menu-slot-2')).toContainText('NEW GAME');
  // the occupied slot's save is real and separate from slot 0's
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('blip_save_v1_slot1') ?? '{}'));
  expect(s.signalFragments).toBe(1);
  const s0 = await page.evaluate(() => JSON.parse(localStorage.getItem('blip_save_v1') ?? '{}'));
  expect(s0.signalFragments ?? 0).toBe(0);
});

test('erasing an occupied slot returns it to empty', async ({ page }) => {
  await bootToMenu(page);
  await page.click('#menu-slot-0');
  await waitScene(page, 'SweepScene');
  await api(page, `api.enterZone('miller-field')`);
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

test('refreshing after new game continues the unfinished cold-open Sweep', async ({ page }) => {
  await bootToMenu(page);
  await page.click('#menu-slot-0');
  await waitScene(page, 'SweepScene');

  await page.reload();
  await waitScene(page, 'MainMenuScene');
  await expect(page.locator('#menu-slot-0')).toContainText('CONTINUE');
  await page.click('#menu-slot-0');
  await waitScene(page, 'SweepScene');
  expect(await api<string>(page, 'api.getSceneName()')).toBe('SweepScene');
  await expect(page.locator('#sweep-hud-dom')).toBeVisible();
  // top-down HUD was rebuilt in the visual overhaul: `.sweep-hud-objective` →
  // `.td-objective-title` (the #sweep-hud-dom id is deliberately unchanged).
  await expect(page.locator('#sweep-hud-dom .td-objective-title')).toContainText(/CHARGE|WAVE|BREACH/);
});
