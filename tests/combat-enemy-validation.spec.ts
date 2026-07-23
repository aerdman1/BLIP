import { expect, test, type Page } from '@playwright/test';
import { SWEEP_ARENAS } from '../src/game/data/sweepArenas';
import type { SweepEnemyKind } from '../src/game/config';
import { api, bootToMenu, watchConsole } from './helpers';

const ENEMY_KINDS = ['drifter', 'tagger', 'diver', 'warden', 'sniper', 'splitter', 'weaver', 'turret', 'cipher', 'graviton', 'undertow', 'decoy', 'dormant'] as const satisfies readonly SweepEnemyKind[];
const ROUTE_ARENAS = ['surface-z1', 'circuit-z2', 'town-z3', 'maze-z4'] as const;
type EnemyKind = (typeof ENEMY_KINDS)[number];

interface CombatSnapshot {
  player: { x: number; y: number; hp: number };
  enemies: Array<{
    kind: EnemyKind;
    hp: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    bodyW: number;
    bodyH: number;
    rooted: boolean;
    shielded: boolean;
    charging: boolean;
    pathRecovering: boolean;
  }>;
  playerShots: number;
  enemyShots: number;
}

async function startProbe(page: Page, kind: EnemyKind): Promise<CombatSnapshot> {
  expect(await api(page, `api.startEnemyProbe(${JSON.stringify(kind)})`), `${kind} probe should start`).toBe(true);
  await page.waitForFunction(
    () => {
      const api = (window as any).__BLIP_TEST_API__;
      return api.getCombatSnapshot().enemies.length === 1;
    },
    null,
    { timeout: 3000 }
  );
  const snapshot = await api<CombatSnapshot>(page, 'api.getCombatSnapshot()');
  expect(snapshot.enemies, `${kind} probe should spawn exactly one enemy`).toHaveLength(1);
  expect(snapshot.enemies[0].kind).toBe(kind);
  expect(snapshot.enemies[0].bodyW, `${kind} world hitbox width should not shrink with HD sprite scale`).toBeGreaterThanOrEqual(22);
  expect(snapshot.enemies[0].bodyH, `${kind} world hitbox height should not shrink with HD sprite scale`).toBeGreaterThanOrEqual(22);
  return snapshot;
}

async function aimAndFireAtLiveEnemy(page: Page): Promise<boolean> {
  const snapshot = await api<CombatSnapshot>(page, 'api.getCombatSnapshot()');
  if (!snapshot.enemies[0]) return false;
  return api<boolean>(page, 'api.fireAtProbeEnemy()');
}

test('authored route enemy data has no overlap or spawn pressure traps', async () => {
  for (const arenaId of ROUTE_ARENAS) {
    const arena = SWEEP_ARENAS[arenaId];
    const seen = new Set<string>();
    for (const enemy of arena.enemies ?? []) {
      const key = `${enemy.tx},${enemy.ty}`;
      expect(seen.has(key), `${arenaId} has multiple enemies authored on ${key}`).toBe(false);
      seen.add(key);
      const spawnDist = Math.hypot(enemy.tx - arena.spawn.tx, enemy.ty - arena.spawn.ty);
      expect(spawnDist, `${arenaId}:${enemy.type} at ${key} is too close to the player spawn`).toBeGreaterThanOrEqual(5);
    }
  }
});

test('every enemy archetype moves, acts, or remains intentionally rooted/hidden', async ({ page }) => {
  const watcher = watchConsole(page);
  await bootToMenu(page);
  await api(page, `api.enterSweep('surface-z1')`);

  for (const kind of ENEMY_KINDS) {
    const before = await startProbe(page, kind);
    if (kind === 'decoy' || kind === 'dormant') {
      await aimAndFireAtLiveEnemy(page);
    }
    await api(page, 'api.stopAi()');
    await page.waitForTimeout(kind === 'undertow' ? 1400 : 1050);
    const after = await api<CombatSnapshot>(page, 'api.getCombatSnapshot()');
    const first = before.enemies[0];
    const latest = after.enemies[0];
    expect(latest, `${kind} should still be active during movement probe`).toBeTruthy();
    const moved = Math.hypot(latest.x - first.x, latest.y - first.y);
    if (kind === 'turret') {
      expect(moved, `${kind} is allowed to root/channel in its combat role`).toBeLessThan(12);
    } else {
      expect(moved, `${kind} should not freeze in a clear pursuit lane once active`).toBeGreaterThan(6);
    }
  }

  expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
});

test('authored route enemies keep world-space hitboxes in every HD region', async ({ page }) => {
  const watcher = watchConsole(page);
  await bootToMenu(page);

  for (const arena of ROUTE_ARENAS) {
    await api(page, `api.enterSweep(${JSON.stringify(arena)})`);
    await page.waitForTimeout(450);
    const snapshot = await api<CombatSnapshot>(page, 'api.getCombatSnapshot()');
    expect(snapshot.enemies.length, `${arena} should spawn authored enemies`).toBeGreaterThan(0);
    for (const enemy of snapshot.enemies) {
      expect(enemy.bodyW, `${arena}:${enemy.kind} hitbox width should remain playable`).toBeGreaterThanOrEqual(22);
      expect(enemy.bodyH, `${arena}:${enemy.kind} hitbox height should remain playable`).toBeGreaterThanOrEqual(22);
    }
  }

  expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
});

test('continue after death resets combat state instead of preserving probe or stale enemies', async ({ page }) => {
  const watcher = watchConsole(page);
  await bootToMenu(page);
  await api(page, `api.enterSweep('circuit-z2')`);
  await startProbe(page, 'warden');
  expect(await api(page, 'api.forceSweepDeath()')).toBe(true);
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSceneName() === 'GameOverScene');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSceneName() === 'SweepScene');
  await page.waitForTimeout(700);

  const runtime = await api(page, 'api.getSweepRuntimeState()');
  const snapshot = await api<CombatSnapshot>(page, 'api.getCombatSnapshot()');
  expect(runtime.breachOpen, 'retry should restart with locked route breach').toBe(false);
  expect(runtime.objectiveActions, 'retry should reset local objective actions').toBe(0);
  expect(snapshot.enemies.length, 'retry should restore the authored Motel roster, not the one-enemy probe').toBeGreaterThan(1);
  expect(snapshot.enemies.some((enemy) => enemy.kind === 'warden'), 'Motel retry should include authored wardens').toBe(true);
  for (const enemy of snapshot.enemies) {
    expect(enemy.bodyW, `retry ${enemy.kind} hitbox width should remain playable`).toBeGreaterThanOrEqual(22);
    expect(enemy.bodyH, `retry ${enemy.kind} hitbox height should remain playable`).toBeGreaterThanOrEqual(22);
  }

  expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
});

test('every enemy archetype can be killed by real player projectiles', async ({ page }) => {
  const watcher = watchConsole(page);
  await bootToMenu(page);
  await api(page, `api.enterSweep('surface-z1')`);

  for (const kind of ENEMY_KINDS) {
    await startProbe(page, kind);
    await api(page, `api.setSweepWeapon('pulse')`);
    let killed = false;
    for (let i = 0; i < 130; i++) {
      const hasTarget = await aimAndFireAtLiveEnemy(page);
      if (!hasTarget) {
        killed = true;
        break;
      }
      await page.waitForTimeout(80);
    }
    await api(page, 'api.stopAi()');
    const after = await api<CombatSnapshot>(page, 'api.getCombatSnapshot()');
    killed ||= after.enemies.length === 0;
    expect(killed, `${kind} should be killable through real projectile overlap/collision`).toBe(true);
  }

  expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
});
