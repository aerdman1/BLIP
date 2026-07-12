/**
 * HalftoneFX — comic halftone-print post-process for the MainMenu camera.
 * 45° dot screen sized by luminance. Presets (HALFTONE_FX in config.ts):
 * Halftone (ink dots on paper), Pop Art (dots over bold posterized color).
 * WebGL only.
 */
import Phaser from 'phaser';
import { HALFTONE_FX } from '../config';

const fragShader = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform vec3 uInk, uPaper;
uniform float uCell, uPopart, uStrength;
varying vec2 outTexCoord;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 uv = outTexCoord;
  vec3 scene = texture2D(uMainSampler, uv).rgb;
  vec2 px = uv * uResolution;

  // rotate 45 degrees for a classic halftone screen
  float a = 0.785398;
  mat2 R = mat2(cos(a), sin(a), -sin(a), cos(a));   // columns -> [[cos,-sin],[sin,cos]]
  mat2 Ri = mat2(cos(a), -sin(a), sin(a), cos(a));  // transpose (inverse rotation)
  vec2 rp = R * px;
  vec2 cell = floor(rp / uCell) * uCell + uCell * 0.5;

  // sample scene luminance at the cell centre (rotate the centre back to uv)
  float l = luma(texture2D(uMainSampler, (Ri * cell) / uResolution).rgb);
  float radius = (1.0 - l) * uCell * 0.72;
  float distToCentre = distance(rp, cell);
  float dotMask = 1.0 - smoothstep(radius - 0.6, radius + 0.6, distToCentre);

  vec3 popBase = clamp(floor(scene * 4.0 + 0.5) / 4.0 * 1.15, 0.0, 1.0);
  vec3 base = mix(uPaper, popBase, uPopart);
  vec3 col = mix(base, uInk, dotMask);
  gl_FragColor = vec4(mix(scene, clamp(col, 0.0, 1.0), uStrength), 1.0);
}
`;

export class HalftoneFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  preset = 'halftone';
  strength = 1;

  constructor(game: Phaser.Game) {
    super({ game, fragShader });
  }

  onPreRender(): void {
    const p = HALFTONE_FX[this.preset] ?? HALFTONE_FX.halftone;
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.set1f('uStrength', this.strength);
    this.set3f('uInk', p.ink[0], p.ink[1], p.ink[2]);
    this.set3f('uPaper', p.paper[0], p.paper[1], p.paper[2]);
    this.set1f('uCell', p.cell);
    this.set1f('uPopart', p.popart);
  }
}
