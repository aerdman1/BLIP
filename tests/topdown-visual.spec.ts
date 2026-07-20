/**
 * Top-down visual overhaul — gameplay parity + asset integrity.
 *
 * The visuals themselves are reviewed from screenshots; what THIS suite guards
 * is everything a screenshot cannot show:
 *   - the objective flow still works end to end;
 *   - no asset is hotlinked and none 404s;
 *   - no texture key silently resolves to Phaser's __MISSING placeholder
 *     (atlas frame-name drift is the most likely silent art failure);
 *   - the hi-res backbuffer NEVER leaks out of the Sweep — a leaked resize
 *     would render every subsequent scene tiny in the corner.
 */
import { expect, test } from '@playwright/test';
import { api, bootToMenu, waitForScene } from './helpers';

test.describe('top-down visual overhaul (surface-z1)', () => {
  test('assets are same-origin, present, and correctly keyed', async ({ page }) => {
    const offOrigin: string[] = [];
    const notFound: string[] = [];
    page.on('request', (r) => {
      const u = r.url();
      // blob:/data: are locally-generated (procedural textures) — same-origin by
      // construction. What must never happen is a request to a REMOTE host.
      if (!/^https?:/i.test(u)) return;
      if (r.resourceType() !== 'image' && !u.includes('/assets/')) return;
      if (!u.startsWith('http://localhost:4173')) offOrigin.push(u);
    });
    page.on('response', (r) => {
      if (r.status() === 404 && r.url().includes('/assets/')) notFound.push(r.url());
    });

    await bootToMenu(page);
    await api(page, `api.enterSweep('surface-z1')`);
    await waitForScene(page, 'SweepScene');

    // NO RUNTIME HOTLINKS. Every asset must come from our own origin.
    expect(offOrigin, `off-origin asset requests: ${offOrigin.join(', ')}`).toEqual([]);
    expect(notFound, `missing assets: ${notFound.join(', ')}`).toEqual([]);

    // Every declared key must resolve to real art, not the __MISSING checkerboard.
    const td = await api(page, 'api.getTdVisualState()');
    expect(td.missingTextures, `texture keys resolving to __MISSING: ${td.missingTextures.join(', ')}`).toEqual([]);
  });

  test('objective flow is unchanged and the arena can be completed', async ({ page }) => {
    await bootToMenu(page);
    await api(page, `api.enterSweep('surface-z1')`);
    await waitForScene(page, 'SweepScene');

    const before = await api(page, 'api.getSweepState()');
    expect(before.enemies).toBeGreaterThan(0);

    // The HUD is DOM and reflects the objective.
    await expect(page.locator('#sweep-hud-dom')).toBeVisible();
    await expect(page.locator('#sweep-hud-dom .td-objective-title')).toContainText(/CHARGE THE SIGNAL NODE/i);

    // Charging the node opens the breach, and stepping into it Folds onward to
    // Miller Field. That full path is the zone's actual progression gate, so
    // assert the transition rather than an intermediate HUD string.
    await api(page, 'api.completeBlipstreamPuzzle()'); // in the Sweep: force-open the breach
    await waitForScene(page, 'FieldScene');
    const after = await api(page, 'api.getTdVisualState()');
    expect(after.bufferW, 'backbuffer leaked through the Fold').toBe(480);
  });

  test('the hi-res backbuffer never leaks out of the Sweep', async ({ page }) => {
    await bootToMenu(page);
    expect((await api(page, 'api.getTdVisualState()')).bufferW).toBe(480);

    await api(page, `api.enterSweep('surface-z1')`);
    await waitForScene(page, 'SweepScene');

    // Whatever density was chosen, the VISIBLE WORLD must be unchanged: the
    // camera zoom scales with the buffer, so world-units-per-screen is constant.
    const inSweep = await api(page, 'api.getTdVisualState()');
    expect(inSweep.bufferW % 480).toBe(0);
    // world units across the viewport — must match the shipped 0.82 framing
    expect(inSweep.bufferW / inSweep.zoom).toBeCloseTo(480 / 0.82, 0);

    // Leave by the normal route and confirm the buffer is restored.
    await api(page, `api.enterZone('miller-field')`);
    await waitForScene(page, 'FieldScene');
    const after = await api(page, 'api.getTdVisualState()');
    expect(after.bufferW, 'backbuffer leaked out of SweepScene').toBe(480);
  });

  test('side-view HUD chrome returns after leaving the Sweep', async ({ page }) => {
    await bootToMenu(page);
    await api(page, `api.enterSweep('surface-z1')`);
    await waitForScene(page, 'SweepScene');
    // the world owns the screen in top-down
    await expect(page.locator('#status-strip')).toBeHidden();

    await api(page, `api.enterZone('miller-field')`);
    await waitForScene(page, 'FieldScene');
    // ...and the side-scrolling shell is fully restored
    await expect(page.locator('#status-strip')).toBeVisible();
    await expect(page.locator('#sweep-hud-dom')).toBeHidden();
  });
});
