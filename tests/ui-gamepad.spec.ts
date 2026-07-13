/**
 * UI SHELL + GAMEPAD — the crisp HTML console (status strip, objective bar,
 * settings modal, pause overlay, HTML main menu) and the controller layer.
 *
 * Real HID pads can't be emulated by Playwright, so the pad tests drive
 * api.simulatePad(), which feeds the exact same code path (PadSim → readPad)
 * consumed by PlayerInput and the shell navigator.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, playerState, startGame, teleport } from './helpers';

/* ---------- helpers ---------- */

async function pad(page: import('@playwright/test').Page, buttons: Record<number, boolean>, axes: [number, number] = [0, 0]) {
  await page.evaluate(
    ({ buttons, axes }) =>
      (window as never as { __BLIP_TEST_API__: { simulatePad: (s: unknown) => void } }).__BLIP_TEST_API__.simulatePad({
        connected: true,
        axes,
        buttons,
        id: 'SIM Standard Gamepad (Xbox layout)',
      }),
    { buttons, axes }
  );
}

async function padRelease(page: import('@playwright/test').Page) {
  await pad(page, {});
}

async function padTap(page: import('@playwright/test').Page, button: number, holdMs = 120) {
  await pad(page, { [button]: true });
  await page.waitForTimeout(holdMs);
  await padRelease(page);
  await page.waitForTimeout(80);
}

/* ---------- crisp UI shell ---------- */

test('HTML menu renders with logo + 3 save slots and starts a slot via click', async ({ page }) => {
  await bootToMenu(page);
  await expect(page.locator('#menu-overlay')).toBeVisible();
  await expect(page.locator('#menu-logo svg')).toHaveCount(1);
  await expect(page.locator('#menu-tagline')).toContainText('YOU ARE THE THING ON THE RADAR');
  // three save slots, all empty on a fresh boot
  await expect(page.locator('.menu-item.slot')).toHaveCount(3);
  await expect(page.locator('#menu-slot-0')).toContainText('NEW GAME');
  await page.click('#menu-slot-0');
  await page.waitForFunction(
    () => (window as never as { __BLIP_TEST_API__: { getSceneName: () => string } }).__BLIP_TEST_API__.getSceneName() === 'SweepScene',
    undefined,
    { timeout: 15_000 }
  );
  await expect(page.locator('#menu-overlay')).toBeHidden();
});

test('status strip: fragments, classification, location, status, clock', async ({ page }) => {
  await bootToMenu(page);
  await expect(page.locator('#strip-fragments')).toHaveText(/0 \/ 5/);
  await expect(page.locator('#strip-classify-label')).toHaveText('UNKNOWN');
  await expect(page.locator('#strip-location')).toContainText('CHAGRIN FALLS');
  await expect(page.locator('#strip-status')).toHaveText('STEALTH');
  await expect(page.locator('#strip-clock')).toHaveText(/^\d{1,2}:\d{2} [AP]M$/);
  await expect(page.locator('#strip-date')).toHaveText('05.24.1982');

  await startGame(page);
  await expect(page.locator('#strip-location')).toContainText('MILLER FIELD');
  await api(page, 'api.collectFragment()');
  await api(page, 'api.dismissTransmission()');
  await expect(page.locator('#strip-fragments')).toHaveText(/1 \/ 5/);
  // first fragment pip lights up
  await expect(page.locator('#strip-fragment-pips i.on')).toHaveCount(1);
});

test('objective bar tracks the quest', async ({ page }) => {
  await bootToMenu(page);
  await expect(page.locator('#objective-text')).toContainText('AWAITING TRANSMISSION');
  await startGame(page);
  await expect(page.locator('#objective-text')).toContainText('Systems online');
  await api(page, `api.setQuestStep('reachDoor')`);
  await expect(page.locator('#objective-text')).toContainText('crop-circle door');
});

test('pause overlay opens with ESC, resumes via button', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-overlay')).toBeVisible();
  await expect(page.locator('#pause-overlay')).toContainText('TRANSMISSION HELD');
  await page.click('#pause-resume');
  await expect(page.locator('#pause-overlay')).toBeHidden();
  // player can still move after resume
  const before = await playerState(page);
  await page.keyboard.down('d');
  await page.waitForTimeout(400);
  await page.keyboard.up('d');
  expect((await playerState(page)).x).toBeGreaterThan(before.x);
});

test('settings modal: toggles + volume persist to localStorage', async ({ page }) => {
  await bootToMenu(page);
  await page.click('#menu-settings');
  await expect(page.locator('#settings-modal')).toBeVisible();
  await expect(page.locator('#settings-body')).toContainText('MASTER VOLUME');
  await expect(page.locator('#settings-body')).toContainText('XBOX · PLAYSTATION');

  // CRT off → body class + persisted
  await page.click('#setting-crt');
  await expect(page.locator('body')).toHaveClass(/crt-off/);
  // volume to 80
  await page.locator('#setting-volume').fill('80');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('blip_settings_v1') ?? '{}'));
  expect(stored.crt).toBe(false);
  expect(stored.volume).toBeCloseTo(0.8, 1);

  await page.click('#settings-close');
  await expect(page.locator('#settings-modal')).toBeHidden();

  // persists across reload
  await page.reload();
  await page.waitForFunction(() => !!(window as never as Record<string, unknown>).__BLIP_TEST_API__);
  await expect(page.locator('body')).toHaveClass(/crt-off/);
});

/* ---------- gamepad (simulated HID) ---------- */

test('gamepad: stick moves, A jumps+hovers, RB dashes, X shoots', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);

  // stick right
  const p0 = await playerState(page);
  await pad(page, {}, [1, 0]);
  await page.waitForTimeout(600);
  await padRelease(page);
  const p1 = await playerState(page);
  expect(p1.x).toBeGreaterThan(p0.x + 30);

  // A = jump (vy negative while rising)
  await pad(page, { 0: true });
  await page.waitForTimeout(130);
  const rising = await playerState(page);
  expect(rising.vy).toBeLessThan(-50);
  await padRelease(page);
  await page.waitForTimeout(700);

  // RB = dash — from open ground (the spawn-side step can wall-block a
  // rightward dash depending on where the jump drift landed us)
  await teleport(page, 'badge');
  const preDash = await playerState(page);
  await padTap(page, 5, 90);
  await page.waitForTimeout(200);
  const postDash = await playerState(page);
  expect(Math.abs(postDash.x - preDash.x)).toBeGreaterThan(25);

  // X = pulse shot (stat increments)
  const shots0 = await api<number>(page, 'api.getSaveData().playerStats.pulseShotsFired');
  await pad(page, { 2: true });
  await page.waitForTimeout(450);
  await padRelease(page);
  const shots1 = await api<number>(page, 'api.getSaveData().playerStats.pulseShotsFired');
  expect(shots1).toBeGreaterThan(shots0);

  // Y = scan (stat increments)
  const scans0 = await api<number>(page, 'api.getSaveData().playerStats.scansUsed');
  await padTap(page, 3);
  const scans1 = await api<number>(page, 'api.getSaveData().playerStats.scansUsed');
  expect(scans1).toBe(scans0 + 1);

  await api(page, 'api.simulatePad(null)');
});

test('gamepad: START pauses, navigates the pause menu, A resumes', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);

  await padTap(page, 9); // START
  await expect(page.locator('#pause-overlay')).toBeVisible();

  // dpad down moves focus off RESUME, dpad up returns
  await padTap(page, 13);
  await expect(page.locator('#pause-items .menu-item.focused')).toContainText('SETTINGS');
  await padTap(page, 12);
  await expect(page.locator('#pause-items .menu-item.focused')).toContainText('RESUME');

  await padTap(page, 0); // A on RESUME
  await expect(page.locator('#pause-overlay')).toBeHidden();
  await api(page, 'api.simulatePad(null)');
});

test('gamepad: menu navigation + BACK opens command center in-game', async ({ page }) => {
  await bootToMenu(page);
  // menu is: SLOT 1/2/3 → COMMAND CENTER → FIELD MANUAL → SETTINGS.
  // dpad-down three times to focus COMMAND CENTER, A activates the focused entry.
  await padTap(page, 13);
  await padTap(page, 13);
  await padTap(page, 13);
  const focused = await page.locator('#menu-items .menu-item.focused').textContent();
  expect(focused).toContain('COMMAND CENTER');
  await padTap(page, 0);
  await expect(page.locator('#command-center')).toBeVisible();
  // B closes it
  await padTap(page, 1);
  await expect(page.locator('#command-center')).toBeHidden();

  // start game, BACK/SELECT opens command center
  await api(page, 'api.simulatePad(null)');
  await startGame(page);
  await padTap(page, 8);
  await expect(page.locator('#command-center')).toBeVisible();
  await padTap(page, 8);
  await expect(page.locator('#command-center')).toBeHidden();
  await api(page, 'api.simulatePad(null)');
});
