/**
 * Shared helpers for the BLIP AI QA pipeline.
 * All state access goes through window.__BLIP_TEST_API__ (enabled by ?test=1).
 */
import { expect, type Page } from '@playwright/test';

export interface ConsoleWatcher {
  errors: string[];
}

/** collect console errors + page errors (ignore benign noise) */
export function watchConsole(page: Page): ConsoleWatcher {
  const watcher: ConsoleWatcher = { errors: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // headless GPU rasterization warnings are environmental, not game bugs
      if (/GPU|SwiftShader|gl_|WebGL.*fallback/i.test(text)) return;
      watcher.errors.push(text);
    }
  });
  page.on('pageerror', (err) => watcher.errors.push(String(err)));
  return watcher;
}

/** load the game fresh (clean storage) and wait for the main menu */
export async function bootToMenu(page: Page): Promise<void> {
  await page.goto('/?test=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForScene(page, 'MainMenuScene');
}

/** load the game WITHOUT clearing storage (continue flows) */
export async function bootKeepingSave(page: Page): Promise<void> {
  await page.goto('/?test=1');
  await waitForScene(page, 'MainMenuScene');
}

export async function waitForScene(page: Page, scene: string, timeout = 20_000): Promise<void> {
  await page.waitForFunction(
    (target) => {
      const api = (window as never as Record<string, { getSceneName?: () => string }>).__BLIP_TEST_API__;
      return !!api && typeof api.getSceneName === 'function' && api.getSceneName() === target;
    },
    scene,
    { timeout }
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function api<T = any>(page: Page, script: string): Promise<T> {
  return (await page.evaluate(`(() => { const api = window.__BLIP_TEST_API__; return (${script}); })()`)) as T;
}

export async function startGame(page: Page, continueRun = false): Promise<void> {
  if (continueRun) await api(page, 'api.startGame(true)');
  else await api(page, `api.enterZone('miller-field')`);
  await waitForScene(page, 'SweepScene');
  // let the fade-in + first physics settle
  await page.waitForTimeout(700);
}

export async function playerState(page: Page): Promise<{
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  energy: number;
  grounded: boolean;
  facing: number;
  god: boolean;
  echoActive: boolean;
  echoX: number;
  echoY: number;
}> {
  const p = await api(page, 'api.getPlayerState()');
  expect(p, 'player should exist').not.toBeNull();
  return p;
}

export async function questStep(page: Page): Promise<string> {
  return api<string>(page, 'api.getQuestState().step');
}

/** hold a key for ms then release */
export async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

export async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(50);
  await page.keyboard.up(key);
}

export async function teleport(page: Page, checkpoint: string): Promise<void> {
  const ok = await api<boolean>(page, `api.teleportToCheckpoint('${checkpoint}')`);
  expect(ok, `teleport to ${checkpoint}`).toBe(true);
  await page.waitForTimeout(350);
}

export async function screenshotTo(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/screenshots/${name}.png` });
}
