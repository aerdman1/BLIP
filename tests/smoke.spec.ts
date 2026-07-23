/**
 * SMOKE — app loads, no console errors, canvas exists, menu appears,
 * game starts, Command Center opens, route warps work.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, playerState, startGame, watchConsole } from './helpers';

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
  const startState = await api(page, 'api.getSweepRuntimeState()');
  expect(startState.breachOpen).toBe(false);
  expect(startState.chargeTarget).toBeGreaterThanOrEqual(50);
  expect(startState.objectiveActionsRequired).toBeGreaterThanOrEqual(2);
  expect(startState.enemiesActive).toBeGreaterThan(0);
  await page.keyboard.press('2');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSweepRuntimeState().weaponId === 'arc');
  await page.keyboard.press('3');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSweepRuntimeState().weaponId === 'disc');
  await page.keyboard.press('R');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSweepRuntimeState().weaponId === 'pulse');
  await api(page, `api.setSweepWeapon('arc')`);
  await api(page, 'api.damageSweepPlayer(2)');
  expect(await api(page, 'api.getSweepRuntimeState().weaponId')).toBe('arc');
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBeGreaterThanOrEqual(1);
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBeLessThanOrEqual(3);

  await api(page, 'api.completeRoute()');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSaveData().currentZone === 'motel-nowhere');
  expect(await api(page, `api.getSceneName()`)).toBe('SweepScene');
  expect(await api(page, 'api.getSaveData().purchasedUpgrades')).toContain('pulse-resonance');
  expect(await api(page, 'api.getSweepRuntimeState().weaponId')).toBe('arc');
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBeGreaterThanOrEqual(1);
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBeLessThanOrEqual(3);

  await api(page, 'api.completeRoute()');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSaveData().currentZone === 'tiger-stadium');
  expect(await api(page, `api.getSceneName()`)).toBe('SweepScene');
  expect(await api(page, 'api.getSweepRuntimeState().weaponId')).toBe('arc');
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBeGreaterThanOrEqual(1);
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBeLessThanOrEqual(3);

  await api(page, 'api.completeRoute()');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSaveData().currentZone === 'pattersons-orchard');
  expect(await api(page, `api.getSceneName()`)).toBe('SweepScene');
  expect(await api(page, 'api.getSweepRuntimeState().weaponId')).toBe('arc');
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBeGreaterThanOrEqual(1);
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBeLessThanOrEqual(3);

  await api(page, 'api.completeRoute()');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSaveData().currentZone === 'skyline-array');
  expect(await api(page, `api.getSceneName()`)).toBe('SweepScene');
  expect(await api(page, 'api.getSweepRuntimeState().weaponId')).toBe('arc');
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBeGreaterThanOrEqual(1);
  expect(await api(page, 'api.getSweepRuntimeState().hp')).toBeLessThanOrEqual(3);
  const saveAfterRoute = await api(page, 'api.getSaveData()');
  expect(saveAfterRoute.purchasedUpgrades).toEqual(expect.arrayContaining(['pulse-resonance', 'emp-burst', 'ghost-protocol', 'pulse-ricochet']));
  expect(saveAfterRoute.rewards.awarded).not.toContain('milestone:sweep-first');
  expect(saveAfterRoute.rewards.owned).not.toEqual(expect.arrayContaining(['medal-bronze', 'medal-silver', 'medal-gold']));
});

test('Motel Circuit communicates scanner stealth and River Road exit guidance', async ({ page }) => {
  await bootToMenu(page);
  await api(page, `api.enterSweep('circuit-z2')`);
  expect(await api(page, `api.getSceneName()`)).toBe('SweepScene');
  const runtime = await api(page, 'api.getSweepRuntimeState()');
  expect(runtime.motelScanners.total).toBeGreaterThanOrEqual(4);
  expect(runtime.objectiveActionsRequired).toBeLessThanOrEqual(runtime.motelScanners.total);

  const before = await api(page, 'api.getAiPerception()');
  expect(before.objective.title).toContain('scanner');
  expect(before.objective.hint).toContain('Boost');
  expect(before.visible.scanners.length).toBeGreaterThan(0);
  expect(before.visible.scanners.every((scanner: { label: string }) => /SCANNER$/.test(scanner.label))).toBe(true);
  expect(before.visible.scanners.map((scanner: { label: string }) => scanner.label).join(' ')).not.toMatch(/gate|motel circuit/i);
  expect(before.objectiveHint.kind).toBe('route-beacon');
  expect(before.objectiveHint.label).not.toMatch(/gate|motel circuit/i);

  expect(await api(page, 'api.openRouteForInspection()')).toBe(true);
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSweepRuntimeState().breachOpen === true);
  const after = await api(page, 'api.getAiPerception()');
  expect(after.objective.title).toBe('Route open');
  expect(after.objective.hint).toContain('River Road');
  expect(after.objectiveHint.kind).toBe('route-beacon');
  expect(after.visible.scanners).toHaveLength(0);
});

test('hold boost drains and regenerates the movement meter', async ({ page }) => {
  await bootToMenu(page);
  await api(page, `api.enterSweep('surface-z1')`);
  await expect(page.locator('#sweep-hud-dom .td-boost')).toBeVisible();
  await expect(page.locator('#sweep-hud-dom .td-boost')).toContainText('BOOST');
  await expect(page.locator('#sweep-hud-dom .td-boost')).toContainText('FULL');
  const start = await playerState(page);
  expect(start.energy).toBeGreaterThanOrEqual(95);
  await api(page, `api.driveAi({ moveX: 1, moveY: 0, aimX: 1, aimY: 0, dashHeld: true })`);
  await page.waitForTimeout(700);
  const drained = await playerState(page);
  expect(drained.x).toBeGreaterThan(start.x + 50);
  expect(drained.energy).toBeLessThan(start.energy);
  expect(await api(page, 'api.getSweepRuntimeState().hoverTrailCount')).toBeGreaterThan(0);
  await expect(page.locator('#sweep-hud-dom .td-boost')).not.toContainText('FULL');
  await api(page, 'api.stopAi()');
  await page.waitForTimeout(1300);
  const recovered = await playerState(page);
  expect(recovered.energy).toBeGreaterThan(drained.energy);
});

test('Miller boost washout blocks walking but allows held boost crossing', async ({ page }) => {
  await bootToMenu(page);
  await api(page, `api.enterSweep('surface-z1')`);
  expect(await api(page, 'api.getSweepRuntimeState().boostGaps')).toBeGreaterThanOrEqual(2);

  const leftOfWashout = { x: 48.5 * 32, y: 45 * 32 };
  await api(page, `api.setPlayerWorldPosition(${leftOfWashout.x}, ${leftOfWashout.y})`);
  await api(page, `api.driveAi({ moveX: 1, moveY: 0, aimX: 1, aimY: 0 })`);
  await page.waitForTimeout(650);
  await api(page, 'api.stopAi()');
  const blocked = await playerState(page);
  expect(blocked.x).toBeLessThan(52 * 32);

  await api(page, `api.setPlayerWorldPosition(${leftOfWashout.x}, ${leftOfWashout.y})`);
  await api(page, `api.driveAi({ moveX: 1, moveY: 0, aimX: 1, aimY: 0, dashHeld: true })`);
  await page.waitForTimeout(900);
  await api(page, 'api.stopAi()');
  const crossed = await playerState(page);
  expect(crossed.x).toBeGreaterThan(54 * 32);
});

test('screen filter setting applies to the top-down world camera', async ({ page }) => {
  await bootToMenu(page);
  await api(page, `api.enterSweep('surface-z1')`);
  expect(await api(page, `api.setScreenFilterIntensity(0.5)`)).toBe(true);
  expect(await api(page, `api.setScreenFilter('nightvision')`)).toBe(true);
  await page.waitForTimeout(150);
  const filtered = await api(page, 'api.getScreenFilterState()');
  expect(filtered.scene).toBe('SweepScene');
  expect(filtered.filter).toBe('nightvision');
  expect(filtered.filterIntensity).toBeCloseTo(0.5, 2);
  if (filtered.webgl) {
    expect(filtered.postPipelineCount).toBeGreaterThan(0);
    expect(filtered.strength).toBeGreaterThan(0.2);
    expect(filtered.strength).toBeLessThan(0.3);
  }

  expect(await api(page, `api.setScreenFilterIntensity(1)`)).toBe(true);
  await page.waitForTimeout(150);
  const full = await api(page, 'api.getScreenFilterState()');
  if (full.webgl) expect(full.strength).toBeGreaterThan(filtered.strength);

  expect(await api(page, `api.setScreenFilter('none')`)).toBe(true);
  await page.waitForTimeout(150);
  const cleared = await api(page, 'api.getScreenFilterState()');
  expect(cleared.filter).toBe('none');
  if (cleared.webgl) expect(cleared.postPipelineCount).toBe(0);
});

test('Chagrin Falls Town spawn does not apply invisible immediate damage', async ({ page }) => {
  await bootToMenu(page);
  await api(page, `api.enterSweep('town-z3')`);
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSceneName() === 'SweepScene');
  const start = await api(page, 'api.getSweepRuntimeState()');
  expect(start.hp).toBe(start.maxHp);
  await page.waitForTimeout(1250);
  const afterGraceWindow = await api(page, 'api.getSweepRuntimeState()');
  expect(afterGraceWindow.hp).toBe(afterGraceWindow.maxHp);
  expect(await api(page, 'api.getSceneName()')).toBe('SweepScene');
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
