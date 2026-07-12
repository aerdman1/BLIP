/**
 * SCAN-STUN (Dead Cells double-duty verbs) — a scan pulse is not just recon; any
 * scanner drone caught inside the pulse freezes for ~1.5s (halt + no fire + tint).
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, startGame, teleport } from './helpers';

test('scanning freezes every drone within scan radius', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await teleport(page, 'drones');
  await page.waitForTimeout(200);

  const p = await api<{ x: number; y: number }>(page, 'api.getPlayerState()');
  const before = await api<Array<{ x: number; y: number; stunned: boolean }>>(page, 'api.getDroneStates()');
  expect(before.length).toBeGreaterThan(0);
  expect(before.some((d) => d.stunned)).toBe(false);

  await api(page, 'api.scan()');
  const after = await api<Array<{ x: number; y: number; stunned: boolean }>>(page, 'api.getDroneStates()');

  const R = 150; // base contact47 scan radius (config SCAN.radius)
  const inRange = after.filter((d) => Math.hypot(d.x - p.x, d.y - p.y) <= R);
  expect(inRange.length, 'the drones checkpoint has a drone within scan radius').toBeGreaterThan(0);
  expect(inRange.every((d) => d.stunned)).toBe(true);
});
