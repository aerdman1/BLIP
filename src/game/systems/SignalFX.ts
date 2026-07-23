/**
 * SignalFX — sci-fi / "signal" post-process for menu and gameplay cameras (on-brand
 * for a radar game). Presets (SIGNAL_PRESETS in config.ts): Night-Vision,
 * Thermal, Hologram, Interference. Uses uTime for the animated modes (frozen
 * under the preview's paused loop; animates on the user's machine). WebGL only.
 */
import Phaser from 'phaser';
import { SIGNAL_PRESETS } from '../config';

const fragShader = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform vec3 uTint;
uniform float uMode, uTime, uStrength;
varying vec2 outTexCoord;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 heat(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(vec3(0.0, 0.0, 0.12), vec3(0.15, 0.1, 0.75), smoothstep(0.0, 0.25, t));
  c = mix(c, vec3(0.8, 0.1, 0.6), smoothstep(0.25, 0.5, t));
  c = mix(c, vec3(1.0, 0.3, 0.0), smoothstep(0.5, 0.7, t));
  c = mix(c, vec3(1.0, 0.9, 0.2), smoothstep(0.7, 0.9, t));
  c = mix(c, vec3(1.0, 1.0, 1.0), smoothstep(0.9, 1.0, t));
  return c;
}

void main() {
  vec2 uv = outTexCoord;
  vec3 orig = texture2D(uMainSampler, uv).rgb;
  vec3 col;

  if (uMode < 0.5) {
    // night-vision: green phosphor + scanline + grain + vignette
    float l = pow(luma(texture2D(uMainSampler, uv).rgb), 0.75) * 1.3;
    float scan = 0.9 + 0.1 * sin(uv.y * uResolution.y * 2.0);
    float g = hash(floor(uv * uResolution) + uTime) * 0.15;
    float vig = smoothstep(0.9, 0.35, distance(uv, vec2(0.5)));
    col = uTint * (l * scan + g) * vig;
  } else if (uMode < 1.5) {
    // thermal: luminance -> heat gradient
    col = heat(pow(luma(texture2D(uMainSampler, uv).rgb), 0.85));
  } else if (uMode < 2.5) {
    // hologram: cyan + scanline flicker + chroma-split
    float sh = sin(uv.y * uResolution.y * 0.5 + uTime * 3.0) * 0.004;
    float r = texture2D(uMainSampler, uv + vec2(0.003 + sh, 0.0)).r;
    float g = texture2D(uMainSampler, uv).g;
    float b = texture2D(uMainSampler, uv - vec2(0.003 + sh, 0.0)).b;
    float l = luma(vec3(r, g, b));
    float scan = 0.75 + 0.25 * sin(uv.y * uResolution.y * 1.5 + uTime * 4.0);
    float flick = 0.9 + 0.1 * sin(uTime * 8.0);
    col = uTint * (0.3 + 0.9 * l) * scan * flick;
  } else {
    // interference: horizontal glitch bands + chroma-split + noise
    float band = floor(uv.y * 24.0);
    float shift = (hash(vec2(band, floor(uTime * 10.0))) - 0.5) * 0.06
      * step(0.6, hash(vec2(band * 1.3, floor(uTime * 7.0))));
    vec2 g = uv + vec2(shift, 0.0);
    float r = texture2D(uMainSampler, g + vec2(0.004, 0.0)).r;
    float gg = texture2D(uMainSampler, g).g;
    float b = texture2D(uMainSampler, g - vec2(0.004, 0.0)).b;
    col = vec3(r, gg, b);
    col += (hash(floor(uv * uResolution) + uTime) - 0.5) * 0.12;
    col *= 0.85 + 0.15 * sin(uv.y * uResolution.y * 3.14159);
  }
  gl_FragColor = vec4(mix(orig, clamp(col, 0.0, 1.0), uStrength), 1.0);
}
`;

export class SignalFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  preset = 'nightvision';
  strength = 1;

  constructor(game: Phaser.Game) {
    super({ game, fragShader });
  }

  onPreRender(): void {
    const p = SIGNAL_PRESETS[this.preset] ?? SIGNAL_PRESETS.nightvision;
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.set1f('uStrength', this.strength);
    this.set3f('uTint', p.tint[0], p.tint[1], p.tint[2]);
    this.set1f('uMode', p.mode);
    this.set1f('uTime', this.game.loop.time / 1000.0);
  }
}
