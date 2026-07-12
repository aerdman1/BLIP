/**
 * SIGNAL PORTRAITS — collectible cards. Completing a scout's Signal Set earns
 * that scout's portrait (save), and the Command Center gallery flips the card
 * from locked ("UNKNOWN SCOUT") to RECOVERED. The painted art itself is a manual
 * asset (public/assets/portraits/*.png); these tests cover the earn + gallery
 * logic, which works with or without the art present.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, startGame } from './helpers';

test('completing a Signal Set earns that scout’s Signal Portrait (save)', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  expect(await api<string[]>(page, 'api.getSaveData().earnedPortraits')).toEqual([]);

  const unlocked = await api<boolean>(page, `api.completeSet('will')`);
  expect(unlocked).toBe(true);
  expect(await api<string[]>(page, 'api.getSaveData().earnedPortraits')).toContain('will');
  await api(page, 'api.dismissTransmission()');
});

test('earned portrait persists across reload', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await api(page, `api.completeSet('will')`);
  await api(page, 'api.dismissTransmission()');
  await page.reload();
  await page.waitForFunction(() => !!(window as never as Record<string, unknown>).__BLIP_TEST_API__);
  expect(await api<string[]>(page, 'api.getSaveData().earnedPortraits')).toContain('will');
});

test('Signal Portraits gallery: 5 locked, flips to RECOVERED on earn', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);

  await api(page, 'api.openCommandCenter()');
  await expect(page.locator('#cc-portraits-count')).toContainText('0 / 5 RECOVERED');
  await expect(page.locator('#cc-portraits-grid .cc-card.portrait.unknown')).toHaveCount(5);
  await api(page, 'api.closeCommandCenter()');

  await api(page, `api.completeSet('will')`);
  await api(page, 'api.dismissTransmission()');

  await api(page, 'api.openCommandCenter()');
  await expect(page.locator('#cc-portraits-count')).toContainText('1 / 5 RECOVERED');
  await expect(page.locator('#cc-portraits-grid')).toContainText('WILL / WILLOW');
  await expect(page.locator('#cc-portraits-grid .cc-card.portrait.unknown')).toHaveCount(4);
});
