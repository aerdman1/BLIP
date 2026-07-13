/**
 * SMOKE — app loads, no console errors, canvas exists, menu appears,
 * game starts, Command Center opens, reset save works.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, startGame, watchConsole } from './helpers';

test('boots to the main menu without console errors', async ({ page }) => {
  const watcher = watchConsole(page);
  await bootToMenu(page);
  expect(await page.title()).toContain('BLIP');
  await expect(page.locator('#game-root canvas')).toHaveCount(1);
  expect(await api(page, `api.getSceneName()`)).toBe('MainMenuScene');
  expect(watcher.errors, `console errors: ${watcher.errors.join(' | ')}`).toHaveLength(0);
});

test('play button path: menu → FieldScene', async ({ page }) => {
  const watcher = watchConsole(page);
  await bootToMenu(page);
  await startGame(page);
  expect(await api(page, `api.getSceneName()`)).toBe('FieldScene');
  const p = await api(page, 'api.getPlayerState()');
  expect(p).not.toBeNull();
  expect(p.hp).toBeGreaterThan(0);
  expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
});

test('command center opens from the pause menu and closes', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  // player-ready HUD: the dev shortcut button is hidden unless god mode is on
  await expect(page.locator('#btn-command-center')).toBeHidden();
  // players reach the Command Center from the pause menu
  await page.keyboard.press('Escape');
  await page.click('#pause-command-center');
  await expect(page.locator('#command-center')).toBeVisible();
  await expect(page.locator('#command-center')).toContainText('COMMAND CENTER');
  await expect(page.locator('#command-center')).toContainText('THE FIVE SIGNAL SCOUTS');
  await page.click('#cc-close');
  await expect(page.locator('#command-center')).toBeHidden();
});

test('reset save from the pause menu clears progress', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await api(page, `api.setQuestStep('reachDoor')`);
  expect(await api(page, 'api.getSaveData().questStep')).toBe('reachDoor');
  page.on('dialog', (d) => void d.accept());
  // RESET SAVE now lives in the pause menu (removed from the player-facing top bar)
  await page.keyboard.press('Escape');
  await page.click('#pause-reset');
  await page.waitForLoadState('load');
  await page.waitForFunction(() => !!(window as never as Record<string, unknown>).__BLIP_TEST_API__);
  const step = await api(page, 'api.getSaveData().questStep');
  expect(step).toBe('wake');
});
