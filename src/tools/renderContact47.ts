import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type RenderFrame = { name: string; dataUrl: string };

declare global {
  interface Window {
    __CONTACT47_RENDER__?: { ready: boolean; error?: string; frames?: RenderFrame[]; sheet?: string };
  }
}

const params = new URLSearchParams(location.search);
const modelUrl = params.get('model') ?? '/assets/characters/contact47-tripo.glb';
const frameSize = Number(params.get('size') ?? 256);
const directions = ['south', 'southwest', 'west', 'northwest', 'north', 'northeast', 'east', 'southeast'];

window.__CONTACT47_RENDER__ = { ready: false };

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true,
  premultipliedAlpha: false,
});
renderer.setPixelRatio(1);
renderer.setSize(frameSize, frameSize, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1.28, 1.28, 1.35, -1.35, 0.01, 100);
camera.position.set(0, 1.25, 4.8);
camera.lookAt(0, 0, 0);

const hemi = new THREE.HemisphereLight(0xdce8ff, 0x182018, 1.7);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 2.8);
key.position.set(-3.2, 4.6, 4.2);
scene.add(key);

const rim = new THREE.PointLight(0xa8ff3e, 2.2, 5);
rim.position.set(2.2, 1.4, 2.3);
scene.add(rim);

const fill = new THREE.PointLight(0x3df0ff, 0.8, 4);
fill.position.set(-2.4, 0.9, 1.7);
scene.add(fill);

function normalize(root: THREE.Object3D): THREE.Group {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const group = new THREE.Group();
  group.add(root);
  const scale = 1.95 / Math.max(size.y, 0.001);
  root.position.set(-center.x, -box.min.y, -center.z);
  group.scale.setScalar(scale);
  group.position.y = -0.95;
  return group;
}

function trimCanvas(source: HTMLCanvasElement, pad = 8): HTMLCanvasElement {
  const working = document.createElement('canvas');
  working.width = source.width;
  working.height = source.height;
  const ctx = working.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, working.width, working.height);
  const keyed = document.createElement('canvas');
  keyed.width = working.width;
  keyed.height = working.height;
  keyed.getContext('2d')?.putImageData(pixels, 0, 0);

  let minX = working.width;
  let minY = working.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < working.height; y++) {
    for (let x = 0; x < working.width; x++) {
      if (pixels.data[(y * working.width + x) * 4 + 3] < 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (minX > maxX || minY > maxY) return source;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(working.width - 1, maxX + pad);
  maxY = Math.min(working.height - 1, maxY + pad);

  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const outCtx = out.getContext('2d');
  outCtx?.drawImage(keyed, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function snapshot(): string {
  renderer.render(scene, camera);
  return trimCanvas(renderer.domElement).toDataURL('image/png');
}

async function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return img;
}

async function makeSheetAsync(frames: RenderFrame[]): Promise<string> {
  const images = await Promise.all(frames.map((frame) => dataUrlToImage(frame.dataUrl)));
  const cellW = Math.max(...images.map((img) => img.width));
  const cellH = Math.max(...images.map((img) => img.height));
  const sheet = document.createElement('canvas');
  sheet.width = cellW * frames.length;
  sheet.height = cellH;
  const ctx = sheet.getContext('2d');
  if (!ctx) return '';
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    ctx.drawImage(img, i * cellW + (cellW - img.width) * 0.5, cellH - img.height);
  }
  return sheet.toDataURL('image/png');
}

new GLTFLoader().load(
  modelUrl,
  async (gltf) => {
    const model = normalize(gltf.scene);
    scene.add(model);
    const frames: RenderFrame[] = [];
    for (let i = 0; i < directions.length; i++) {
      model.rotation.y = -(i / directions.length) * Math.PI * 2;
      frames.push({ name: directions[i], dataUrl: snapshot() });
    }
    window.__CONTACT47_RENDER__ = { ready: true, frames, sheet: await makeSheetAsync(frames) };
  },
  undefined,
  (error) => {
    window.__CONTACT47_RENDER__ = { ready: true, error: error instanceof Error ? error.message : String(error) };
  }
);
