/**
 * GradeFX — parametric tone / color-grade post-process for the MainMenu camera.
 * One shader backs many filters via presets (GRADE_PRESETS in config.ts):
 * Noir, Sepia (duotone), Moonlight, Warm Dusk, Cool, Vintage (tint), Negative.
 * WebGL only.
 */
import Phaser from 'phaser';
import { GRADE_PRESETS } from '../config';

const fragShader = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform vec3 uTint, uDuoLow, uDuoHigh;
uniform float uDuo, uSat, uContrast, uInvert, uGrain, uStrength;
varying vec2 outTexCoord;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 uv = outTexCoord;
  vec3 orig = texture2D(uMainSampler, uv).rgb;
  vec3 col = orig;
  col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
  float l = luma(col);

  vec3 duo = mix(uDuoLow, uDuoHigh, smoothstep(0.0, 1.0, l));
  vec3 tinted = clamp(mix(vec3(l), col, uSat) * uTint, 0.0, 1.0);
  col = mix(tinted, duo, uDuo);
  col = mix(col, 1.0 - col, uInvert);

  float n = fract(sin(dot(floor(uv * uResolution), vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * uGrain;
  gl_FragColor = vec4(mix(orig, clamp(col, 0.0, 1.0), uStrength), 1.0);
}
`;

export class GradeFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  preset = 'noir';
  strength = 1;

  constructor(game: Phaser.Game) {
    super({ game, fragShader });
  }

  onPreRender(): void {
    const p = GRADE_PRESETS[this.preset] ?? GRADE_PRESETS.noir;
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.set1f('uStrength', this.strength);
    this.set3f('uTint', p.tint[0], p.tint[1], p.tint[2]);
    this.set3f('uDuoLow', p.duoLow[0], p.duoLow[1], p.duoLow[2]);
    this.set3f('uDuoHigh', p.duoHigh[0], p.duoHigh[1], p.duoHigh[2]);
    this.set1f('uDuo', p.duo);
    this.set1f('uSat', p.sat);
    this.set1f('uContrast', p.contrast);
    this.set1f('uInvert', p.invert);
    this.set1f('uGrain', p.grain);
  }
}
