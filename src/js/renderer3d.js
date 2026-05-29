import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls, container;
let objects = [];

const CELL_COLORS = [0x3a5a9a,0x3a6a8a,0x3a7a7a,0x4a7a5a,0x6a6a3a,0x8a4a3a,0x7a3a4a,0x5a3a7a];

function makeSprite(text) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8a832';
  ctx.font = 'bold 26px JetBrains Mono,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(18, 9, 1);
  return sp;
}

export function init3D(el) {
  if (renderer) return;
  container = el;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0e14);

  const rect = el.getBoundingClientRect();
  camera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 10000);
  camera.position.set(500, 400, 500);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(rect.width, rect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  el.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  scene.add(new THREE.AmbientLight(0x404060, 0.6));
  const dl = new THREE.DirectionalLight(0xffffff, 0.8);
  dl.position.set(300, 500, 200);
  scene.add(dl);

  scene.add(new THREE.GridHelper(1000, 40, 0x2a2f45, 0x1a1e2e));

  (function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  })();
}

export function resize3D() {
  if (!renderer || !container) return;
  const rect = container.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

export function render3D(result, params) {
  if (!scene) return;
  // Remove old
  objects.forEach(o => {
    scene.remove(o);
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
  objects = [];

  if (!result?.best) return;

  const { best } = result;
  const { ori, rows, cols, positions, wOD, rsv } = best;
  const { compartment: comp, bms, seriesCount: sN } = params;
  const sT = comp.shellT;

  // Compartment wireframe
  const cg = new THREE.BoxGeometry(comp.L, comp.H, comp.W);
  const ce = new THREE.EdgesGeometry(cg);
  const cl = new THREE.LineSegments(ce, new THREE.LineBasicMaterial({ color: 0xe8a832, opacity: 0.4, transparent: true }));
  cl.position.set(comp.L / 2, comp.H / 2, comp.W / 2);
  scene.add(cl); objects.push(cl);

  // Semi-transparent compartment
  const cm = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xe8a832, transparent: true, opacity: 0.03, side: THREE.DoubleSide }));
  cm.position.copy(cl.position);
  scene.add(cm); objects.push(cm);

  // BMS
  const bg = new THREE.BoxGeometry(bms.L, bms.H, bms.W);
  const bm = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0x2a7a2a }));
  bm.position.set(sT + bms.L / 2 + 4, sT + bms.H / 2, comp.W / 2);
  scene.add(bm); objects.push(bm);

  // Cells
  const cellsY0 = sT + (comp.W - 2 * sT - rows * ori.W - (rows - 1) * 1) / 2;
  positions.forEach((pos, i) => {
    const geo = new THREE.BoxGeometry(ori.L, ori.H, ori.W);
    const mat = new THREE.MeshStandardMaterial({ color: CELL_COLORS[i % CELL_COLORS.length] });
    const mesh = new THREE.Mesh(geo, mat);
    const cx = sT + rsv.L + pos.x + pos.w / 2;
    const cy = sT + ori.H / 2;
    const cz = sT + cellsY0 + pos.y + pos.w / 2;
    mesh.position.set(cx, cy, cz);
    scene.add(mesh); objects.push(mesh);

    const sp = makeSprite(`S${pos.sn}`);
    sp.position.set(cx, cy + ori.H / 2 + 8, cz);
    scene.add(sp); objects.push(sp);
  });

  // Wire tubes
  const wR = wOD * 0.3;
  if (positions.length > 1) {
    const first = positions[0], last = positions[positions.length - 1];
    const mY = comp.H + 18;
    const bmsCx = sT + bms.L / 2 + 4;
    const fCx = sT + rsv.L + first.x + first.w * 0.25;
    const lCx = sT + rsv.L + last.x + last.w * 0.75;
    const fCz = sT + cellsY0 + first.y + first.h / 2;
    const lCz = sT + cellsY0 + last.y + last.h / 2;

    // Positive
    const pPts = [new THREE.Vector3(fCx, comp.H + 5, fCz), new THREE.Vector3(fCx, mY, comp.W / 2), new THREE.Vector3(bmsCx, mY, comp.W / 2)];
    const pCurve = new THREE.CatmullRomCurve3(pPts);
    const pTube = new THREE.Mesh(new THREE.TubeGeometry(pCurve, 20, wR, 8, false), new THREE.MeshStandardMaterial({ color: 0xff4d4f }));
    scene.add(pTube); objects.push(pTube);

    // Negative
    const nPts = [new THREE.Vector3(lCx, comp.H + 5, lCz), new THREE.Vector3(lCx, mY + 5, comp.W / 2), new THREE.Vector3(bmsCx, mY + 5, comp.W / 2)];
    const nCurve = new THREE.CatmullRomCurve3(nPts);
    const nTube = new THREE.Mesh(new THREE.TubeGeometry(nCurve, 20, wR, 8, false), new THREE.MeshStandardMaterial({ color: 0x4096ff }));
    scene.add(nTube); objects.push(nTube);
  }

  // Camera
  camera.position.set(comp.L * 1.3, comp.H * 1.5, comp.W * 1.3);
  controls.target.set(comp.L / 2, comp.H / 2, comp.W / 2);
  controls.update();
}

export function dispose3D() {
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
    renderer = null; scene = null; camera = null; controls = null;
    objects = [];
  }
}
