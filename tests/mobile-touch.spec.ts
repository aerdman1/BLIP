import { expect, test, type Page } from '@playwright/test';
import { api, bootToMenu, playerState, startGame, teleport, waitForScene } from './helpers';

async function pressTouch(page: Page, selector: string, holdMs = 80): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.locator(selector).dispatchEvent('pointerdown', {
    pointerId: 21,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
    bubbles: true,
    cancelable: true,
  });
  await page.waitForTimeout(holdMs);
  await page.locator(selector).dispatchEvent('pointerup', {
    pointerId: 21,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 0,
    bubbles: true,
    cancelable: true,
  });
}

async function holdTouch(page: Page, selector: string, holdMs: number): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.locator(selector).dispatchEvent('pointerdown', {
    pointerId: 22,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
    bubbles: true,
    cancelable: true,
  });
  await page.waitForTimeout(holdMs);
  await page.locator(selector).dispatchEvent('pointerup', {
    pointerId: 22,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 0,
    bubbles: true,
    cancelable: true,
  });
}

test.describe('mobile title and touch controls', () => {
  test.use({ hasTouch: true, isMobile: true, deviceScaleFactor: 3 });

  test('phone menu is visible and scrollable in constrained portrait', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 520 });
    await bootToMenu(page);

    await expect(page.locator('#rotate-overlay')).toBeHidden();
    await expect(page.locator('#menu-slot-0')).toBeVisible();
    await expect(page.locator('#menu-slot-1')).toBeVisible();
    await expect(page.locator('#menu-slot-2')).toBeVisible();
    await expect(page.locator('#game-frame')).toHaveCSS('touch-action', 'pan-y');
    await expect(page.locator('#menu-overlay')).toHaveCSS('touch-action', 'pan-y');

    const canScroll = await page.locator('#menu-overlay').evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    if (canScroll) {
      await page.mouse.move(195, 260);
      await page.mouse.wheel(0, 160);
      await expect.poll(() => page.locator('#menu-overlay').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    }
  });

  test('phone landscape title shows save slots without rotate blocker', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await bootToMenu(page);

    await expect(page.locator('#rotate-overlay')).toBeHidden();
    await expect(page.locator('#menu-overlay')).toHaveCSS('position', 'fixed');
    for (const id of ['#menu-slot-0', '#menu-slot-1', '#menu-slot-2']) {
      const box = await page.locator(id).boundingBox();
      expect(box, `${id} should be on screen`).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(390);
    }
  });

  test('phone touch controls drive movement, weapons, abilities, pause, and interact', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await bootToMenu(page);
    await startGame(page);

    await expect(page.locator('#touch-controls')).toBeVisible();
    for (const cls of ['.tc-left', '.tc-right', '.tc-jump', '.tc-shoot', '.tc-scan', '.tc-dash', '.tc-echo', '.tc-interact', '.tc-pause']) {
      await expect(page.locator(cls)).toBeVisible();
    }

    const p0 = await playerState(page);
    await holdTouch(page, '.tc-right', 600);
    const p1 = await playerState(page);
    expect(p1.x).toBeGreaterThan(p0.x + 25);

    await pressTouch(page, '.tc-jump', 130);
    const rising = await playerState(page);
    expect(rising.vy).toBeLessThan(-40);
    await page.waitForTimeout(700);

    await teleport(page, 'badge');
    const preDash = await playerState(page);
    await pressTouch(page, '.tc-dash', 90);
    await page.waitForTimeout(220);
    const postDash = await playerState(page);
    expect(Math.abs(postDash.x - preDash.x)).toBeGreaterThan(20);

    const shots0 = await api<number>(page, 'api.getSaveData().playerStats.pulseShotsFired');
    await holdTouch(page, '.tc-shoot', 450);
    const shots1 = await api<number>(page, 'api.getSaveData().playerStats.pulseShotsFired');
    expect(shots1).toBeGreaterThan(shots0);

    const scans0 = await api<number>(page, 'api.getSaveData().playerStats.scansUsed');
    await pressTouch(page, '.tc-scan');
    await expect.poll(() => api<number>(page, 'api.getSaveData().playerStats.scansUsed')).toBe(scans0 + 1);

    await api(page, `api.giveAbility('echo-blink')`);
    await pressTouch(page, '.tc-echo');
    await expect.poll(() => playerState(page).then((p) => p.echoActive)).toBe(true);

    await pressTouch(page, '.tc-pause');
    await expect(page.locator('#pause-overlay')).toBeVisible();
    await page.locator('#pause-items .menu-item').filter({ hasText: 'RESUME' }).click();
    await expect(page.locator('#pause-overlay')).toBeHidden();

    await teleport(page, 'node');
    await api(page, `api.setQuestStep('enterNode')`);
    await pressTouch(page, '.tc-interact');
    await waitForScene(page, 'BlipstreamScene');
  });

  test('iPad viewport keeps touch controls and title actions reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await bootToMenu(page);
    await expect(page.locator('#menu-slot-0')).toBeVisible();
    await expect(page.locator('#menu-command-center')).toBeVisible();

    await startGame(page);
    await expect(page.locator('#touch-controls')).toBeVisible();
    await expect(page.locator('.tc-dpad')).toBeVisible();
    await expect(page.locator('.tc-actions')).toBeVisible();
    const dpad = await page.locator('.tc-dpad').boundingBox();
    const actions = await page.locator('.tc-actions').boundingBox();
    expect(dpad).not.toBeNull();
    expect(actions).not.toBeNull();
    expect(dpad!.x + dpad!.width).toBeLessThan(actions!.x);
  });
});
