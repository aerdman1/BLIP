import { test, expect } from '@playwright/test';
import { api, bootToMenu, waitForScene } from './helpers';

test('game over continue from top-down restarts the same Sweep arena', async ({ page }) => {
  await bootToMenu(page);

  expect(await api<boolean>(page, `api.enterSweep('surface-z1')`)).toBe(true);
  await waitForScene(page, 'SweepScene');
  expect(await api(page, 'api.getSweepState()')).not.toBeNull();
  await expect(page.locator('#sweep-hud-dom')).toBeVisible();
  // top-down HUD was rebuilt in the visual overhaul: `.sweep-hud-objective` →
  // `.td-objective-title` (the #sweep-hud-dom id is deliberately unchanged).
  await expect(page.locator('#sweep-hud-dom .td-objective-title')).toContainText(/CHARGE|WAVE|BREACH/);
  const cam = await api<{ zoom: number; worldView: { width: number; height: number } }>(page, 'api.getCameraState()');
  // The real invariant is FRAMING: the top-down camera shows more world than the
  // 480px base view. `zoom < 1` used to imply that, but the visual overhaul
  // raises the backbuffer and multiplies zoom by the same density (so zoom is
  // now ~2.46 while the visible world region is unchanged). Assert the framing
  // directly instead of the proxy.
  expect(cam.worldView.width, 'pulled-back top-down camera should show more than base 480px width').toBeGreaterThan(480);
  const td = await api<{ bufferW: number }>(page, 'api.getTdVisualState()');
  expect(cam.zoom, 'camera zoom must track the backbuffer density').toBeCloseTo((td.bufferW / 480) * 0.82, 2);

  expect(await api<boolean>(page, 'api.killSweepPlayer()')).toBe(true);
  await waitForScene(page, 'GameOverScene');
  await expect(page.locator('#game-over-dom')).toBeVisible();
  await expect(page.locator('#game-over-dom .go-title')).toContainText('CONNECTION LOST');

  await page.keyboard.press('Enter');
  await waitForScene(page, 'SweepScene');
  expect(await api(page, 'api.getSweepState()')).not.toBeNull();
  expect(await api<string>(page, 'api.getSceneName()')).toBe('SweepScene');
});
