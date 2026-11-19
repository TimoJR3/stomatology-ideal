import * as THREE from '../vendor/three-0.160.0/three.module.min.js';
import { RoomEnvironment } from '../vendor/three-0.160.0/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/three-0.160.0/RoundedBoxGeometry.js';

const root = document.documentElement;
const canvas = document.getElementById('tooth-canvas');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const small = () => innerWidth < 860;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  root.classList.add('no-3d');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, small() ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 14);

scene.add(new THREE.HemisphereLight(0xe6eef8, 0x0a0f18, 0.7));
const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 5, 6); scene.add(key);
const rim = new THREE.DirectionalLight(0x86a6dc, 2.4); rim.position.set(-6, 2, -5); scene.add(rim);

/* ---------- Зуб: деформированная сфера ---------- */
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function toothGeometry(seg) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.8));
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const { x, y, z } = v;
    let nx = x, ny = y, nz = z;
    // коронка шире и «квадратнее»
    const k = 1 + 0.13 * Math.exp(-Math.pow((y - 0.35) / 0.5, 2));
    nx *= k; nz *= k;
    // ложбинка сверху: два бугорка, как на логотипе
    if (y > 0) ny -= 0.24 * Math.exp(-(x * x) / 0.07) * Math.pow(y, 4);
    // шейка
    const neck = Math.exp(-Math.pow((y + 0.22) / 0.24, 2));
    nx *= 1 - 0.09 * neck; nz *= 1 - 0.09 * neck;
    // два корня
    if (y < 0) {
      const t = Math.min(1, -y);
      const ax = Math.abs(x), side = Math.sign(x) || 1;
      const g1 = sstep(0.04, 0.5, ax);
      ny -= 1.15 * Math.pow(t, 1.6) * g1;
      const taper = 0.55 * t * t * g1;
      nx += (side * 0.44 - nx) * taper;
      nz *= 1 - 0.42 * t * t * g1;
    }
    nz *= 0.8;
    p.setXYZ(i, nx, ny, nz);
  }
  g.computeBoundingBox();
  const bb = g.boundingBox;
  g.translate(0, -(bb.max.y + bb.min.y) / 2, 0);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

const seg = small() ? 96 : 160;
const tGeo = toothGeometry(seg);
const TOOTH_H = tGeo.boundingBox.max.y - tGeo.boundingBox.min.y;

const enamel = new THREE.MeshPhysicalMaterial({
  color: 0xf4f6f9, roughness: 0.3, metalness: 0,
  clearcoat: 1, clearcoatRoughness: 0.18,
  sheen: 0.6, sheenColor: new THREE.Color(0xc4d6ee), sheenRoughness: 0.5
});
const metal = new THREE.MeshPhysicalMaterial({ color: 0x2c518f, metalness: 0.8, roughness: 0.26, clearcoat: 0.6 });
const steel = new THREE.MeshPhysicalMaterial({ color: 0xc9d3e0, metalness: 1, roughness: 0.22 });

const pose = new THREE.Group();
pose.add(new THREE.Mesh(tGeo, enamel));

// размеры коронки на высоте брекета
const yB = tGeo.boundingBox.max.y - TOOTH_H * 0.26;
let xMax = 0, zMax = 0;
{
  const p = tGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getY(i) - yB) < 0.04) { xMax = Math.max(xMax, Math.abs(p.getX(i))); zMax = Math.max(zMax, p.getZ(i)); }
  }
}
// брекет
const br = new THREE.Group();
const base = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.44, 0.1, 4, 0.04), metal);
br.add(base);
const wingGeo = new RoundedBoxGeometry(0.16, 0.14, 0.13, 3, 0.035);
for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
  const w = new THREE.Mesh(wingGeo, metal);
  w.position.set(sx * 0.13, sy * 0.125, 0.09);
  br.add(w);
}
br.position.set(0, yB, zMax + 0.02);
pose.add(br);
// дуга
const d = 0.13, pts = [];
for (let a = -1.15; a <= 1.1501; a += 0.115) pts.push(new THREE.Vector3((xMax + d) * Math.sin(a), yB, (zMax + d) * Math.cos(a)));
const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.032, 10), steel);
pose.add(wire);
for (const end of [pts[0], pts[pts.length - 1]]) {
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), steel);
  cap.position.copy(end); pose.add(cap);
}

const holder = new THREE.Group();
holder.add(pose);
scene.add(holder);

/* ---------- Движение по «точкам» на странице ---------- */
let mx = 0, my = 0;
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  mx = (e.clientX / innerWidth) * 2 - 1;
  my = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

function visibleSpots() {
  const sel = small() ? '[data-spot-m], .spot-hero' : '[data-spot]';
  return [...document.querySelectorAll(sel)].filter((el) => el.offsetParent !== null);
}
let spots = visibleSpots();

function readSpot(el) {
  const r = el.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, size: Math.min(r.height, r.width * 1.2), ry: +el.dataset.ry || 0, rx: +el.dataset.rx || 0 };
}

function target() {
  const s = spots.map(readSpot);
  const m = innerHeight * 0.5;
  let i = 0, e = 0;
  if (m <= s[0].cy) { i = 0; e = 0; }
  else if (m >= s[s.length - 1].cy) { i = s.length - 1; e = 0; }
  else {
    while (i < s.length - 2 && m >= s[i + 1].cy) i++;
    const t = (m - s[i].cy) / (s[i + 1].cy - s[i].cy);
    e = sstep(0.18, 0.82, t);
  }
  const a = s[i], b = s[Math.min(i + 1, s.length - 1)];
  const L = (p, q) => p + (q - p) * e;
  const hop = Math.sin(Math.PI * e);
  const still = reduceMotion.matches;
  return {
    x: L(a.cx, b.cx),
    y: L(a.cy, b.cy) - (still ? 0 : hop * 30),
    size: L(a.size, b.size) * (still ? 1 : 1 + hop * 0.12),
    ry: L(a.ry, b.ry) + (still ? 0 : (i + e) * Math.PI * 2),
    rx: L(a.rx, b.rx),
    rz: still ? 0 : -Math.sign(b.cx - a.cx) * hop * 0.35,
  };
}

const SNAP = new URLSearchParams(location.search).has('snap'); // для проверки: без плавного догоняния
const cur = { x: 0, y: 0, size: 0, ry: 0, rx: 0, rz: 0 };
let first = true, last = performance.now();
const tilt = { x: 0, y: 0 };

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const tg = target();
  if (first) { Object.assign(cur, tg); first = false; }
  const k = SNAP ? 1 : 1 - Math.exp(-dt * (reduceMotion.matches ? 30 : 9));
  for (const key of Object.keys(cur)) cur[key] += (tg[key] - cur[key]) * k;

  const H = innerHeight, W = innerWidth;
  const wpp = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z) / H;
  const t = now / 1000;
  const idle = reduceMotion.matches ? 0 : 1;

  tilt.x += (my * 0.18 - tilt.x) * k;
  tilt.y += (mx * 0.3 - tilt.y) * k;

  holder.position.set((cur.x - W / 2) * wpp, -(cur.y - H / 2 + idle * Math.sin(t * 1.3) * 5) * wpp, 0);
  holder.scale.setScalar((cur.size * wpp * 0.64) / TOOTH_H);
  pose.rotation.set(cur.rx + tilt.x + idle * Math.sin(t * 0.9) * 0.04, cur.ry + tilt.y + idle * Math.sin(t * 0.6) * 0.18, cur.rz);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function onResize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, small() ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  spots = visibleSpots();
}
addEventListener('resize', onResize);

requestAnimationFrame((n) => { last = n; frame(n); root.classList.add('has-3d'); });
