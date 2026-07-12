/**
 * PROGRESSION — the earn-loop (PROGRESSION_PLAN.md) + the ERD dev console.
 * Channel A: beating a zone's boss + collecting its Signal Fragment grants that
 * zone's signature ability, announced in the reward card and persisted.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, waitForScene } from './helpers';

test.describe('Progression — Channel A signature abilities', () => {
  test('Miller Field boss + fragment grants pulse-resonance (reward card + save)', async ({ page }) => {
    test.setTimeout(60_000);
    await bootToMenu(page);
    await api(page, "api.enterZone('miller-field')");
    await waitForScene(page, 'FieldScene');
    await page.waitForTimeout(900);
    await api(page, 'api.dismissTransmission()');

    expect(await api<string[]>(page, 'api.getSaveData().unlockedAbilities')).not.toContain('pulse-resonance');

    // beat the boss + collect the fragment (repetition is API-driven)
    await api(page, "api.setQuestStep('bossFight')");
    await api(page, "api.teleportToCheckpoint('bossArena')");
    await api(page, 'api.spawnBoss()');
    // the boss rises (~1.1s) before it can take damage
    await expect
      .poll(() => api(page, 'api.getBossState()?.state ?? "none"'), { timeout: 15_000 })
      .toBe('fighting');
    await api(page, 'api.damageBoss(99)');
    await expect
      .poll(() => api<boolean>(page, 'api.getDebugFlags().bossDefeated'), { timeout: 15_000 })
      .toBe(true);
    await api(page, 'api.collectFragment()');

    // the signature ability is now earned + announced
    await expect
      .poll(() => api<string[]>(page, 'api.getSaveData().unlockedAbilities'), { timeout: 10_000 })
      .toContain('pulse-resonance');
    const body = await page.locator('#transmission-body').textContent();
    expect(body).toContain('ABILITY UNLOCKED');
  });
});

test.describe('ERD dev console', () => {
  test('typing "erd" opens the panel; grant + warp work', async ({ page }) => {
    test.setTimeout(45_000);
    await bootToMenu(page);
    await page.keyboard.press('e');
    await page.keyboard.press('r');
    await page.keyboard.press('d');
    await expect(page.locator('#dev-panel')).toBeVisible();

    // grant all abilities
    await page.click('#dev-panel [data-act="abilities"]');
    expect((await api<string[]>(page, 'api.getSaveData().unlockedAbilities')).length).toBeGreaterThan(6);

    // warp straight into Zone 2
    await page.click('#dev-panel [data-zone="motel-nowhere"]');
    await waitForScene(page, 'MotelScene');
    expect(await api<string>(page, 'api.getSaveData().currentZone')).toBe('motel-nowhere');
  });
});
