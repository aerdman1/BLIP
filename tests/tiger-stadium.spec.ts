/**
 * ZONE 3 — CHAGRIN FALLS HIGH quest flow.
 * Proves the Friday-night-lights stadium loads, the rec-pool dive flips into the
 * inverted underwater reflection node and surfaces (poolNodeSolved), THE WEATHER
 * BALLOON goes down, the third fragment banks + grants Ghost Protocol, and
 * Henry's ANCHOR Signal Set unlocks.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, waitForScene, watchConsole } from './helpers';

/** drop straight into Chagrin Falls High via the deterministic test hook */
async function startInStadium(page: import('@playwright/test').Page): Promise<void> {
  await bootToMenu(page);
  await api(page, "api.enterZone('tiger-stadium')");
  await waitForScene(page, 'StadiumScene');
  // the how-to-play card appears ~650ms after entry; let it show, then close it
  await page.waitForTimeout(900);
  await api(page, 'api.dismissTransmission()');
  await page.waitForTimeout(400);
}

test.describe('Chagrin Falls High — Zone 3', () => {
  test('pool dive → reflection node → Weather Balloon → fragment #3 → ANCHOR', async ({ page }) => {
    test.setTimeout(120_000);
    const watcher = watchConsole(page);
    await startInStadium(page);

    // landed in the right zone/quest
    expect(await api<string>(page, 'api.getSceneName()')).toBe('StadiumScene');
    expect(await api<string>(page, 'api.getSaveData().currentZone')).toBe('tiger-stadium');

    // dive through the rec pool → the underwater reflection node
    await api(page, "api.setQuestStep('poolDive')");
    expect(await api<boolean>(page, 'api.divePool()')).toBe(true);
    await waitForScene(page, 'UnderwaterScene');

    // routing the three sync nodes surfaces us back at the stadium + wakes the field
    await api(page, 'api.completeBlipstreamPuzzle()');
    await waitForScene(page, 'StadiumScene');
    await expect
      .poll(() => api<boolean>(page, 'api.getDebugFlags().poolNodeSolved'), { timeout: 10_000 })
      .toBe(true);

    // THE WEATHER BALLOON lifts off the fifty
    await api(page, "api.setQuestStep('bossFight')");
    await api(page, 'api.spawnBoss()');
    await expect
      .poll(() => api(page, 'api.getBossState()?.state ?? "none"'), { timeout: 15_000 })
      .toBe('fighting');

    // clear it (repetition is API-driven, like Zones 1–2; debugDamage force-exposes the valve)
    await api(page, 'api.damageBoss(99)');
    await expect
      .poll(() => api<boolean>(page, 'api.getDebugFlags().tigerBossDefeated'), { timeout: 15_000 })
      .toBe(true);

    // third Signal Fragment banks + grants the zone signature (Ghost Protocol)
    await api(page, 'api.collectFragment()');
    await expect
      .poll(() => api<number>(page, 'api.getSaveData().signalFragments'), { timeout: 10_000 })
      .toBe(3);
    expect(await api<boolean>(page, 'api.getDebugFlags().tigerFragmentCollected')).toBe(true);
    expect(await api<string[]>(page, 'api.getSaveData().unlockedAbilities')).toContain('ghost-protocol');
    expect(await api<string[]>(page, 'api.getSaveData().completedZones')).toContain('tiger-stadium');

    // Henry's Signal Set completes → ANCHOR unlocks
    await api(page, "api.completeSet('henry')");
    expect(await api<string[]>(page, 'api.getSkinState().unlocked')).toContain('henry');

    expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
  });

  test('travel: finishing Motel Nowhere opens the road to Chagrin Falls High', async ({ page }) => {
    test.setTimeout(60_000);
    await bootToMenu(page);
    await api(page, "api.enterZone('motel-nowhere')");
    await waitForScene(page, 'MotelScene');
    await page.waitForTimeout(900);
    await api(page, 'api.dismissTransmission()');
    await page.waitForTimeout(300);
    // mark Motel finished, then walk east off the edge
    await api(page, 'api.collectFragment()'); // banks fragment #2 + sets motelFragmentCollected
    await api(page, 'api.dismissTransmission()'); // close the reward card (it pauses the scene)
    await page.waitForTimeout(300);
    // teleport to the far east base, then drive right into the edge trigger
    await api(page, 'api.teleportTo(1460, 280)');
    await page.waitForTimeout(200);
    await page.keyboard.down('d');
    await expect
      .poll(() => api<string>(page, 'api.getSaveData().currentZone'), { timeout: 30_000 })
      .toBe('tiger-stadium');
    await page.keyboard.up('d');
  });
});
