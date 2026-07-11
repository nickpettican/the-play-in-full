// World building: periodic terrain, vegetation, water, architecture; one builder per location.
import * as THREE from 'three';
import { scene, loadModel, instantiate, setFogRange } from './engine.js';
import { player } from './player.js';

// ---------- periodic value noise (tileable => seamless world wrap) ----------
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 144665) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function periodicNoise(x, z, period, seed) {
  // lattice wrapped modulo period -> tileable
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const w = (i) => ((i % period) + period) % period;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(w(xi), w(zi), seed), b = hash2(w(xi + 1), w(zi), seed);
  const c = hash2(w(xi), w(zi + 1), seed), d = hash2(w(xi + 1), w(zi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export let world = null;
const _dryC = new THREE.Color(0xa8905a);

class World {
  constructor({ size = 280, hills = 1.6, seed = 7, baseColor = 0x7aa15a, dirtColor = 0x9a8a5a, baseHeight = 0 }) {
    this.size = size; this.seed = seed; this.hills = hills; this.baseHeight = baseHeight;
    this.flats = [];        // {x,z,r,h} circular blend-to-height
    this.colliders = [];    // {x,z,r,h?}
    this.camBlockers = [];
    this.group = new THREE.Group();
    this.spots = {};
    this.updaters = [];
    this.baseColor = new THREE.Color(baseColor);
    this.dirtColor = new THREE.Color(dirtColor);
    scene.add(this.group);
  }
  noiseHeight(x, z) {
    const S = this.size;
    // map world coords to noise domain, 3 octaves, all periodic over S
    let h = this.baseHeight, amp = this.hills, freq = 8 / S;
    for (let o = 0; o < 3; o++) {
      const per = Math.max(2, Math.round(S * freq));
      h += (periodicNoise((x + S / 2) * freq, (z + S / 2) * freq, per, this.seed + o * 131) - 0.5) * 2 * amp;
      amp *= 0.45; freq *= 2.7;
    }
    return h;
  }
  groundHeight = (x, z) => {
    let h = this.noiseHeight(x, z);
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r) {
        const core = f.core || 0;
        const k = d <= core ? 1 : 1 - (d - core) / (f.r - core);
        const s = k * k * (3 - 2 * k);
        h = h + (f.h - h) * s;
      }
    }
    return h;
  };
  flatten(x, z, r, h = 0, core = 0) { this.flats.push({ x, z, r, h, core }); }
  addCollider(x, z, r, h) { this.colliders.push({ x, z, r, h }); }

  buildTerrain() {
    const S = this.size, seg = 140;
    const geo = new THREE.PlaneGeometry(S, S, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), grass = this.baseColor, dirt = this.dirtColor;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.groundHeight(x, z);
      pos.setY(i, h);
      const n = periodicNoise((x + S / 2) * 0.15, (z + S / 2) * 0.15, Math.round(S * 0.15), this.seed + 999);
      c.copy(grass).lerp(dirt, THREE.MathUtils.clamp(n * 0.9 + h * 0.12, 0, 1) * 0.55);
      c.multiplyScalar(0.92 + n * 0.16);
      // dry, earthy patches (e.g. the austerity grounds)
      for (const dp of this.dryPatches || []) {
        const dd = Math.hypot(x - dp.x, z - dp.z);
        if (dd < dp.r) c.lerp(_dryC, Math.min(1, (1 - dd / dp.r) * 1.5) * 0.85);
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    this.group.add(m);
    this.terrain = m;
    // 8 wrap clones for seamless edges
    for (const [ox, oz] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      const cl = m.clone();
      cl.position.set(ox * S, 0, oz * S);
      cl.receiveShadow = true;
      this.group.add(cl);
    }
    this.camBlockers.push(m);
  }

  scatterGrass(n = 3000, exclude = []) {
    const S = this.size;
    // rounded shrub tufts rather than spiky blades
    const geo = new THREE.IcosahedronGeometry(0.16, 0);
    geo.scale(1, 0.72, 1);
    geo.translate(0, 0.1, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6f9a4f, flatShading: true });
    const im = new THREE.InstancedMesh(geo, mat, n);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), e = new THREE.Euler();
    const col = new THREE.Color();
    let placed = 0, guard = 0;
    while (placed < n && guard++ < n * 4) {
      const x = (Math.random() - 0.5) * S, z = (Math.random() - 0.5) * S;
      if (exclude.some(f => Math.hypot(x - f.x, z - f.z) < f.r)) continue;
      const y = this.groundHeight(x, z);
      if (y < this.waterLevel + 0.15) continue;
      e.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
      q.setFromEuler(e);
      const s = 0.7 + Math.random() * 1.1;
      sc.set(s, s * (0.7 + Math.random() * 0.8), s);
      M.compose(new THREE.Vector3(x, y, z), q, sc);
      im.setMatrixAt(placed, M);
      col.setHSL(0.24 + Math.random() * 0.06, 0.45, 0.3 + Math.random() * 0.18);
      im.setColorAt(placed, col);
      placed++;
    }
    im.count = placed;
    this.group.add(im);
  }

  addWater(y = -0.4) {
    this.waterLevel = y;
    const S = this.size * 3;
    const mat = new THREE.MeshLambertMaterial({
      color: 0x3f6f8a, transparent: true, opacity: 0.82, emissive: 0x0a1c26,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(S, S, 32, 32), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    this.group.add(m);
    this.water = m;
    this.updaters.push((dt, t) => {
      m.position.y = y + Math.sin(t * 0.6) * 0.03;
    });
  }

  dispose() {
    scene.remove(this.group);
    this.group.traverse(o => {
      if (o.isMesh) { o.geometry.dispose?.(); }
    });
  }
  update(dt, t) { for (const u of this.updaters) u(dt, t); }
}
World.prototype.waterLevel = -999;

// ---------- procedural props ----------
function proceduralTree(flower = false) {
  const g = new THREE.Group();
  const trunkH = 1.6 + Math.random() * 1.6;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.16, trunkH, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2e, flatShading: true }));
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const leafC = flower
    ? [0xd88aa0, 0xe8a8b8, 0xf0d0d8][(Math.random() * 3) | 0]
    : [0x4a7a3a, 0x5a8a42, 0x6f9a4f, 0x3f6f35][(Math.random() * 4) | 0];
  const nBlobs = 2 + (Math.random() * 3 | 0);
  for (let i = 0; i < nBlobs; i++) {
    const r = 0.7 + Math.random() * 0.8;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0),
      new THREE.MeshLambertMaterial({ color: leafC, flatShading: true }));
    b.position.set((Math.random() - 0.5) * 1.2, trunkH + (Math.random() - 0.2) * 0.9, (Math.random() - 0.5) * 1.2);
    b.castShadow = true;
    g.add(b);
  }
  trunk.castShadow = true;
  return g;
}

function house() {
  const g = new THREE.Group();
  const w = 3.9 + Math.random() * 3, d = 3.6 + Math.random() * 2.4, h = 2.2 + Math.random() * 0.8;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: [0xcfb98a, 0xc4a878, 0xd8c9a0][(Math.random() * 3) | 0], flatShading: true }));
  wall.position.y = h / 2;
  g.add(wall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.3, 4),
    new THREE.MeshLambertMaterial({ color: [0x9a5a35, 0x8a5030, 0x7a5838][(Math.random() * 3) | 0], flatShading: true }));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + 0.65;
  g.add(roof);
  const dh = Math.min(2.2, h - 0.2);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, dh, 0.06),
    new THREE.MeshLambertMaterial({ color: 0x4a3220 }));
  door.position.set(0, dh / 2, d / 2 + 0.02);
  g.add(door);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// Open pillared palace (mandapa) in an Indian idiom: red sandstone, scalloped
// column bays, jali railings, chhatri cupolas, onion dome resting on the roof.
// Terrain is flattened into a plateau beneath it so the player can walk inside.
function proceduralPalace(W, x, z, floorH) {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: 0xc96a45, flatShading: true });      // red sandstone
  const stoneDark = new THREE.MeshLambertMaterial({ color: 0xa9502f, flatShading: true });
  const cream = new THREE.MeshLambertMaterial({ color: 0xf0e3c8, flatShading: true });      // white trim
  const red = new THREE.MeshLambertMaterial({ color: 0x8a3428, flatShading: true });
  const gold = new THREE.MeshLambertMaterial({ color: 0xd9a52c, emissive: 0x4a3510, flatShading: true });

  // plinth sinks into the plateau so nothing hangs over the slope
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(33, 2.4, 23), stoneDark);
  plinth.position.y = floorH - 1.2;
  g.add(plinth);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(30, 0.3, 20), cream);
  floor.position.y = floorH - 0.1;
  g.add(floor);
  const rug = new THREE.Mesh(new THREE.BoxGeometry(10, 0.06, 7), red);
  rug.position.set(0, floorH + 0.06, -1);
  g.add(rug);

  // colonnade around the perimeter (front open in the middle)
  const cols = [];
  for (let i = -3; i <= 3; i++) { cols.push([i * 4.2, -8.5]); if (Math.abs(i) > 0.5) cols.push([i * 4.2, 8.5]); }
  for (const s of [-1, 1]) for (let j = -1; j <= 1; j++) cols.push([s * 13.6, j * 5]);
  for (const [cx, cz] of cols) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 4.2, 8), stone);
    c.position.set(cx, floorH + 2.1, cz);
    g.add(c);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.34, 0.45, 8), cream); // lotus capital
    bell.position.set(cx, floorH + 4.4, cz);
    g.add(bell);
    // scalloped bracket arch hint: small angled slabs
    const brk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.5), stone);
    brk.position.set(cx, floorH + 4.75, cz);
    g.add(brk);
    W.addCollider(x + cx, z + cz, 0.55, undefined);
  }
  // jali railing between columns along the sides and back
  for (const [w, px, pz, ry] of [[27, 0, -8.5, 0], [11, -13.6, 0, Math.PI / 2], [11, 13.6, 0, Math.PI / 2]]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 0.18), cream);
    rail.position.set(px, floorH + 0.5, pz);
    rail.rotation.y = ry;
    g.add(rail);
  }
  // back wall with a frieze
  const wall = new THREE.Mesh(new THREE.BoxGeometry(29, 4.6, 0.8), stone);
  wall.position.set(0, floorH + 2.3, -9.4);
  g.add(wall);
  for (let wx = -14; wx <= 14; wx += 2.2) W.addCollider(x + wx, z - 9.4, 1.1);
  const frieze = new THREE.Mesh(new THREE.BoxGeometry(31.2, 0.5, 21.2), gold);
  frieze.position.y = floorH + 4.95;
  g.add(frieze);
  // roof slab with chhajja overhang + parapet of small merlons
  const ent = new THREE.Mesh(new THREE.BoxGeometry(32, 0.7, 22), stoneDark);
  ent.position.y = floorH + 5.45;
  g.add(ent);
  for (let mi = -7; mi <= 7; mi++) {
    for (const mz of [-10.7, 10.7]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.25), cream);
      m.position.set(mi * 2.1, floorH + 6.05, mz);
      g.add(m);
    }
    if (Math.abs(mi) <= 4) for (const mx of [-15.7, 15.7]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 0.8), cream);
      m.position.set(mx, floorH + 6.05, mi * 2.1);
      g.add(m);
    }
  }
  // central onion dome: a hemisphere resting ON the roof, drum beneath, finial above
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.4, 1.0, 14), cream);
  drum.position.y = floorH + 6.2;
  g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
  dome.scale.y = 0.85;
  dome.position.y = floorH + 6.7;
  g.add(dome);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.6, 8), gold);
  spire.position.y = floorH + 11.2;
  g.add(spire);
  // chhatri cupolas at the corners: slim pillars under a small dome
  for (const [sx, sz] of [[-13.5, -9], [13.5, -9], [-13.5, 9], [13.5, 9]]) {
    for (const [ox, oz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 6), cream);
      p.position.set(sx + ox, floorH + 6.45, sz + oz);
      g.add(p);
    }
    const capBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 2.2), cream);
    capBase.position.set(sx, floorH + 7.15, sz);
    g.add(capBase);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), red);
    cap.position.set(sx, floorH + 7.2, sz);
    g.add(cap);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), gold);
    fin.position.set(sx, floorH + 8.4, sz);
    g.add(fin);
  }
  // front steps and a small torana gateway
  for (let i = 0; i < 4; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(11 - i * 1.2, 0.3, 1.5), stoneDark);
    st.position.set(0, floorH - 0.9 + i * 0.3, 11.6 - i * 0.9);
    g.add(st);
  }
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.6, 8), cream);
    post.position.set(s * 3.4, floorH + 0.9, 13.6);
    g.add(post);
    W.addCollider(x + s * 3.4, z + 13.6, 0.4);
  }
  for (const ly of [2.4, 3.1]) {
    const lin = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.28, 0.5), cream);
    lin.position.set(0, floorH + ly, 13.6);
    g.add(lin);
  }
  g.position.set(x, 0, z);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  W.group.add(g);
  W.camBlockers.push(g);
  return g;
}

// A flat-topped rock platform to sit upon.
function rockSeat(W, x, z) {
  const g = new THREE.Group();
  const rockM = new THREE.MeshLambertMaterial({ color: 0x99917f, flatShading: true });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.0, 0.31, 9), rockM);
  top.position.y = 0.155;
  top.rotation.y = Math.random() * Math.PI;
  g.add(top);
  for (let i = 0; i < 3; i++) { // a few tumbled stones at the base
    const a = Math.random() * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15 + Math.random() * 0.18, 0), rockM);
    s.position.set(Math.cos(a) * 1.05, 0.1, Math.sin(a) * 1.05);
    s.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(s);
  }
  g.position.set(x, W.groundHeight(x, z), z);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  W.group.add(g);
  W.camBlockers.push(g);
  W.addCollider(x, z, 0.9, W.groundHeight(x, z) + 0.36);
  return g;
}

function stupa() {
  const g = new THREE.Group();
  const M = new THREE.MeshLambertMaterial({ color: 0xe8e0cc, flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.5, 12), M);
  base.position.y = 0.25; g.add(base);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), M);
  dome.position.y = 1.1; g.add(dome);
  const spireM = new THREE.MeshLambertMaterial({ color: 0xd9a52c, emissive: 0x3a2a08 });
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 8), spireM);
  spire.position.y = 2.6; g.add(spire);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function lotus(scale = 1) {
  const g = new THREE.Group();
  const pm = new THREE.MeshLambertMaterial({ color: 0xf2b8cc, emissive: 0x552233, flatShading: true });
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), pm);
    const a = i / 8 * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.1, 0.1, Math.sin(a) * 0.1);
    p.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    g.add(p);
  }
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0xf5d76e, emissive: 0x554411 }));
  c.position.y = 0.12; g.add(c);
  g.scale.setScalar(scale);
  return g;
}
export { lotus, stupa, proceduralTree };

// place a loaded model on the terrain
function placeModel(W, src, height, x, z, ry = 0, colliderR = 0, opts = {}) {
  const m = instantiate(src, height, opts);
  m.position.set(x, W.groundHeight(x, z) + (opts.sink || 0), z);
  m.rotation.y = ry;
  W.group.add(m);
  if (colliderR > 0) { W.addCollider(x, z, colliderR); W.camBlockers.push(m); }
  return m;
}

async function forest(W, treeNames, count, opts = {}) {
  const srcs = await Promise.all(treeNames.map(loadModel));
  const S = W.size;
  const exclude = opts.exclude || [];
  for (let i = 0; i < count; i++) {
    let x, z;
    if (opts.radius) { // cluster around a centre instead of the whole map
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * opts.radius;
      x = (opts.cx || 0) + Math.cos(a) * r; z = (opts.cz || 0) + Math.sin(a) * r;
    } else {
      x = (Math.random() - 0.5) * (S - 14); z = (Math.random() - 0.5) * (S - 14);
    }
    if (exclude.some(f => Math.hypot(x - f.x, z - f.z) < f.r)) continue;
    if (W.groundHeight(x, z) < W.waterLevel + 0.3) continue;
    if (Math.random() < (opts.proceduralRatio ?? 0.5)) {
      const t = proceduralTree(opts.flowering && Math.random() < 0.3);
      t.position.set(x, W.groundHeight(x, z), z);
      t.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.9;
      t.scale.setScalar(s);
      W.group.add(t);
      W.addCollider(x, z, 0.25 * s);
    } else {
      const src = srcs[(Math.random() * srcs.length) | 0];
      const h = (opts.treeH || 5) * (0.75 + Math.random() * 0.7);
      placeModel(W, src, h, x, z, Math.random() * Math.PI * 2, 0.4);
    }
  }
}

// ---------- world builders ----------

export async function buildJetaGrove() {
  const W = new World({ size: 300, hills: 1.4, seed: 11, baseColor: 0x6f9a50 });
  W.flatten(0, 0, 26, 0.2);          // clearing with the Buddha's tree
  W.flatten(-40, 30, 14, 0.5);
  W.buildTerrain();
  W.addWater(-1.6);
  // Buddha's banyan
  const banyan = await loadModel('banyan');
  placeModel(W, banyan, 18, 0, -6, 1.35, 2.0, { sink: -0.4 }); // turned so the trunk clears the seat
  W.spots.buddha = new THREE.Vector3(0, 0, -4.4);
  rockSeat(W, 0, -4.4);
  W.spots.buddhaLift = 0.31;
  W.spots.playerStart = new THREE.Vector3(2, 0, 22);
  await forest(W, ['mango', 'plain-tree', 'banyan'], 70, { exclude: [{ x: 0, z: -4, r: 16 }], treeH: 10, radius: 70 });
  await forest(W, ['mango', 'plain-tree'], 70, { exclude: [{ x: 0, z: -4, r: 16 }], treeH: 10, proceduralRatio: 0.7 });
  W.scatterGrass(2600, [{ x: 0, z: -4, r: 8 }]);
  const st = stupa();
  st.position.set(-30, W.groundHeight(-30, 22), 22);
  W.group.add(st); W.addCollider(-30, 22, 1.7); W.camBlockers.push(st);
  setFogRange(60, 240);
  return W;
}

export async function buildTushita() {
  const W = new World({ size: 260, hills: 0.9, seed: 23, baseColor: 0xd8c9a8, dirtColor: 0xe8d8b8 });
  W.flatten(0, 0, 40, 0.3);
  W.buildTerrain();
  W.terrain.material.color = new THREE.Color(0xfff0dd);
  // celestial palace, turned a quarter clockwise
  const pal = await loadModel('palace-temple');
  placeModel(W, pal, 22, 0, -34, -Math.PI / 2, 14);
  W.spots.palace = new THREE.Vector3(0, 0, -34);
  // gods as statues, flanking the pillar circle on either side, facing inwards
  const god1 = await loadModel('heavenly-god');
  const god2 = await loadModel('heavenly-god-02');
  const guanyin = await loadModel('guanyin');
  placeModel(W, god1, 6, -20, 0, Math.PI / 2, 1.2, { tint: new THREE.Color(1.15, 1.05, 0.9) });
  placeModel(W, god2, 6, 20, 0, -Math.PI / 2, 1.2, { tint: new THREE.Color(1.15, 1.05, 0.9) });
  placeModel(W, guanyin, 7, 0, -16, 0, 1.4, { tint: new THREE.Color(1.2, 1.1, 1.0) });
  // golden pillars ring
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const x = Math.cos(a) * 24, z = Math.sin(a) * 24;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 7, 8),
      new THREE.MeshLambertMaterial({ color: 0xe6c05a, emissive: 0x4a3510, flatShading: true }));
    p.position.set(x, W.groundHeight(x, z) + 3.5, z);
    p.castShadow = true;
    W.group.add(p);
    W.addCollider(x, z, 0.55);
    W.camBlockers.push(p);
  }
  // cloud banks (flattened spheres) drifting around the rim
  const cloudM = new THREE.MeshLambertMaterial({ color: 0xfff8ea, transparent: true, opacity: 0.85, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = 55 + Math.random() * 70;
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + Math.random() * 6, 0), cloudM);
    c.scale.y = 0.35;
    c.position.set(Math.cos(a) * r, 1 + Math.random() * 7, Math.sin(a) * r);
    W.group.add(c);
    const sp = 0.3 + Math.random() * 0.6, ph = Math.random() * 9;
    W.updaters.push((dt, t) => { c.position.y += Math.sin(t * 0.3 + ph) * 0.002; c.rotation.y += dt * 0.01 * sp; });
  }
  W.spots.bodhisattva = new THREE.Vector3(0, 0, -8);
  W.spots.playerStart = new THREE.Vector3(0, 0, 20);
  setFogRange(70, 230);
  return W;
}

export async function buildKapilavastu() {
  const W = new World({ size: 300, hills: 1.2, seed: 37, baseColor: 0x8a9a58, dirtColor: 0xb09a68 });
  W.flatten(0, -50, 42, 1.3, 24);   // palace plateau: flat under the whole footprint
  W.flatten(0, 20, 30, 0.2);    // town square
  W.flatten(0, 60, 12, 0.1);    // south road / gate
  W.buildTerrain();
  proceduralPalace(W, 0, -50, 1.32);
  W.spots.palace = new THREE.Vector3(0, 0, -44);
  W.spots.hall = new THREE.Vector3(0, 0, -51);   // inside the colonnade
  // the king's wall: Śuddhodana kept the prince shielded from the world
  {
    const wallM = new THREE.MeshLambertMaterial({ color: 0xc07a50, flatShading: true });
    const capM = new THREE.MeshLambertMaterial({ color: 0xf0e3c8, flatShading: true });
    const wallRun = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.ceil(len / 4);
      const ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      for (let i = 0; i < n; i++) {
        const tm = (i + 0.5) / n;
        const wx = x0 + (x1 - x0) * tm, wz = z0 + (z1 - z0) * tm;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(len / n + 0.15, 3.6, 1.0), wallM);
        seg.position.set(wx, W.groundHeight(wx, wz) + 1.8, wz);
        seg.rotation.y = ry;
        seg.castShadow = seg.receiveShadow = true;
        W.group.add(seg);
        W.camBlockers.push(seg);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(len / n + 0.15, 0.3, 1.3), capM);
        cap.position.set(wx, seg.position.y + 1.95, wz);
        cap.rotation.y = ry;
        W.group.add(cap);
      }
      for (let d = 0; d <= len; d += 1.8) {
        const t = d / len;
        W.addCollider(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 1.05);
      }
    };
    // widened so the training grounds fit inside the enclosure
    wallRun(-42, -22, -4.5, -22);   // front, left of the gate
    wallRun(4.5, -22, 42, -22);     // front, right of the gate
    wallRun(-42, -22, -42, -80);
    wallRun(42, -22, 42, -80);
    wallRun(-42, -80, 42, -80);
    // gate towers + lintel over the opening
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.4, 2.2), wallM);
      t.position.set(s * 5.4, W.groundHeight(s * 5.4, -22) + 2.7, -22);
      t.castShadow = true;
      W.group.add(t);
      W.camBlockers.push(t);
      W.addCollider(s * 5.4, -22, 1.6);
    }
    const lin = new THREE.Mesh(new THREE.BoxGeometry(13, 1.0, 1.6), capM);
    lin.position.set(0, W.groundHeight(0, -22) + 4.6, -22);
    W.group.add(lin);
    W.spots.palaceGate = new THREE.Vector3(0, 0, -22);
    // gate doors: they swing open only for the player, keeping the world out
    {
      const doorM = new THREE.MeshLambertMaterial({ color: 0x5a3a22, flatShading: true });
      const doorG = new THREE.Group();
      const hinges = [];
      for (const s of [-1, 1]) {
        const hinge = new THREE.Group();
        hinge.position.set(s * 4.3, W.groundHeight(s * 4.3, -22) + 2.1, -22);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(4.1, 4.2, 0.22), doorM);
        panel.position.x = -s * 2.05;
        panel.castShadow = true;
        hinge.add(panel);
        doorG.add(hinge);
        hinges.push([hinge, s]);
      }
      W.group.add(doorG);
      W.camBlockers.push(doorG);
      W.updaters.push((dt) => {
        const d = Math.hypot(player.pos.x, player.pos.z + 22);
        for (const [h, s] of hinges) {
          const want = d < 6 ? s * 1.45 : 0;
          h.rotation.y += (want - h.rotation.y) * Math.min(1, dt * 3);
        }
      });
      W.removeGate = () => { W.group.remove(doorG); W.removeGate = () => {}; };
    }
  }
  // town: houses along a road going south
  let hx = 0;
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    const z = 2 + (i >> 1) * 9 + (Math.random() - 0.5) * 2;
    const x = side * (7 + Math.random() * 7);
    const h = house();
    h.position.set(x, W.groundHeight(x, z), z);
    h.rotation.y = side > 0 ? -Math.PI / 2 + (Math.random() - .5) * .4 : Math.PI / 2 + (Math.random() - .5) * .4;
    W.group.add(h);
    W.addCollider(x, z, 2.4);
    W.camBlockers.push(h);
  }
  // city gate at south edge
  const gateM = new THREE.MeshLambertMaterial({ color: 0xb09468, flatShading: true });
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6.5, 1.6), gateM);
    t.position.set(s * 4, W.groundHeight(s * 4, 66) + 3.25, 66);
    t.castShadow = true;
    W.group.add(t); W.addCollider(s * 4, 66, 1.3); W.camBlockers.push(t);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(11, 1.2, 2), gateM);
  lintel.position.set(0, W.groundHeight(0, 66) + 6.4, 66);
  W.group.add(lintel);
  W.spots.gate = new THREE.Vector3(0, 0, 66);
  await forest(W, ['mango', 'plain-tree'], 55, {
    exclude: [{ x: 0, z: -51, r: 54 }, { x: 0, z: 25, r: 26 }, { x: 0, z: 60, r: 10 }], treeH: 8,
  });
  W.scatterGrass(1800, [{ x: 0, z: 20, r: 24 }, { x: 0, z: -30, r: 26 }]);
  W.spots.courtyard = new THREE.Vector3(0, 0, -32); // within the king's walls, before the palace
  W.spots.playerStart = new THREE.Vector3(4, 0, 0);
  setFogRange(60, 240);
  return W;
}

export async function buildLumbini() {
  const W = new World({ size: 260, hills: 1.0, seed: 51, baseColor: 0x69a055, dirtColor: 0x8aa060 });
  W.flatten(0, 0, 22, 0.3);
  W.buildTerrain();
  W.addWater(-1.2);
  const willow = await loadModel('willow');
  placeModel(W, willow, 16, 0, -5, 0.3, 1.6, { sink: -3.0 }); // roots below the turf
  W.spots.tree = new THREE.Vector3(0, 0, -5);
  W.spots.maya = new THREE.Vector3(0.9, 0, -4.2);
  await forest(W, ['willow'], 220, {
    exclude: [{ x: 0, z: -5, r: 13 }], treeH: 9, flowering: true, proceduralRatio: 1,
  });
  W.scatterGrass(3000, [{ x: 0, z: -4, r: 7 }]);
  // flower patches
  const fm = new THREE.MeshLambertMaterial({ color: 0xe86a8a, emissive: 0x300a14, flatShading: true });
  for (let i = 0; i < 200; i++) {
    const x = (Math.random() - 0.5) * 200, z = (Math.random() - 0.5) * 200;
    const y = W.groundHeight(x, z);
    if (y < W.waterLevel + 0.3) continue;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 5, 4), fm);
    f.position.set(x, y + 0.12, z);
    W.group.add(f);
  }
  W.spots.playerStart = new THREE.Vector3(-3, 0, 14);
  setFogRange(55, 220);
  return W;
}

export async function buildMagadha() {
  // lush green country with a broad river; only the austerity grounds are dry and earthy
  const W = new World({ size: 320, hills: 2.6, seed: 67, baseColor: 0x67994c, dirtColor: 0x8faa5e, baseHeight: 2.2 });
  // wide river running north-south, east of the Bodhi tree
  for (let z = -160; z <= 160; z += 10) W.flatten(30 + Math.sin(z * 0.04) * 8, z, 22, -2.2, 9);
  W.flatten(-8, -22, 20, 0.4);   // bodhi tree knoll
  W.flatten(2, -16, 12, 0.4);    // sujata's offering place, west bank by the tree
  W.flatten(-40, 30, 14, 0.8);   // austerity grounds (dry)
  W.flatten(-26, 44, 14, 0.9);
  W.flatten(-48, 14, 12, 0.7);
  W.flatten(66, -4, 22, 0.5);    // village, well back from the east bank
  W.dryPatches = [{ x: -38, z: 30, r: 36 }];
  W.buildTerrain();
  W.addWater(-1.1);
  const bodhi = await loadModel('bodhi-tree');
  placeModel(W, bodhi, 20, -7.2, -24, 0, 2.0, { sink: -3 }); // right behind the seat
  // the seat: east of the trunk, so he sits with his back to the tree, facing the river
  W.spots.bodhiTree = new THREE.Vector3(-5.2, 0, -24);
  rockSeat(W, -5.2, -24);
  W.spots.buddhaLift = 0.31;
  // rocky outcrops, clustered on the dry austerity side
  const rockM = new THREE.MeshLambertMaterial({ color: 0x8a7f6a, flatShading: true });
  for (let i = 0; i < 50; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 42;
    const x = -38 + Math.cos(a) * rr, z = 30 + Math.sin(a) * rr;
    const y = W.groundHeight(x, z);
    if (y < W.waterLevel + 0.4) continue;
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 1.8, 0), rockM);
    r.position.set(x, y + 0.1, z);
    r.rotation.set(Math.random(), Math.random() * 3, Math.random());
    r.castShadow = true;
    W.group.add(r);
    if (r.geometry.parameters.radius > 1.2) { W.addCollider(x, z, r.geometry.parameters.radius * 0.8); W.camBlockers.push(r); }
  }
  // lush forest, thick along both banks of the river, none on the dry grounds
  const dry = { x: -38, z: 30, r: 36 }, treeExcl = { x: -7.2, z: -24, r: 14 };
  await forest(W, ['plain-tree', 'mango'], 120, {
    exclude: [treeExcl, dry], treeH: 9, proceduralRatio: 0.75, radius: 65, cx: 0, cz: -10,
  });
  await forest(W, ['plain-tree', 'mango'], 90, {
    exclude: [treeExcl, dry], treeH: 9, proceduralRatio: 0.75, radius: 60, cx: 62, cz: 10,
  });
  await forest(W, ['plain-tree'], 80, {
    exclude: [treeExcl, dry], treeH: 8, proceduralRatio: 0.7,
  });
  W.scatterGrass(2400, [dry]);
  // village huts, well east of the wide river
  for (let i = 0; i < 6; i++) {
    const x = 62 + Math.random() * 14, z = -16 + i * 7;
    const h = house();
    h.scale.setScalar(0.8);
    h.position.set(x, W.groundHeight(x, z), z);
    h.rotation.y = Math.PI / 2;
    W.group.add(h);
    W.addCollider(x, z, 2);
    W.camBlockers.push(h);
  }
  W.spots.austerity = new THREE.Vector3(-40, 0, 30);
  W.spots.austerity2 = new THREE.Vector3(-26, 0, 44);
  W.spots.austerity3 = new THREE.Vector3(-48, 0, 14);
  W.spots.sujataSide = new THREE.Vector3(2, 0, -16);
  W.spots.playerStart = new THREE.Vector3(-30, 0, 46);
  setFogRange(70, 260);
  return W;
}

export async function buildDeerPark() {
  const W = new World({ size: 280, hills: 0.9, seed: 83, baseColor: 0x5f9a4a, dirtColor: 0x7f9a58, baseHeight: 0.8 });
  // river at west
  for (let z = -140; z <= 140; z += 12) W.flatten(-52 + Math.sin(z * 0.05) * 5, z, 10, -2.0);
  W.flatten(0, -8, 24, 0.35);  // teaching clearing
  W.buildTerrain();
  W.addWater(-1.0);
  const banyan = await loadModel('banyan');
  placeModel(W, banyan, 17, -3, -18, 0.9, 1.8, { sink: -0.4 });
  // teaching mound
  const moundM = new THREE.MeshLambertMaterial({ color: 0x86a55e, flatShading: true });
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 0.55, 12), moundM);
  mound.position.set(0, W.groundHeight(0, -10) + 0.27, -10);
  mound.receiveShadow = true;
  W.group.add(mound);
  W.camBlockers.push(mound);
  W.spots.dais = new THREE.Vector3(0, 0, -10);
  W.spots.ascetics = new THREE.Vector3(0, 0, -6);
  // bones near the river (charnel ground)
  const bones = await loadModel('bone-pile');
  placeModel(W, bones, 1.1, -44, 26, 1, 0.8);
  // dense garden woodland around the teaching clearing, thinning further out
  await forest(W, ['mango', 'willow', 'plain-tree', 'banyan'], 170, {
    exclude: [{ x: 0, z: -9, r: 17 }], treeH: 10, flowering: true, proceduralRatio: 0.85,
    radius: 75, cx: 4, cz: -6,
  });
  await forest(W, ['mango', 'plain-tree'], 130, {
    exclude: [{ x: 0, z: -9, r: 17 }], treeH: 10, flowering: true, proceduralRatio: 0.85,
  });
  W.scatterGrass(3200, [{ x: 0, z: -9, r: 10 }]);
  W.spots.buddhaWalkFrom = new THREE.Vector3(-24, 0, 24);
  W.spots.playerStart = new THREE.Vector3(8, 0, 12);
  setFogRange(55, 230);
  return W;
}

export async function buildKushinagar() {
  const W = new World({ size: 260, hills: 1.1, seed: 97, baseColor: 0x7a9058, dirtColor: 0x9a8a60 });
  W.flatten(0, -4, 20, 0.25);
  W.buildTerrain();
  const willow = await loadModel('willow');
  // twin sala trees, roots buried
  placeModel(W, willow, 15, -2.6, -6, 0.2, 1.5, { sink: -3 });
  placeModel(W, willow, 15, 2.6, -6, 2.4, 1.5, { sink: -3 });
  W.spots.couch = new THREE.Vector3(0, 0, -6);
  await forest(W, ['plain-tree', 'willow'], 70, { exclude: [{ x: 0, z: -6, r: 14 }], treeH: 9 });
  W.scatterGrass(2200, [{ x: 0, z: -5, r: 9 }]);
  const st = stupa();
  st.position.set(20, W.groundHeight(20, -30), -30);
  W.group.add(st); W.addCollider(20, -30, 1.7); W.camBlockers.push(st);
  W.spots.playerStart = new THREE.Vector3(0, 0, 12);
  setFogRange(50, 210);
  return W;
}

export const BUILDERS = {
  jeta: buildJetaGrove, tushita: buildTushita, kapilavastu: buildKapilavastu,
  lumbini: buildLumbini, magadha: buildMagadha, deerpark: buildDeerPark, kushinagar: buildKushinagar,
};

export async function switchWorld(name) {
  if (world) { world.dispose(); world = null; }
  world = await BUILDERS[name]();
  return world;
}
