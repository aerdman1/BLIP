/**
 * ECHO BLINK (PoP: Lost Crown return marker, BLIP decoy twist) — Cameron/ECHO's
 * scout-set ability: place a signal echo, snap back to it. Gated behind
 * hasAbility('echo-blink'); the echo expires on its own. (The decoy — scanners
 * read the echo, halving classification fill — is wired in FieldScene via
 * classify.update(..., isEchoActive ? 0.5 : 1) and covered by typecheck.)
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, startGame, teleport } from './helpers';

type PState = { x: number; y: number; echoActive: boolean; echoX: number; echoY: number };

test('place → move → blink snaps you back to the echo', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await api(page, `api.giveAbility('echo-blink')`);
  await teleport(page, 'highMeadow');
  await page.waitForTimeout(150);

  const p0 = await api<PState>(page, 'api.getPlayerState()');
  expect(p0.echoActive).toBe(false);

  await api(page, 'api.echoToggle()'); // place
  const placed = await api<PState>(page, 'api.getPlayerState()');
  expect(placed.echoActive).toBe(true);
  expect(Math.abs(placed.echoX - p0.x)).toBeLessThan(4);

  await teleport(page, 'drones'); // move far away — echo persists
  await page.waitForTimeout(150);
  const moved = await api<PState>(page, 'api.getPlayerState()');
  expect(moved.echoActive).toBe(true);
  expect(Math.abs(moved.x - moved.echoX)).toBeGreaterThan(100);

  await api(page, 'api.echoToggle()'); // blink back
  await page.waitForTimeout(120);
  const back = await api<PState>(page, 'api.getPlayerState()');
  expect(back.echoActive).toBe(false); // echo consumed
  expect(Math.abs(back.x - placed.echoX)).toBeLessThan(6); // returned to the echo spot
});

test('gated: toggling without the ability does nothing', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await api(page, 'api.echoToggle()');
  expect((await api<PState>(page, 'api.getPlayerState()')).echoActive).toBe(false);
});

test('the echo expires on its own (~5s)', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await api(page, `api.giveAbility('echo-blink')`);
  await api(page, 'api.echoToggle()');
  expect((await api<PState>(page, 'api.getPlayerState()')).echoActive).toBe(true);
  await page.waitForTimeout(5300);
  expect((await api<PState>(page, 'api.getPlayerState()')).echoActive).toBe(false);
});
