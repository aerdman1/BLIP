/**
 * ComicFX — comic/ink post-process filter for menu and gameplay cameras. Presets:
 *   comic      — posterize (cel bands) + THIN ink outline + grain
 *   sketch     — ink lines only over a paper tone (no color fill)
 *   crosshatch — cel + ink + diagonal hatch in shadow areas
 * Outlines are kept thin for 480x270: high Sobel threshold, low strength, soft
 * ink. Tuned via COMIC_FX in config.ts. WebGL only.
 */
import Phaser from 'phaser';
import { COMIC_FX } from '../config';

const fragShader = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uLevels, uOutline, uThreshLo, uThreshHi, uGrain, uContrast, uSaturation, uHatch, uFill, uStrength;
varying vec2 outTexCoord;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 uv = outTexCoord;
  vec2 texel = 1.0 / uResolution;
  vec3 scene = texture2D(uMainSampler, uv).rgb;

  // base: posterized scene color, or a paper tone (sketch, uFill=0)
  vec3 col = clamp((scene - 0.5) * uContrast + 0.5, 0.0, 1.0);
  float l0 = luma(col);
  col = clamp(mix(vec3(l0), col, uSaturation), 0.0, 1.0);
  col = floor(col * uLevels + 0.5) / uLevels;
  col = mix(vec3(0.93, 0.9, 0.82), col, uFill);

  // Sobel edge -> THIN ink outline (only strong edges, soft strength)
  float tl = luma(texture2D(uMainSampler, uv + texel * vec2(-1.0, -1.0)).rgb);
  float tc = luma(texture2D(uMainSampler, uv + texel * vec2( 0.0, -1.0)).rgb);
  float tr = luma(texture2D(uMainSampler, uv + texel * vec2( 1.0, -1.0)).rgb);
  float ml = luma(texture2D(uMainSampler, uv + texel * vec2(-1.0,  0.0)).rgb);
  float mr = luma(texture2D(uMainSampler, uv + texel * vec2( 1.0,  0.0)).rgb);
  float bl = luma(texture2D(uMainSampler, uv + texel * vec2(-1.0,  1.0)).rgb);
  float bc = luma(texture2D(uMainSampler, uv + texel * vec2( 0.0,  1.0)).rgb);
  float br = luma(texture2D(uMainSampler, uv + texel * vec2( 1.0,  1.0)).rgb);
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float edge = smoothstep(uThreshLo, uThreshHi, sqrt(gx * gx + gy * gy)) * uOutline;
  col = mix(col, vec3(0.05, 0.06, 0.1), edge);

  // optional cross-hatch in shadow regions
  if (uHatch > 0.5) {
    float sl = luma(scene);
    vec2 p = uv * uResolution;
    float h1 = step(0.5, fract((p.x + p.y) / 4.0));
    float h2 = step(0.5, fract((p.x - p.y) / 4.0));
    float hatch = (sl < 0.35 ? h1 : 1.0) * (sl < 0.18 ? h2 : 1.0);
    col = mix(vec3(0.05, 0.06, 0.1), col, 0.4 + 0.6 * hatch);
  }

  float n = fract(sin(dot(floor(uv * uResolution), vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * uGrain;
  gl_FragColor = vec4(mix(scene, clamp(col, 0.0, 1.0), uStrength), 1.0);
}
`;

export class ComicFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  preset = 'comic';
  strength = 1;

  constructor(game: Phaser.Game) {
    super({ game, fragShader });
  }

  onPreRender(): void {
    const p = COMIC_FX[this.preset] ?? COMIC_FX.comic;
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.set1f('uStrength', this.strength);
    this.set1f('uLevels', p.levels);
    this.set1f('uOutline', p.outline);
    this.set1f('uThreshLo', p.threshLo);
    this.set1f('uThreshHi', p.threshHi);
    this.set1f('uGrain', p.grain);
    this.set1f('uContrast', p.contrast);
    this.set1f('uSaturation', p.saturation);
    this.set1f('uHatch', p.hatch);
    this.set1f('uFill', p.fill);
  }
}
