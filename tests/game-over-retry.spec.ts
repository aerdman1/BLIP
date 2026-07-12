import { test, expect } from '@playwright/test';
import { api, bootToMenu, waitForScene } from './helpers';

test('game over continue from top-down restarts the same Sweep arena', async ({ page }) => {
  await bootToMenu(page);

  expect(await api<boolean>(page, `api.enterSweep('surface-z1')`)).toBe(true);
  await waitForScene(page, 'SweepScene');
  expect(await api(page, 'api.getSweepState()')).not.toBeNull();
  await expect(page.locator('#sweep-hud-dom')).toBeVisible();
  await expect(page.locator('.sweep-hud-objective')).toContainText(/CHARGE|WAVE|BREACH/);
  const cam = await api<{ zoom: number; worldView: { width: number; height: number } }>(page, 'api.getCameraState()');
  expect(cam.zoom, 'top-down camera should be pulled back below 1x').toBeLessThan(1);
  expect(cam.worldView.width, 'pulled-back top-down camera should show more than base 480px width').toBeGreaterThan(480);

  expect(await api<boolean>(page, 'api.killSweepPlayer()')).toBe(true);
  await waitForScene(page, 'GameOverScene');
  await expect(page.locator('#game-over-dom')).toBeVisible();
  await expect(page.locator('#game-over-dom .go-title')).toContainText('CONNECTION LOST');

  await page.keyboard.press('Enter');
  await waitForScene(page, 'SweepScene');
  expect(await api(page, 'api.getSweepState()')).not.toBeNull();
  expect(await api<string>(page, 'api.getSceneName()')).toBe('SweepScene');
});
