/**
 * PLAYTEST — movement mechanics with real keyboard input, then the full
 * quest flow of THE FIRST CONTACT. Real inputs prove each mechanic; the
 * Test API skips only repetition (grinding boss hp), never mechanics.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, hold, playerState, questStep, startGame, tap, teleport, waitForScene, watchConsole } from './helpers';

test.describe('movement', () => {
  test('run, jump, hover, dash, shoot, scan', async ({ page }) => {
    const watcher = watchConsole(page);
    await bootToMenu(page);
    await startGame(page);

    // does not fall through the ground
    const idle0 = await playerState(page);
    await page.waitForTimeout(800);
    const idle1 = await playerState(page);
    expect(Math.abs(idle1.y - idle0.y)).toBeLessThan(3);
    expect(idle1.grounded).toBe(true);

    // run right
    const before = await playerState(page);
    await hold(page, 'd', 500);
    const afterRun = await playerState(page);
    expect(afterRun.x).toBeGreaterThan(before.x + 30);

    // run left
    await hold(page, 'a', 350);
    const afterLeft = await playerState(page);
    expect(afterLeft.x).toBeLessThan(afterRun.x - 15);

    // jump — vy goes negative, then lands
    await page.keyboard.down('Space');
    await page.waitForTimeout(120);
    const midJump = await playerState(page);
    await page.keyboard.up('Space');
    expect(midJump.vy).toBeLessThan(-50);
    await page.waitForTimeout(800);
    expect((await playerState(page)).grounded).toBe(true);

    // hover — hold jump while falling caps fall speed
    await page.keyboard.down('Space');
    await page.waitForTimeout(350); // rise
    const falling: number[] = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(90);
      falling.push((await playerState(page)).vy);
    }
    await page.keyboard.up('Space');
    const hoverSamples = falling.filter((vy) => vy > 0);
    expect(hoverSamples.length, `fall samples: ${falling.join(',')}`).toBeGreaterThan(0);
    for (const vy of hoverSamples) expect(vy).toBeLessThanOrEqual(40);
    await page.waitForTimeout(600);

    // dash — quick horizontal displacement
    const preDash = await playerState(page);
    await tap(page, 'Shift');
    await page.waitForTimeout(260);
    const postDash = await playerState(page);
    expect(Math.abs(postDash.x - preDash.x)).toBeGreaterThan(28);

    // shoot — pulse stat increments
    const shots0 = await api<number>(page, 'api.getSaveData().playerStats.pulseShotsFired');
    await hold(page, 'x', 450);
    const shots1 = await api<number>(page, 'api.getSaveData().playerStats.pulseShotsFired');
    expect(shots1).toBeGreaterThan(shots0);

    // scan — cooldown + stat
    const scans0 = await api<number>(page, 'api.getSaveData().playerStats.scansUsed');
    await tap(page, 'q');
    const scans1 = await api<number>(page, 'api.getSaveData().playerStats.scansUsed');
    expect(scans1).toBe(scans0 + 1);

    expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
  });
});

test.describe('quest flow — THE FIRST CONTACT', () => {
  test('full loop: scan → drones → node → puzzle → door → boss → fragment → save', async ({ page }) => {
    test.setTimeout(180_000);
    const watcher = watchConsole(page);
    await bootToMenu(page);
    await startGame(page);

    // step 1: wake — completes by moving away from spawn
    expect(await questStep(page)).toBe('wake');
    await hold(page, 'd', 900);
    await expect.poll(() => questStep(page), { timeout: 8_000 }).toBe('scanTutorial');

    // step 2: scan reveals the hidden platforms in the dip
    await teleport(page, 'dip');
    await tap(page, 'q');
    await expect.poll(() => questStep(page), { timeout: 8_000 }).toBe('avoidCone');

    // step 3: get past the scanner rig zone
    await teleport(page, 'drones');
    await expect.poll(() => questStep(page), { timeout: 8_000 }).toBe('destroyDrones');

    // step 4: destroy 2 drones with real pulse shots (god mode: testing combat, not survival)
    await api(page, 'api.toggleGodMode(true)');
    await teleport(page, 'drones');
    const killDeadline = Date.now() + 45_000;
    let step = await questStep(page);
    let facing = 1;
    // stand still and shoot — aggro'd drones align to the gun line themselves
    while (step === 'destroyDrones' && Date.now() < killDeadline) {
      await page.keyboard.down('x');
      await page.waitForTimeout(1400);
      await page.keyboard.up('x');
      // face the other way to cover drones approaching from behind
      await hold(page, facing > 0 ? 'a' : 'd', 90);
      facing = -facing;
      step = await questStep(page);
    }
    expect(step, 'both drones destroyed with real pulse shots').toBe('reachDoor');

    // step 5: reach the crop-circle door
    await teleport(page, 'door');
    await expect.poll(() => questStep(page), { timeout: 8_000 }).toBe('enterNode');

    // step 6: enter the Blipstream with a real E press at the portal
    await teleport(page, 'node');
    await tap(page, 'e');
    await waitForScene(page, 'BlipstreamScene');

    // step 7: prove the puzzle mechanic — activate node 1 with a real run/jump/shot
    await expect.poll(() => questStep(page)).toBe('solvePuzzle');
    await page.keyboard.down('d');
    await page.waitForTimeout(600);
    await page.keyboard.down('Space'); // jump + hover across the first gap
    await page.waitForTimeout(800);
    await page.keyboard.up('Space');
    await page.keyboard.up('d');
    await page.waitForTimeout(400);
    await page.keyboard.down('x');
    await page.waitForTimeout(700);
    await page.keyboard.up('x');
    // the rest of the routing is puzzle repetition — finish via API and exit
    await api(page, 'api.completeBlipstreamPuzzle()');
    await waitForScene(page, 'FieldScene');

    // step 8: returning routed the node — the door opens
    await expect.poll(() => api<boolean>(page, 'api.getDebugFlags().doorOpened'), { timeout: 10_000 }).toBe(true);
    await expect.poll(() => questStep(page), { timeout: 10_000 }).toBe('bossFight');

    // step 9: boss — walk through the door, boss rises, scan exposes the core
    await teleport(page, 'bossArena');
    await expect.poll(() => api(page, 'api.getBossState()?.state ?? "none"'), { timeout: 15_000 }).toBe('fighting');
    await tap(page, 'q'); // scan pulse
    await expect.poll(() => api(page, 'api.getBossState()?.exposed ?? false'), { timeout: 6_000 }).toBe(true);

    // land at least one real pulse hit on the exposed core (stand + shoot;
    // the core sits low so a grounded shot connects, with small hops for margin)
    await hold(page, 'd', 120); // face the boss
    const hp0 = await api<number>(page, 'api.getBossState().hp');
    const hitDeadline = Date.now() + 45_000;
    let hp = hp0;
    while (hp >= hp0 && Date.now() < hitDeadline) {
      const exposed = await api<boolean>(page, 'api.getBossState()?.exposed ?? false');
      if (!exposed) await tap(page, 'q');
      await page.keyboard.down('x'); // hold fire
      await page.waitForTimeout(500);
      await tap(page, 'Space'); // small hop to sweep the shot line across the core
      await page.waitForTimeout(400);
      await page.keyboard.up('x');
      const b = await api<{ hp: number } | null>(page, 'api.getBossState()');
      if (!b) break;
      hp = b.hp;
    }
    expect(hp, 'a real pulse shot damaged the exposed core').toBeLessThan(hp0);

    // the rest of the fight is repetition — finish via API
    await api(page, 'api.damageBoss(99)');
    await expect.poll(() => api<boolean>(page, 'api.getDebugFlags().bossDefeated'), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => questStep(page), { timeout: 10_000 }).toBe('collectFragment');

    // step 10: collect the Signal Fragment by walking into it
    await teleport(page, 'bossArena');
    await hold(page, 'd', 1200);
    await hold(page, 'a', 600);
    await expect.poll(() => api<number>(page, 'api.getSaveData().signalFragments'), { timeout: 15_000 }).toBe(1);
    await api(page, 'api.dismissTransmission()');
    await expect.poll(() => questStep(page)).toBe('complete');

    // save flags all landed
    const flags = await api<Record<string, boolean>>(page, 'api.getDebugFlags()');
    expect(flags.nodeACompleted).toBe(true);
    expect(flags.doorOpened).toBe(true);
    expect(flags.bossDefeated).toBe(true);
    expect(flags.firstFragmentCollected).toBe(true);

    expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
  });
});
