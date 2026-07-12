/**
 * RetroFX — parametric retro/pixel post-process for the MainMenu camera.
 * Presets (RETRO_PRESETS in config.ts): Game Boy (4-tone green ramp + Bayer
 * dither), 1-Bit Dither, Lo-Fi (per-channel palette crush), CRT Scanline.
 * WebGL only.
 */
import Phaser from 'phaser';
import { RETRO_PRESETS } from '../config';

const fragShader = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform vec3 uLoCol, uHiCol;
uniform float uMode, uLevels, uDither, uScan, uStrength;
varying vec2 outTexCoord;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec2 uv = outTexCoord;
  vec3 scene = texture2D(uMainSampler, uv).rgb;
  vec2 pp = floor(uv * uResolution);
  float d = (bayer4(pp) - 0.5) * uDither / uLevels;

  vec3 col;
  if (uMode < 1.5) {
    // gameboy(0) / 1-bit dither(1): luma ramp between two colors
    float l = clamp(luma(scene) + d, 0.0, 1.0);
    float q = clamp(floor(l * uLevels) / (uLevels - 1.0), 0.0, 1.0);
    col = mix(uLoCol, uHiCol, q);
  } else if (uMode < 2.5) {
    // lofi(2): per-channel palette crush
    col = floor((scene + d) * uLevels) / uLevels;
  } else {
    // crt(3): gentle quantize + scanlines
    col = floor(scene * uLevels + 0.5) / uLevels;
  }

  if (uScan > 0.5) {
    col *= 0.82 + 0.18 * sin(uv.y * uResolution.y * 3.14159);
    float m = mod(uv.x * uResolution.x, 3.0);
    col *= vec3(1.0 - 0.06 * step(1.5, m), 1.0, 1.0 - 0.06 * step(m, 0.5));
  }
  gl_FragColor = vec4(mix(scene, clamp(col, 0.0, 1.0), uStrength), 1.0);
}
`;

export class RetroFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  preset = 'gameboy';
  strength = 1;

  constructor(game: Phaser.Game) {
    super({ game, fragShader });
  }

  onPreRender(): void {
    const p = RETRO_PRESETS[this.preset] ?? RETRO_PRESETS.gameboy;
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.set1f('uStrength', this.strength);
    this.set3f('uLoCol', p.loCol[0], p.loCol[1], p.loCol[2]);
    this.set3f('uHiCol', p.hiCol[0], p.hiCol[1], p.hiCol[2]);
    this.set1f('uMode', p.mode);
    this.set1f('uLevels', p.levels);
    this.set1f('uDither', p.dither);
    this.set1f('uScan', p.scan);
  }
}
