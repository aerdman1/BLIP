/**
 * SCAN-SECRETS + SCOUT FIELD NOTES (Animal Well + Tunic) — scanning near a hidden
 * spot claims it: a shard cache pays Signal Shards (once), a note spot recovers a
 * Scout Field Note that renders in the Command Center ▸ FIELD NOTES gallery.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, startGame, teleport } from './helpers';

test('shard cache: scanning it pays Signal Shards exactly once', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  const before = await api<number>(page, 'api.getSaveData().shards');

  await teleport(page, 'drones');
  await page.waitForTimeout(150);
  await api(page, 'api.scan()');

  const after = await api<number>(page, 'api.getSaveData().shards');
  expect(after).toBe(before + 15);
  expect(await api<string[]>(page, 'api.getSaveData().foundSecrets')).toContain('miller-cache-1');

  // re-scanning the claimed cache does not double-pay
  await api(page, 'api.scan()');
  expect(await api<number>(page, 'api.getSaveData().shards')).toBe(after);
});

test('field note: scanning its spot recovers it + it renders in the Command Center', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);

  await teleport(page, 'highMeadow');
  await page.waitForTimeout(150);
  await api(page, 'api.scan()');

  expect(await api<string[]>(page, 'api.getSaveData().discoveredFieldNotes')).toContain('will-map-margin');
  // recovering a note opens the transmission modal
  await expect(page.locator('#transmission-modal')).toBeVisible();
  await api(page, 'api.dismissTransmission()');

  // Command Center FIELD NOTES gallery shows the recovered page
  await api(page, 'api.openCommandCenter()');
  await expect(page.locator('#cc-fieldnotes-count')).toContainText('1 / 4 RECOVERED');
  await expect(page.locator('#cc-fieldnotes-grid')).toContainText("Will's map margin");
});
