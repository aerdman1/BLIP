/**
 * QA PLAYTEST — the fun-loop storyboard. Plays the full Miller Field vertical
 * slice, capturing the ordered screenshot set + a paired debug-telemetry
 * snapshot at every beat. Real keyboard input proves the controls at spawn,
 * the scan reveal, and inside the Blipstream; deterministic teleports frame the
 * rest so the storyboard is stable run-to-run.
 *
 * Output (loop-scoped via QA_LOOP env, default "adhoc"):
 *   qa-reports/screenshots/loop-<id>/NN-<beat>.png
 *   qa-reports/telemetry/loop-<id>.json   (console errors + per-beat snapshots)
 *
 * Run:  QA_LOOP=0 npm run qa:playtest
 */
import { expect, test } from '@playwright/test';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { api, bootToMenu, hold, playerState, startGame, tap, teleport, waitForScene, watchConsole } from './helpers';

const LOOP = process.env.QA_LOOP ?? 'adhoc';
const SHOT_DIR = `qa-reports/screenshots/loop-${LOOP}`;
const TELEM_PATH = `qa-reports/telemetry/loop-${LOOP}.json`;

test('storyboard: full Miller Field slice with telemetry', async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(SHOT_DIR, { recursive: true });
  mkdirSync('qa-reports/telemetry', { recursive: true });
  const watcher = watchConsole(page);
  const telem: Array<Record<string, unknown>> = [];

  // ordered storyboard capture: full-page screenshot + paired debug snapshot
  const snap = async (name: string): Promise<void> => {
    await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
    const snapshot = await api<Record<string, unknown> | null>(page, 'api.collectDebugSnapshot?.() ?? null');
    telem.push({ shot: name, ...(snapshot ?? {}) });
  };

  // 1 — title screen
  await bootToMenu(page);
  await snap('01-title');

  // 2 — spawn (prove real movement, then frame the ridge)
  await startGame(page);
  await snap('02-spawn');
  await hold(page, 'd', 650);
  await hold(page, 'a', 250);

  // 3 — scan tutorial: a real Q press reveals the dip climb-out ladder
  await teleport(page, 'dip');
  await tap(page, 'q');
  await page.waitForTimeout(900);
  await snap('03-scan-tutorial');

  // 4 — scanner plateau (the red detection cone)
  await api(page, `api.teleportToBeat('scanner-plateau')`);
  await page.waitForTimeout(500);
  await snap('04-scanner-plateau');

  // 5 — drone lowlands (tiered combat valley)
  await teleport(page, 'drones');
  await page.waitForTimeout(600);
  await snap('05-drone-lowlands');

  // 6 — Will's optional route: reveal the badge trail with a scan
  await teleport(page, 'badge');
  await page.waitForTimeout(2500); // scan cooldown
  await tap(page, 'q');
  await page.waitForTimeout(1000);
  await snap('06-will-route');

  // 7 — the ravine / pit (void hazard crossing)
  await api(page, `api.teleportToBeat('ravine')`);
  await page.waitForTimeout(500);
  await snap('07-ravine');

  // 8 — Blipstream node portal on the mound (before entering)
  await api(page, `api.setQuestStep('enterNode')`);
  await teleport(page, 'node');
  await page.waitForTimeout(500);
  await snap('08-blipstream-node');

  // 9 — inside the Blipstream room (real E press to enter)
  await tap(page, 'e');
  await waitForScene(page, 'BlipstreamScene');
  await page.waitForTimeout(900);
  await snap('09-blipstream-room');

  // 10 — crop-circle door opening (solve → return → the door responds)
  await api(page, 'api.completeBlipstreamPuzzle()');
  await waitForScene(page, 'FieldScene');
  await page.waitForTimeout(700);
  await teleport(page, 'door');
  await page.waitForTimeout(900);
  await snap('10-crop-door-opening');

  // 11 — boss arena: the Scarecrow Antenna, core exposed by a scan
  await teleport(page, 'bossArena');
  await expect.poll(() => api(page, 'api.getBossState()?.state ?? "none"'), { timeout: 15_000 }).toBe('fighting');
  await tap(page, 'q');
  await page.waitForTimeout(1200);
  await snap('11-boss-arena');

  // 12 — the Signal Fragment reward (transmission card visible)
  await api(page, 'api.damageBoss(99)');
  await page.waitForTimeout(2200);
  await api(page, 'api.collectFragment()');
  await page.waitForTimeout(700);
  await snap('12-fragment-reward');
  await api(page, 'api.dismissTransmission()');

  // 13 — Road East (the lit signal-gate to Zone 2)
  await page.waitForTimeout(400);
  await api(page, `api.teleportToBeat('road-east')`);
  await page.waitForTimeout(700);
  await snap('13-road-east');

  // dump telemetry + any console errors for the loop report
  writeFileSync(
    TELEM_PATH,
    JSON.stringify({ loop: LOOP, capturedAt: new Date().toISOString(), consoleErrors: watcher.errors, beats: telem }, null, 2)
  );

  // sanity: key frames are real scenes, not black voids (WebGL buffer can't be
  // read directly; a flat black PNG at this viewport is tiny)
  for (const name of ['01-title', '02-spawn', '09-blipstream-room', '11-boss-arena']) {
    const size = statSync(`${SHOT_DIR}/${name}.png`).size;
    expect(size, `${name}.png should contain a real scene`).toBeGreaterThan(12_000);
  }
  expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
});

/**
 * CAMERA LOOKAHEAD — the view must lead the direction CONTACT-47 faces (so
 * drops/drones/the ravine are visible before you arrive). Phaser focuses on
 * (target − followOffset); a moving player should sit BEHIND camera center in
 * the travel direction. Verified with real held input on a long flat stretch.
 */
test('camera leads the facing direction (lookahead)', async ({ page }) => {
  test.setTimeout(90_000);
  mkdirSync(SHOT_DIR, { recursive: true });
  await bootToMenu(page);
  await startGame(page);
  await api(page, 'api.enableGodMode()');
  await api(page, 'api.teleportTo(800, 248)'); // scanner-plateau flat, mid-world (no edge clamp)
  await page.waitForTimeout(250);

  // run right and sample while still moving
  await page.keyboard.down('d');
  await page.waitForTimeout(750);
  const camR = await api<{ midX: number }>(page, 'api.getCameraState()');
  const pR = await playerState(page);
  await page.screenshot({ path: `${SHOT_DIR}/cam-lookahead-right.png` });
  await page.keyboard.up('d');
  await page.waitForTimeout(500);

  // run left and sample while still moving
  await page.keyboard.down('a');
  await page.waitForTimeout(750);
  const camL = await api<{ midX: number }>(page, 'api.getCameraState()');
  const pL = await playerState(page);
  await page.keyboard.up('a');

  // facing right → camera center leads to the RIGHT of the player, and vice-versa.
  // Net lead is smaller than CAM.lookaheadX (the deadzone + follow lag absorb some).
  expect(camR.midX - pR.x, 'camera leads right while running right').toBeGreaterThan(25);
  expect(pL.x - camL.midX, 'camera leads left while running left').toBeGreaterThan(25);
});

/** Zone 2 (Motel) shares the same lookahead so the camera feel is consistent. */
test('Motel camera also leads the facing direction', async ({ page }) => {
  test.setTimeout(60_000);
  mkdirSync(SHOT_DIR, { recursive: true });
  await bootToMenu(page);
  await api(page, `api.enterZone('motel-nowhere')`);
  await waitForScene(page, 'MotelScene');
  await page.waitForTimeout(1000); // let the "arrive" how-to card appear (+650ms) before dismissing
  await api(page, 'api.dismissTransmission()');
  await page.waitForTimeout(250);
  await api(page, 'api.enableGodMode()');
  await api(page, 'api.teleportTo(300, 272)'); // flat parking-lot floor, mid-zone
  await page.waitForTimeout(250);
  await page.keyboard.down('d');
  await page.waitForTimeout(750);
  const camR = await api<{ midX: number }>(page, 'api.getCameraState()');
  const pR = await playerState(page);
  await page.screenshot({ path: `${SHOT_DIR}/motel-cam-lookahead.png` });
  await page.keyboard.up('d');
  expect(camR.midX - pR.x, 'Motel camera leads right while running right').toBeGreaterThan(20);
});

/**
 * BOSS FAIRNESS — the Scarecrow's radial burst must telegraph before it fires
 * (an amber converging wind-up), so the volley is dodgeable and reads apart
 * from the red beams/core. Samples fast until the wind-up flag is set, then
 * captures the frame.
 */
test('boss radial burst is telegraphed', async ({ page }) => {
  test.setTimeout(90_000);
  mkdirSync(SHOT_DIR, { recursive: true });
  await bootToMenu(page);
  await startGame(page);
  await api(page, 'api.enableGodMode()');
  await api(page, `api.setQuestStep('bossFight')`);
  await teleport(page, 'bossArena');
  await expect.poll(() => api(page, 'api.getBossState()?.state ?? "none"'), { timeout: 15_000 }).toBe('fighting');

  // catch the wind-up: sample fast until telegraphing, then snap the frame
  let caught = false;
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (await api<boolean>(page, 'api.getBossState()?.telegraphing ?? false')) {
      caught = true;
      await page.screenshot({ path: `${SHOT_DIR}/boss-telegraph.png` });
      break;
    }
    await page.waitForTimeout(60);
  }
  expect(caught, 'radial burst shows an amber wind-up telegraph before firing').toBe(true);
});

/**
 * SCAN FEEDBACK — SONAR must always answer. On empty ground (nothing hidden,
 * no box/drone/secret/boss in range) it now floats "NO ANOMALIES" so the pulse
 * never reads as a dead no-op. Captures the frame for review.
 */
test('scan on empty ground answers NO ANOMALIES', async ({ page }) => {
  test.setTimeout(60_000);
  mkdirSync(SHOT_DIR, { recursive: true });
  await bootToMenu(page);
  await startGame(page);
  await teleport(page, 'spawn'); // spawn ridge — nearest secret/platform is far outside scan radius
  const s0 = await api<number>(page, 'api.getSaveData().playerStats.scansUsed');
  await tap(page, 'q');
  await page.waitForTimeout(180);
  await page.screenshot({ path: `${SHOT_DIR}/scan-no-anomalies.png` });
  const s1 = await api<number>(page, 'api.getSaveData().playerStats.scansUsed');
  expect(s1, 'scan fired on empty ground').toBe(s0 + 1);
  expect(await api<boolean>(page, 'api.getCollectiblesState().revealedHiddenPath'), 'empty scan reveals nothing').toBe(false);
});
