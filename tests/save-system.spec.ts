/**
 * SAVE SYSTEM — persistence across reload, continue flow, legacy
 * beamline_save_v1 → blip_save_v1 migration, clean state after reset.
 */
import { expect, test } from '@playwright/test';
import { api, bootKeepingSave, bootToMenu, startGame } from './helpers';

test('progress persists across a full page reload', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await api(page, `api.giveScoutBadge('will', 'will-log-1')`);
  await api(page, `api.setQuestStep('enterNode')`);
  await api(page, 'api.collectFragment()');
  await api(page, 'api.dismissTransmission()');

  await bootKeepingSave(page); // reload without clearing storage
  const save = await api(page, 'api.getSaveData()');
  expect(save.signalFragments).toBe(1);
  expect(save.discoveredScoutBadges).toContain('will');
  expect(save.discoveredScoutLogs).toContain('will-log-1');
  expect(save.flags.firstFragmentCollected).toBe(true);

  // continue restores world state (door stays open if flagged)
  await api(page, 'api.startGame(true)');
  await page.waitForTimeout(1200);
  const save2 = await api(page, 'api.getSaveData()');
  expect(save2.signalFragments).toBe(1);
});

test('legacy beamline_save_v1 migrates to blip_save_v1 without losing progress', async ({ page }) => {
  await page.goto('/?test=1');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      'beamline_save_v1',
      JSON.stringify({
        signalFragments: 1,
        questStep: 'bossFight',
        discoveredScoutBadges: ['will'],
        flags: { doorOpened: true, nodeACompleted: true },
        playerStats: { deaths: 3 },
      })
    );
  });
  await page.reload();
  await page.waitForFunction(() => !!(window as never as Record<string, unknown>).__BLIP_TEST_API__);

  const migrated = await page.evaluate(() => ({
    newKey: localStorage.getItem('blip_save_v1'),
    oldKey: localStorage.getItem('beamline_save_v1'),
  }));
  expect(migrated.newKey, 'blip_save_v1 written').not.toBeNull();
  expect(migrated.oldKey, 'legacy key removed').toBeNull();

  const save = await api(page, 'api.getSaveData()');
  expect(save.signalFragments).toBe(1);
  expect(save.questStep).toBe('bossFight');
  expect(save.discoveredScoutBadges).toContain('will');
  expect(save.flags.doorOpened).toBe(true);
  expect(save.playerStats.deaths).toBe(3);
});

test('old saves without skin fields hydrate with defaults (additive migration)', async ({ page }) => {
  await page.goto('/?test=1');
  await page.evaluate(() => {
    localStorage.clear();
    // a save from before Signal Skins existed — no unlockedSkins/selectedSkin/signalSets
    localStorage.setItem(
      'blip_save_v1',
      JSON.stringify({ saveVersion: 1, signalFragments: 1, questStep: 'complete', flags: { bossDefeated: true } })
    );
  });
  await page.reload();
  await page.waitForFunction(() => !!(window as never as Record<string, unknown>).__BLIP_TEST_API__);
  const save = await api(page, 'api.getSaveData()');
  expect(save.signalFragments).toBe(1); // old progress preserved
  expect(save.unlockedSkins).toEqual(['contact47']); // new fields defaulted
  expect(save.selectedSkin).toBe('contact47');
  expect(save.signalSets).toEqual({});
});

test('reset clears localStorage and restarts clean', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await api(page, 'api.collectFragment()');
  await api(page, 'api.dismissTransmission()');
  await api(page, 'api.resetSave()');
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('save')));
  expect(keys).toHaveLength(0);

  await bootKeepingSave(page);
  const save = await api(page, 'api.getSaveData()');
  expect(save.signalFragments).toBe(0);
  expect(save.questStep).toBe('wake');
  expect(save.discoveredScoutBadges).toHaveLength(0);
});
