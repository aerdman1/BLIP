import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const BASE_URL = process.env.CONTACT47_RENDER_URL ?? 'http://127.0.0.1:5173';
const OUT_DIR = path.join(ROOT, 'public/assets/characters');
const MODEL = '/assets/characters/contact47-tripo.glb';

function decodeDataUrl(dataUrl) {
  const [, payload] = dataUrl.split(',');
  return Buffer.from(payload, 'base64');
}

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await page.goto(`${BASE_URL}/character-render.html?model=${encodeURIComponent(MODEL)}&size=256`);
await page.waitForFunction(() => window.__CONTACT47_RENDER__?.ready === true, null, { timeout: 30000 });

const result = await page.evaluate(() => window.__CONTACT47_RENDER__);
await browser.close();

if (!result || result.error) {
  throw new Error(result?.error ?? 'CONTACT-47 render did not return data.');
}

for (const frame of result.frames ?? []) {
  await fs.writeFile(path.join(OUT_DIR, `contact47-tripo-${frame.name}.png`), decodeDataUrl(frame.dataUrl));
}
if (result.sheet) {
  await fs.writeFile(path.join(OUT_DIR, 'contact47-tripo-idle-8dir.png'), decodeDataUrl(result.sheet));
}

console.log(`Wrote ${(result.frames ?? []).length} frames and sheet to ${path.relative(ROOT, OUT_DIR)}`);
