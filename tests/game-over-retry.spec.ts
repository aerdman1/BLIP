import { test, expect } from '@playwright/test';
import { api, bootToMenu, waitForScene } from './helpers';

test('game over continue from top-down restarts the same Sweep arena', async ({ page }) => {
  await bootToMenu(page);

  expect(await api<boolean>(page, `api.enterSweep('surface-z1')`)).toBe(true);
  await waitForScene(page, 'SweepScene');
  expect(await api(page, 'api.getSweepState()')).not.toBeNull();

  expect(await api<boolean>(page, 'api.killSweepPlayer()')).toBe(true);
  await waitForScene(page, 'GameOverScene');

  await page.keyboard.press('Enter');
  await waitForScene(page, 'SweepScene');
  expect(await api(page, 'api.getSweepState()')).not.toBeNull();
  expect(await api<string>(page, 'api.getSceneName()')).toBe('SweepScene');
});
