/**
 * SMOKE — app loads, no console errors, canvas exists, menu appears,
 * game starts, Command Center opens, route warps work.
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

test('play button path: menu → top-down SweepScene', async ({ page }) => {
  const watcher = watchConsole(page);
  await bootToMenu(page);
  await startGame(page);
  expect(await api(page, `api.getSceneName()`)).toBe('SweepScene');
  const p = await api(page, 'api.getPlayerState()');
  expect(p).not.toBeNull();
  expect(p.hp).toBeGreaterThan(0);
  expect(await api(page, 'api.getSaveData().currentZone')).toBe('miller-field');
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

test('top-down route transitions preserve SweepScene and advance save zone', async ({ page }) => {
  await bootToMenu(page);
  await api(page, `api.enterSweep('surface-z1')`);
  expect(await api(page, `api.getSceneName()`)).toBe('SweepScene');
  expect(await api(page, 'api.getSaveData().currentZone')).toBe('miller-field');
  await page.keyboard.press('2');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSweepRuntimeState().weaponId === 'arc');
  await page.keyboard.press('3');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSweepRuntimeState().weaponId === 'disc');
  await page.keyboard.press('R');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSweepRuntimeState().weaponId === 'pulse');
  await api(page, `api.setSweepWeapon('arc')`);
  await api(page, 'api.damageSweepPlayer(2)');
  expect(await api(page, 'api.getSweepRuntimeState().weaponId')).toBe('arc');
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBe(3);

  await api(page, 'api.completeRoute()');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSaveData().currentZone === 'motel-nowhere');
  expect(await api(page, `api.getSceneName()`)).toBe('SweepScene');
  expect(await api(page, 'api.getSweepRuntimeState().weaponId')).toBe('arc');
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBe(3);

  await api(page, 'api.completeRoute()');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSaveData().currentZone === 'tiger-stadium');
  expect(await api(page, `api.getSceneName()`)).toBe('SweepScene');
  expect(await api(page, 'api.getSweepRuntimeState().weaponId')).toBe('arc');
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBe(3);

  await api(page, 'api.completeRoute()');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSaveData().currentZone === 'pattersons-orchard');
  expect(await api(page, `api.getSceneName()`)).toBe('SweepScene');
  expect(await api(page, 'api.getSweepRuntimeState().weaponId')).toBe('arc');
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBe(3);

  await api(page, 'api.completeRoute()');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSaveData().currentZone === 'skyline-array');
  expect(await api(page, `api.getSceneName()`)).toBe('SweepScene');
  expect(await api(page, 'api.getSweepRuntimeState().weaponId')).toBe('arc');
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBe(3);
});

test('quit to menu preserves autosave and dev warp buttons jump regions', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await api(page, `api.enterZone('motel-nowhere')`);
  expect(await api(page, 'api.getSaveData().currentZone')).toBe('motel-nowhere');
  page.on('dialog', (d) => void d.accept());
  await page.keyboard.press('Escape');
  await page.click('#pause-quit-menu');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSceneName() === 'MainMenuScene');
  expect(await api(page, 'api.getSaveData().currentZone')).toBe('motel-nowhere');
  await page.click('#menu-warp-pattersons-orchard');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSceneName() === 'SweepScene');
  expect(await api(page, 'api.getSaveData().currentZone')).toBe('pattersons-orchard');
});
