/**
 * Procedural reward icons — crisp, scalable inline SVG in the BLIP pixel idiom.
 * Everything is drawn on a 16×16 grid of rects (shape-rendering: crispEdges) so
 * icons stay pixel-sharp at any DOM size. Given an icon SEED + accent color we
 * return an `<svg>` string. No image assets, matching the game's all-procedural
 * art rule (see .claude/skills/procedural-pixel-art).
 */

/* ------------------------------- color helpers ----------------------------- */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb(c: [number, number, number]): string {
  return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function shade(hex: string, mul: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgb([r * mul, g * mul, b * mul]);
}
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgb([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

const INK = '#0a0f18';
const LIGHT = '#fff3c9';

/* -------------------------------- rect helper ------------------------------ */

type R = (x: number, y: number, w: number, h: number, fill: string, op?: number) => void;

function draw(fn: (r: R, c: { base: string; dark: string; light: string; ink: string }) => void, color: string): string {
  let out = '';
  const r: R = (x, y, w, h, fill, op = 1) =>
    (out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${op < 1 ? ` fill-opacity="${op}"` : ''}/>`);
  fn(r, { base: color, dark: shade(color, 0.62), light: mix(color, LIGHT, 0.55), ink: INK });
  return out;
}

/* --------------------------------- the icons ------------------------------- */
// Each entry draws a small emblem centered in the 16×16 field.

const ICONS: Record<string, (color: string) => string> = {
  /* currencies */
  dust: (c) => draw((r, p) => {
    const pts = [[3, 8], [6, 4], [9, 9], [12, 5], [7, 11], [4, 12], [10, 12], [13, 10]];
    pts.forEach(([x, y], i) => r(x, y, i % 2 ? 1 : 2, i % 2 ? 1 : 2, i % 3 === 0 ? p.light : p.base));
  }, c),
  shard: (c) => draw((r, p) => {
    r(7, 1, 2, 14, p.dark); r(6, 3, 4, 10, p.base); r(7, 3, 1, 8, p.light); r(5, 6, 6, 3, p.base); r(5, 6, 6, 1, p.light);
  }, c),

  /* stickers */
  blip: (c) => draw((r, p) => {
    r(3, 3, 10, 10, p.dark, 0.35); r(6, 6, 4, 4, p.base); r(6, 6, 2, 2, p.light); r(5, 5, 6, 1, p.base, 0.5); r(5, 10, 6, 1, p.base, 0.5);
  }, c),
  antenna: (c) => draw((r, p) => {
    r(7, 3, 2, 10, p.dark); r(3, 3, 3, 1, p.base); r(10, 3, 3, 1, p.base); r(5, 5, 2, 1, p.base); r(9, 5, 2, 1, p.base); r(6, 1, 4, 2, p.light);
  }, c),
  moon: (c) => draw((r, p) => {
    r(5, 2, 7, 12, p.base); r(5, 2, 7, 2, p.light); r(9, 2, 5, 12, p.ink); r(7, 5, 1, 1, p.dark); r(6, 9, 1, 1, p.dark);
  }, c),
  neon: (c) => draw((r, p) => {
    r(3, 4, 10, 7, p.dark); r(4, 5, 8, 5, p.base); r(5, 6, 1, 3, p.light); r(8, 6, 1, 3, p.light); r(7, 11, 2, 3, p.dark);
  }, c),
  pennant: (c) => draw((r, p) => {
    r(3, 3, 1, 11, p.dark); r(4, 4, 9, 2, p.base); r(4, 6, 7, 2, mix(c, LIGHT, 0.3)); r(4, 8, 5, 2, p.base); r(4, 4, 6, 1, p.light);
  }, c),
  crop: (c) => draw((r, p) => {
    r(6, 3, 4, 1, p.base); r(4, 5, 8, 1, p.base); r(3, 7, 10, 2, p.light); r(4, 10, 8, 1, p.base); r(6, 12, 4, 1, p.base);
  }, c),

  /* badge */
  badge: (c) => draw((r, p) => {
    r(5, 2, 6, 9, p.base); r(5, 2, 6, 2, p.light); r(4, 4, 1, 5, p.dark); r(11, 4, 1, 5, p.dark);
    r(5, 11, 2, 3, p.dark); r(9, 11, 2, 3, p.dark); r(7, 5, 2, 3, LIGHT);
  }, c),

  /* field note */
  note: (c) => draw((r, p) => {
    r(4, 2, 8, 12, LIGHT); r(4, 2, 8, 12, p.dark, 0.0); r(4, 2, 1, 12, p.dark); r(6, 5, 5, 1, p.base); r(6, 7, 5, 1, p.base); r(6, 9, 3, 1, p.base); r(4, 2, 8, 1, p.base);
  }, c),

  /* trail */
  trail: (c) => draw((r, p) => {
    r(11, 6, 4, 4, p.base); r(11, 6, 2, 2, p.light); r(8, 7, 2, 2, p.base, 0.8); r(5, 8, 2, 1, p.base, 0.6); r(2, 8, 2, 1, p.base, 0.35);
  }, c),

  /* scan ripple */
  ripple: (c) => draw((r, p) => {
    r(7, 7, 2, 2, p.light);
    [[5, 5, 6], [3, 3, 10], [2, 2, 12]].forEach(([x, y, s], i) => {
      const col = i === 0 ? p.base : p.base;
      r(x, y, s, 1, col, 1 - i * 0.25); r(x, y + (s as number) - 1, s, 1, col, 1 - i * 0.25);
      r(x, y, 1, s, col, 1 - i * 0.25); r(x + (s as number) - 1, y, 1, s, col, 1 - i * 0.25);
    });
  }, c),

  /* Pulse Carbine shot */
  pulse: (c) => draw((r, p) => {
    r(6, 6, 4, 4, p.base); r(6, 6, 2, 2, p.light); r(7, 2, 2, 3, p.base, 0.7); r(7, 11, 2, 3, p.base, 0.7); r(2, 7, 3, 2, p.base, 0.7); r(11, 7, 3, 2, p.base, 0.7);
  }, c),

  /* echo blink */
  echo: (c) => draw((r, p) => {
    r(4, 4, 5, 8, p.base); r(4, 4, 2, 8, p.light); r(8, 5, 5, 8, p.base, 0.4); r(8, 5, 2, 8, p.light, 0.4);
  }, c),

  /* skin / frequency */
  skin: (c) => draw((r, p) => {
    r(5, 2, 6, 5, p.base); r(5, 2, 6, 2, p.light); r(6, 4, 1, 1, p.ink); r(9, 4, 1, 1, p.ink);
    r(4, 7, 8, 5, p.base); r(4, 7, 8, 1, p.light); r(6, 12, 2, 2, p.dark); r(8, 12, 2, 2, p.dark);
  }, c),

  /* relic */
  relic: (c) => draw((r, p) => {
    r(6, 2, 4, 3, p.light); r(5, 5, 6, 7, p.base); r(6, 5, 1, 7, p.light); r(5, 5, 6, 1, p.light); r(4, 11, 8, 2, p.dark); r(7, 7, 2, 3, LIGHT, 0.8);
  }, c),

  /* medal */
  medal: (c) => draw((r, p) => {
    r(5, 1, 2, 5, '#d84a42'); r(9, 1, 2, 5, '#35d5ff'); r(5, 6, 6, 6, p.base); r(5, 6, 6, 2, p.light); r(7, 8, 2, 2, LIGHT); r(5, 6, 1, 6, p.dark);
  }, c),

  /* ---- caches ---- */
  'cache-small': (c) => cacheIcon(c, 1),
  'cache-scout': (c) => cacheIcon(c, 2),
  'cache-anomaly': (c) => cacheIcon(c, 3),
  'cache-broadcast': (c) => cacheIcon(c, 4),

  /* ---- trophies (shared cup base + emblem) ---- */
  'trophy-cache': (c) => trophy(c, 'cache'),
  'trophy-scan': (c) => trophy(c, 'scan'),
  'trophy-fragment': (c) => trophy(c, 'frag'),
  'trophy-route': (c) => trophy(c, 'route'),
  'trophy-drone': (c) => trophy(c, 'drone'),
  'trophy-node': (c) => trophy(c, 'node'),
  'trophy-boss': (c) => trophy(c, 'boss'),
  'trophy-secret': (c) => trophy(c, 'secret'),
  'trophy-storm': (c) => trophy(c, 'storm'),
  'trophy-combo': (c) => trophy(c, 'combo'),
  'trophy-skin': (c) => trophy(c, 'skin'),
  'trophy-archive': (c) => trophy(c, 'archive'),
  'trophy-crown': (c) => trophy(c, 'crown'),
  'trophy-refuse': (c) => trophy(c, 'refuse'),
  'trophy-dust': (c) => trophy(c, 'dust'),
};

/* cache = a bracketed container with a signal core; complexity grows with tier */
function cacheIcon(c: string, tier: number): string {
  return draw((r, p) => {
    r(3, 5, 10, 8, p.dark); // body
    r(3, 5, 10, 2, p.base); // lid
    r(3, 5, 10, 1, p.light);
    r(2, 4, 3, 1, p.base); r(11, 4, 3, 1, p.base); // corner brackets
    r(6, 8, 4, 4, p.base); r(7, 9, 2, 2, LIGHT); // core
    if (tier >= 2) { r(4, 12, 1, 1, p.light); r(11, 12, 1, 1, p.light); }
    if (tier >= 3) { r(1, 2, 2, 2, p.base, 0.7); r(13, 2, 2, 2, p.base, 0.7); }
    if (tier >= 4) { r(6, 1, 4, 2, p.light); r(7, 0, 2, 1, LIGHT); }
  }, c);
}

/* trophy = pixel cup + a tiny emblem in the bowl */
function trophy(c: string, emblem: string): string {
  return draw((r, p) => {
    // cup
    r(4, 2, 8, 5, p.base); r(4, 2, 8, 2, p.light); r(3, 3, 1, 2, p.base); r(12, 3, 1, 2, p.base);
    r(6, 7, 4, 2, p.dark); r(5, 9, 6, 2, p.base); r(5, 11, 6, 1, p.dark); r(4, 12, 8, 2, p.dark); r(4, 12, 8, 1, p.base);
    // emblem in the bowl (tiny, cream/ink)
    const e = LIGHT;
    switch (emblem) {
      case 'scan': case 'route': r(7, 3, 2, 3, e); r(6, 4, 4, 1, e); break;
      case 'frag': r(7, 2, 2, 2, e); r(6, 4, 4, 1, e); break;
      case 'boss': case 'refuse': r(6, 3, 1, 3, e); r(9, 3, 1, 3, e); r(7, 5, 2, 1, e); break;
      case 'crown': r(6, 2, 1, 4, e); r(8, 2, 1, 4, e); r(10, 2, 1, 4, e); r(6, 5, 5, 1, e); break;
      case 'dust': r(6, 3, 1, 1, e); r(9, 3, 1, 1, e); r(7, 5, 1, 1, e); r(10, 4, 1, 1, e); break;
      case 'node': r(7, 3, 2, 2, e); r(6, 2, 1, 1, e); r(9, 5, 1, 1, e); break;
      case 'storm': case 'combo': r(8, 2, 1, 2, e); r(7, 4, 1, 2, e); r(6, 3, 3, 1, e); break;
      default: r(7, 3, 2, 3, e); // generic pip
    }
  }, c);
}

/* --------------------------------- public API ------------------------------ */

/** inner SVG markup for an icon seed + accent color (no <svg> wrapper). */
export function iconInner(seed: string, color: string): string {
  const fn = ICONS[seed] ?? ICONS.blip;
  return fn(color);
}

/** a full self-contained <svg> for an icon seed + accent color. */
export function iconSvg(seed: string, color: string, extraClass = ''): string {
  return (
    `<svg class="rw-svg ${extraClass}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" ` +
    `style="shape-rendering:crispEdges" aria-hidden="true">${iconInner(seed, color)}</svg>`
  );
}
