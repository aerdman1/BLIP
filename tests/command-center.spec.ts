/**
 * COMMAND CENTER — opens via key + button, live data, scout reveal flow,
 * no stale BEAMLINE/old-concept language, reset works.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, startGame } from './helpers';

test('opens with C key and shell button, shows all sections', async ({ page }) => {
  await bootToMenu(page);
  await page.keyboard.press('c');
  await expect(page.locator('#command-center')).toBeVisible();
  for (const section of [
    'OVERVIEW',
    'STORY BIBLE',
    'THE FIVE SIGNAL SCOUTS',
    'CORE MECHANICS',
    'CONTROLS',
    'WARDROBE',
    'PROGRESSION',
    'ZONES',
    'LEVEL PLANS / ROADMAP',
    'LEVEL ATLAS — BIRDSEYE',
    'BESTIARY',
    'ARSENAL — CONTACT-47 TUNING',
    'DEBUG / SAVE DATA',
    'BUILD TODO',
    'AI QA / PLAYTEST LAB',
    'EXPERIMENTAL WEB TECH',
    'ART DIRECTION',
  ]) {
    await expect(page.locator('#command-center')).toContainText(section);
  }
  // core naming is present
  await expect(page.locator('#command-center')).toContainText('CONTACT-47');
  await expect(page.locator('#command-center')).toContainText('The Interpretation Engine');
  await expect(page.locator('#command-center')).toContainText('Blipstream');
  // close with C again
  await page.keyboard.press('c');
  await expect(page.locator('#command-center')).toBeHidden();
});

test('no stale BEAMLINE branding or cow-abduction concept anywhere', async ({ page }) => {
  await bootToMenu(page);
  await page.click('#btn-command-center');
  const text = (await page.locator('#command-center').innerText()).toUpperCase();
  expect(text).not.toContain('BEAMLINE');
  expect(text).not.toContain('COW');
  expect(text).not.toContain('ABDUCT');
  expect(text).not.toContain('TRACTOR BEAM');
  // page title too
  expect((await page.title()).toUpperCase()).not.toContain('BEAMLINE');
});

test('live overview data + scout reveal after badge award', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await page.keyboard.press('c');
  await expect(page.locator('#cc-scene')).toContainText('FieldScene');
  await expect(page.locator('#cc-scouts-count')).toContainText('0 / 5');
  // all five unknown
  await expect(page.locator('#cc-scouts-grid .cc-card.unknown')).toHaveCount(5);

  // award Will's badge through the save path (world pickup covered in playtest)
  await api(page, `api.giveScoutBadge('will', 'will-log-1')`);
  await expect(page.locator('#cc-scouts-count')).toContainText('1 / 5');
  await expect(page.locator('#cc-scouts-grid')).toContainText('WILL / WILLOW');
  await expect(page.locator('#cc-scouts-grid .cc-card.unknown')).toHaveCount(4);
  // recovered log renders
  await expect(page.locator('#cc-scout-logs')).toContainText('WILLOW');
  await expect(page.locator('#cc-scout-logs')).toContainText('the grown-ups missed');
});

test('story bible decrypts after first fragment + save viewer updates', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await page.keyboard.press('c');
  await expect(page.locator('[data-bible="fragment-analysis-01"]')).toContainText('ENCRYPTED');
  await api(page, 'api.collectFragment()');
  await api(page, 'api.dismissTransmission()');
  await expect(page.locator('[data-bible="fragment-analysis-01"]')).toContainText('It isn’t invading');
  await expect(page.locator('#cc-save-json')).toContainText('"signalFragments": 1');
});

test('dev birdseye: level atlas canvases painted, bestiary + arsenal live numbers', async ({ page }) => {
  await bootToMenu(page);
  await page.keyboard.press('c');
  // atlas canvases exist and contain non-background pixels
  for (const id of ['cc-atlas-miller', 'cc-atlas-node']) {
    const painted = await page.evaluate((canvasId) => {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
      if (!canvas) return -1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return -1;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 0; i < data.length; i += 4) {
        // count pixels that differ from the #0a1120 background
        if (Math.abs(data[i] - 10) + Math.abs(data[i + 1] - 17) + Math.abs(data[i + 2] - 32) > 30) lit++;
      }
      return lit / (data.length / 4);
    }, id);
    // Miller Field is dense terrain; Node A is a sparse waveform void (~5% lit)
    expect(painted, `${id} painted ratio`).toBeGreaterThan(0.03);
  }
  // bestiary + arsenal pull real tuning numbers from config
  await expect(page.locator('#cc-bestiary')).toContainText('SCANNER DRONE');
  await expect(page.locator('#cc-bestiary')).toContainText('THE SCARECROW ANTENNA');
  await expect(page.locator('#cc-arsenal')).toContainText('Phase Drift');
  await expect(page.locator('#cc-arsenal')).toContainText('112px/s'); // PLAYER.runSpeed
});

test('standalone /command-center.html works without the game', async ({ page }) => {
  // seed some progress first (same localStorage origin)
  await bootToMenu(page);
  await api(page, `api.giveScoutBadge('will', 'will-log-1')`);

  await page.goto('/command-center.html');
  await expect(page.locator('#command-center')).toBeVisible();
  await expect(page.locator('#command-center')).toContainText('STANDALONE DEV DASHBOARD');
  await expect(page.locator('#command-center')).toContainText('LEVEL ATLAS — BIRDSEYE');
  await expect(page.locator('#command-center')).toContainText('BESTIARY');
  // reads the shared save: Will already discovered
  await expect(page.locator('#cc-scouts-count')).toContainText('1 / 5');
  // no Phaser canvas on this page, and no stale branding
  expect(await page.locator('canvas.cc-atlas').count()).toBeGreaterThanOrEqual(2);
  expect(await page.locator('#game-root canvas').count()).toBe(0);
  const text = (await page.locator('#command-center').innerText()).toUpperCase();
  expect(text).not.toContain('BEAMLINE');
});

test('command center reset button wipes the save', async ({ page }) => {
  await bootToMenu(page);
  await startGame(page);
  await api(page, `api.setQuestStep('reachDoor')`);
  await page.keyboard.press('c');
  page.on('dialog', (d) => void d.accept());
  await page.click('#cc-reset-save');
  await page.waitForLoadState('load');
  await page.waitForFunction(() => !!(window as never as Record<string, unknown>).__BLIP_TEST_API__);
  expect(await api(page, 'api.getSaveData().questStep')).toBe('wake');
  expect(await api(page, 'api.getSaveData().signalFragments')).toBe(0);
});
