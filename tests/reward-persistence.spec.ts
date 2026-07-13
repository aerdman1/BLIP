import { test, expect } from '@playwright/test';
import { api, bootToMenu } from './helpers';

test('rewards, trophies, dust, and equipped cosmetics persist across reload', async ({ page }) => {
  await bootToMenu(page);

  await api(page, `api.grantCache('broadcast')`);
  const opened = await api<{ rewards: Array<{ def: { id: string }; isNew: boolean }>; newCount: number } | null>(page, `api.openCache('broadcast')`);
  expect(opened).not.toBeNull();
  expect(opened!.rewards).toHaveLength(1);

  await api(page, `api.forceOwnReward('trail-comet')`);
  expect(await api<boolean>(page, `api.equipReward('trail-comet')`)).toBe(true);
  const before = await api<{
    owned: string[];
    trophies: string[];
    dust: number;
    recent: unknown[];
    equipped: Record<string, string>;
  }>(page, 'api.getRewardState()');

  expect(before.owned).toContain('trail-comet');
  expect(before.trophies).toContain('first-cache');
  expect(before.recent.length).toBeGreaterThan(0);
  expect(before.equipped.trail).toBe('trail-comet');

  await page.reload();
  await page.waitForFunction(() => (window as never as { __BLIP_TEST_API__?: { getSceneName?: () => string } }).__BLIP_TEST_API__?.getSceneName?.() === 'MainMenuScene');
  const after = await api<typeof before>(page, 'api.getRewardState()');

  expect(after.owned).toEqual(before.owned);
  expect(after.trophies).toEqual(before.trophies);
  expect(after.dust).toBe(before.dust);
  expect(after.recent).toEqual(before.recent);
  expect(after.equipped.trail).toBe('trail-comet');
});
