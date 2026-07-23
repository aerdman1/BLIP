import { expect, test } from '@playwright/test';
import { api, bootToMenu, watchConsole } from './helpers';

const traverseArenas = [
  { id: 'surface-z1', reward: 'Pulse Resonance', exit: 'motel' },
  { id: 'circuit-z2', reward: 'EMP Burst', exit: 'River Road' },
  { id: 'town-z3', reward: 'Ghost Protocol', exit: 'county trail' },
  { id: 'maze-z4', reward: 'Carbine Ricochet', exit: 'signal storm' },
] as const;

test.describe('route readiness automation', () => {
  for (const arena of traverseArenas) {
    test(`${arena.id} has HD rendering, objective copy, route guidance and safe route-open state`, async ({ page }) => {
      const watcher = watchConsole(page);
      await bootToMenu(page);
      await api(page, `api.enterSweep('${arena.id}')`);
      await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSceneName() === 'SweepScene');
      await page.waitForTimeout(850);

      const render = await api<any>(page, 'api.getSweepRenderState()');
      expect(render.hdActive, `${arena.id} should use the HD top-down renderer`).toBe(true);
      expect(render.artReady, `${arena.id} HD art should be ready`).toBe(true);
      expect(render.missingTiles).toHaveLength(0);
      expect(render.missingFrames).toHaveLength(0);
      expect(render.missingAtlasFrames).toHaveLength(0);

      const start = await api<any>(page, 'api.getSweepRuntimeState()');
      expect(start.hp).toBe(start.maxHp);
      expect(start.chargeTarget).toBeGreaterThan(0);
      expect(start.objectiveActionsRequired).toBeGreaterThanOrEqual(2);
      expect(start.enemiesActive).toBeGreaterThan(0);

      const perception = await api<any>(page, 'api.getAiPerception()');
      expect(perception.objective.title).not.toMatch(/charge the signal node/i);
      expect(perception.objective.hint).toBeTruthy();
      expect(perception.objective.reward).toContain(arena.reward);
      expect(perception.objectiveHint, `${arena.id} should expose a visible next-step hint`).toBeTruthy();
      expect(['route-beacon', 'field-event', 'gravity-well', 'node']).toContain(perception.objectiveHint.kind);

      expect(await api(page, 'api.openRouteForInspection()')).toBe(true);
      await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSweepRuntimeState().breachOpen === true);
      await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSweepRuntimeState().enemiesActive === 0);
      const opened = await api<any>(page, 'api.getAiPerception()');
      expect(opened.objective.title).toBe('Route open');
      expect(opened.objective.hint).toContain(arena.exit);
      expect(opened.objectiveHint).toBeTruthy();
      expect(['route-beacon', 'breach']).toContain(opened.objectiveHint.kind);
      if (arena.id === 'circuit-z2') {
        expect(opened.visible.scanners, 'Motel scanner beams should not remain as active-looking props after the route opens').toHaveLength(0);
      }
      expect(await api<number>(page, 'api.getSweepRuntimeState().enemiesActive')).toBe(0);
      expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
    });
  }

  test('Motel starts as the stealth/Boost region', async ({ page }) => {
    await bootToMenu(page);
    await api(page, `api.enterSweep('circuit-z2')`);
    const perception = await api<any>(page, 'api.getAiPerception()');
    expect(perception.objective.title).toMatch(/scanner/i);
    expect(perception.objective.hint).toMatch(/Boost/i);
    expect(perception.visible.scanners.length).toBeGreaterThan(0);
    expect(perception.visible.scanners.every((scanner: { label: string }) => /SCANNER$/.test(scanner.label))).toBe(true);
    expect(perception.visible.scanners.map((scanner: { label: string }) => scanner.label).join(' ')).not.toMatch(/gate|motel circuit/i);
    expect(perception.objectiveHint.label).not.toMatch(/gate|motel circuit/i);
    expect(await api<number>(page, 'api.getSweepRuntimeState().motelScanners.total')).toBeGreaterThanOrEqual(5);
    await expect(page.locator('.td-objective-sub')).toContainText(/Scanners offline/i);
    await expect(page.locator('.td-objective-sub')).not.toContainText(/gate/i);
  });

  test('Motel stealth bonus requires all scanners offline without alert', async ({ page }) => {
    await bootToMenu(page);
    await api(page, `api.enterSweep('circuit-z2')`);
    expect(await api(page, 'api.openRouteForInspection()')).toBe(true);
    expect(await api<boolean>(page, `api.getSaveData().rewards.awarded.includes('motel:ghost-checkin-bonus')`)).toBe(false);

    await bootToMenu(page);
    await api(page, `api.enterSweep('circuit-z2')`);
    expect(await api(page, 'api.disableMotelScannersForInspection()')).toBe(true);
    const disabled = await api<any>(page, 'api.getSweepRuntimeState()');
    expect(disabled.motelAlerts).toBe(0);
    expect(disabled.motelScanners.disabled).toBe(disabled.motelScanners.total);

    expect(await api(page, 'api.openRouteForInspection()')).toBe(true);
    const save = await api<any>(page, 'api.getSaveData()');
    expect(save.rewards.awarded).toContain('motel:ghost-checkin-bonus');
    expect(save.shards).toBeGreaterThanOrEqual(25);
  });

  test('Orchard requires Gravity Well before the Crop Circle route', async ({ page }) => {
    await bootToMenu(page);
    await api(page, `api.enterSweep('maze-z4')`);
    const before = await api<any>(page, 'api.getAiPerception()');
    expect(before.progress.gravityWellRequired).toBe(true);
    expect(before.progress.gravityWellUsed).toBe(false);
    expect(before.objective.hint).toMatch(/well|raised ridge|Crop Circle/i);
    expect(before.objectiveHint.kind).toBe('route-beacon');

    const runtime = await api<any>(page, 'api.getSweepRuntimeState()');
    expect(runtime.gravityWellRequired).toBe(true);
    expect(runtime.gravityWellUsed).toBe(false);
  });

  test('Signal Storm has named finale phases and completion reward copy', async ({ page }) => {
    const watcher = watchConsole(page);
    await bootToMenu(page);
    await api(page, `api.enterSweep('anomaly-01')`);
    await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSceneName() === 'SweepScene');
    const render = await api<any>(page, 'api.getSweepRenderState()');
    expect(render.hdActive).toBe(true);
    const perception = await api<any>(page, 'api.getAiPerception()');
    expect(perception.objective.title).toMatch(/Storm Classifier/i);
    expect(perception.objective.reward).toMatch(/Refuse the Label/i);
    await expect(page.locator('.td-objective-title')).toContainText(/Storm Classifier|CLASSIFIER CORE/i);
    await page.waitForFunction(() => (window as any).__BLIP_TEST_API__.getSweepRuntimeState().enemiesActive > 0, null, { timeout: 2500 });
    expect(await api<number>(page, 'api.getSweepRuntimeState().enemiesActive')).toBeGreaterThan(0);
    expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
  });
});
