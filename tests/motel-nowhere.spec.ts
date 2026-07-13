/**
 * ZONE 2 — MOTEL NOWHERE quest flow.
 * Proves the neon-power zone loads, Chip's fuse-box circuit routes back to the
 * MOTEL scene (not Miller Field), the dead wing powers, THE VACANCY SIGN goes
 * down, the second fragment banks, and Chip's SPARK Signal Set unlocks.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, tap, teleport, waitForScene, watchConsole } from './helpers';

/** drop straight into Motel Nowhere via the deterministic test hook */
async function startInMotel(page: import('@playwright/test').Page): Promise<void> {
  await bootToMenu(page);
  await api(page, "api.enterZone('motel-nowhere')");
  await waitForScene(page, 'MotelScene');
  // the how-to-play card appears ~650ms after entry; let it show, then close it
  await page.waitForTimeout(900);
  await api(page, 'api.dismissTransmission()');
  await page.waitForTimeout(400);
}

test.describe('Motel Nowhere — Zone 2', () => {
  test('circuit → wing → Vacancy Sign → fragment #2 → SPARK', async ({ page }) => {
    test.setTimeout(120_000);
    const watcher = watchConsole(page);
    await startInMotel(page);

    // landed in the right zone/quest
    expect(await api<string>(page, 'api.getSceneName()')).toBe('MotelScene');
    expect(await api<string>(page, 'api.getSaveData().currentZone')).toBe('motel-nowhere');

    // jack into Chip's fuse box → the top-down circuit Sweep room
    await api(page, "api.setQuestStep('findFuse')");
    await teleport(page, 'motelFuse');
    await tap(page, 'e');
    await waitForScene(page, 'SweepScene');

    // routing the circuit returns to MOTEL (not Miller Field) and lights the wing
    await api(page, 'api.completeBlipstreamPuzzle()');
    await waitForScene(page, 'MotelScene');
    await expect
      .poll(() => api<boolean>(page, 'api.getDebugFlags().motelWingPowered'), { timeout: 10_000 })
      .toBe(true);

    // THE VACANCY SIGN
    await api(page, "api.setQuestStep('bossFight')");
    await teleport(page, 'motelBoss');
    await api(page, 'api.spawnBoss()');
    await expect
      .poll(() => api(page, 'api.getBossState()?.state ?? "none"'), { timeout: 15_000 })
      .toBe('fighting');

    // scan exposes the filament (it also self-exposes on its stutter)
    await tap(page, 'q');
    await expect
      .poll(() => api<boolean>(page, 'api.getBossState()?.exposed ?? false'), { timeout: 8_000 })
      .toBe(true);

    // finish the fight (repetition is API-driven, like Zone 1)
    await api(page, 'api.damageBoss(99)');
    await expect
      .poll(() => api<boolean>(page, 'api.getDebugFlags().motelBossDefeated'), { timeout: 15_000 })
      .toBe(true);

    // second Signal Fragment banks
    await api(page, 'api.collectFragment()');
    await expect
      .poll(() => api<number>(page, 'api.getSaveData().signalFragments'), { timeout: 10_000 })
      .toBe(2);
    expect(await api<boolean>(page, 'api.getDebugFlags().motelFragmentCollected')).toBe(true);

    // Chip's Signal Set completes → SPARK unlocks
    await api(page, "api.completeSet('chip')");
    expect(await api<string[]>(page, 'api.getSkinState().unlocked')).toContain('chip');
    expect(await api<string[]>(page, 'api.getSaveData().completedZones')).toContain('motel-nowhere');

    expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
  });

  test('travel: finishing Miller Field opens the road to Motel Nowhere', async ({ page }) => {
    test.setTimeout(60_000);
    await bootToMenu(page);
    await api(page, "api.enterZone('miller-field')");
    await waitForScene(page, 'FieldScene');
    // let the how-to-play card show, then close it (it pauses the scene)
    await page.waitForTimeout(900);
    await api(page, 'api.dismissTransmission()');
    await page.waitForTimeout(300);
    // fast-forward Miller Field to complete, then walk east off the edge
    await api(page, "api.setQuestStep('complete')");
    await api(page, "api.teleportToCheckpoint('bossArena')");
    await page.keyboard.down('d');
    // the travel trigger flips currentZone synchronously (before the fade)
    await expect
      .poll(() => api<string>(page, 'api.getSaveData().currentZone'), { timeout: 30_000 })
      .toBe('motel-nowhere');
    await page.keyboard.up('d');
  });
});
