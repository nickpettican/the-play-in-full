// World building: periodic terrain, vegetation, water, architecture; one builder per location.
import * as THREE from 'three';
import { scene, loadModel, instantiate, setFogRange } from './engine.js';
import { player } from './player.js';
import { makeHorse, makePerson } from './characters.js';
import { petalsFrom } from './particles.js';

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
const _dryC = new THREE.Color(0xbd9a64);
//#919259
class World {
  constructor({ size = 280, hills = 1.6, seed = 7, baseColor = 0x28463f, dirtColor = 0x77784e, baseHeight = 0 }) {
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
  addCollider(x, z, r, h, b) { this.colliders.push({ x, z, r, h, b }); }
  // axis-aligned solid box: the player stands on its top and cannot walk through it
  addBlock(x0, x1, z0, z1, y0, y1) { (this.blocks ??= []).push({ x0, x1, z0, z1, y0, y1 }); }

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
    // shrub GLB tufts replace the old icosahedra; loaded async, so the
    // undergrowth pops in a beat after the terrain — harmless during the fade
    loadModel('shrub').then(shrub => {
      const im = new THREE.InstancedMesh(extractPlantGeo(shrub),
        new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), n);
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), e = new THREE.Euler();
      const col = new THREE.Color();
      let placed = 0, guard = 0;
      while (placed < n && guard++ < n * 4) {
        const x = (Math.random() - 0.5) * this.size, z = (Math.random() - 0.5) * this.size;
        if (exclude.some(f => Math.hypot(x - f.x, z - f.z) < f.r)) continue;
        const y = this.groundHeight(x, z);
        if (y < this.waterLevel + 0.15) continue;
        e.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.25);
        q.setFromEuler(e);
        const h = 0.35 + Math.random() * 0.6;
        sc.set(h * (0.85 + Math.random() * 0.3), h, h * (0.85 + Math.random() * 0.3));
        M.compose(new THREE.Vector3(x, y - 0.02, z), q, sc);
        im.setMatrixAt(placed, M);
        col.set(PASTEL_GREENS[(Math.random() * PASTEL_GREENS.length) | 0]);
        col.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
        im.setColorAt(placed, col);
        placed++;
      }
      im.count = placed;
      this.group.add(im);
    });
  }

  addWater(y = -0.4) {
    this.waterLevel = y;
    const S = this.size * 3;
    const mat = new THREE.MeshLambertMaterial({
      color: 0x2e8496, transparent: true, opacity: 0.85, emissive: 0x0a262e,
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

// Sitting devas scattered across the sky, translucent, gently bobbing —
// the hosts of gods witnessing the great deeds (acts II and IX).
// Same placement idea as scatterGrass: random spread, but lifted high above ground.
export function scatterGods(W, n = 100, { cx = 0, cz = 0 } = {}) {
  const robes = [0xe8d8f8, 0xf8e8c8, 0xd8e8f8, 0xf8d8e0];
  const hands = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 14 + Math.sqrt(Math.random()) * W.size * 0.28;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const y = Math.max(W.groundHeight(x, z), W.waterLevel) + 25 + Math.random() * 22;
    const P = makePerson({
      kind: i % 2 ? 'devi' : 'deva', robe: robes[(Math.random() * 4) | 0],
      ornate: true, scale: 2 + Math.random() * 0.5,
      cloth: false, // a hundred distant figures: the cloth sim would sink the frame rate
    });
    P.setAnim(Math.random() < 0.35 ? 'idle' : 'sit'); // some stand in the air, the rest are seated
    P.group.traverse(o => {
      o.castShadow = false;
      if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.6; }
    });
    P.group.position.set(x, y, z);
    P.group.rotation.y = Math.atan2(cx - x, cz - z); // facing the deed below
    W.group.add(P.group);
    for (const elb of [P.elbL, P.elbR]) { // an empty at the palm: where the petals leave the hand
      const h = new THREE.Object3D(); h.position.y = -0.36; elb.add(h); hands.push(h);
    }
    const ph = Math.random() * 9;
    W.updaters.push((dt, t) => { P.update(dt, t); P.group.position.y = y + Math.sin(t * 0.5 + ph) * 0.4; });
  }
  petalsFrom(hands); // the gods scatter flowers over the deed below
}

// first mesh of a GLB scene, baked to world transform, base at y=0, height 1
function extractPlantGeo(src) {
  let geo = null;
  src.updateMatrixWorld(true);
  src.traverse(o => { if (o.isMesh && !geo) geo = o.geometry.clone().applyMatrix4(o.matrixWorld); });
  geo.computeBoundingBox();
  const bb = geo.boundingBox, h = bb.max.y - bb.min.y;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.scale(1 / h, 1 / h, 1 / h);
  return geo;
}

// ---------- procedural props ----------
function proceduralTree(flower = false) {
  const g = new THREE.Group();
  const trunkH = 1.6 + Math.random() * 1.6;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.16, trunkH, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4e, flatShading: true }));
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const leafC = flower
    ? [0xd987a6, 0xe89ab5, 0xf2b4c6][(Math.random() * 3) | 0]
    : [0x3f8264, 0x55997a, 0x6fae8e, 0x8fc4a4][(Math.random() * 4) | 0];
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
  const L = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const box = (w, h, d, m, px, py, pz) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(px, py, pz); g.add(b); return b;
  };
  const w = 5.2 + Math.random() * 2.2, d = 4.6 + Math.random() * 1.8, h = 2.9 + Math.random() * 0.8;
  const wallM = L([0xecc48e, 0xe3a88e, 0xf0d8b0][(Math.random() * 3) | 0]);
  const trim = L(0xf5ead2), dark = L(0x5f4636), plinthM = L(0xbca189);
  box(w + 0.7, 0.35, d + 0.7, plinthM, 0, 0.175, 0);                 // plinth
  box(w, h, d, wallM, 0, 0.35 + h / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])                // corner pilasters
    box(0.32, h, 0.32, trim, sx * (w / 2 - 0.1), 0.35 + h / 2, sz * (d / 2 - 0.1));
  const dh = Math.min(2.1, h - 0.4);                                 // framed door, front
  box(1.4, dh + 0.25, 0.12, trim, 0, 0.35 + (dh + 0.25) / 2, d / 2 + 0.02);
  box(1.0, dh, 0.1, dark, 0, 0.35 + dh / 2, d / 2 + 0.08);
  for (const s of [-1, 1]) {                                         // shuttered windows
    box(0.85, 1.0, 0.1, trim, s * (w / 4 + 0.5), 0.35 + h * 0.55, d / 2 + 0.02);
    box(0.55, 0.7, 0.08, dark, s * (w / 4 + 0.5), 0.35 + h * 0.55, d / 2 + 0.07);
    box(0.1, 1.0, 0.85, trim, s * (w / 2 + 0.02), 0.35 + h * 0.55, 0);
    box(0.08, 0.7, 0.55, dark, s * (w / 2 + 0.07), 0.35 + h * 0.55, 0);
  }
  box(w + 1.0, 0.16, d + 1.0, plinthM, 0, 0.35 + h + 0.08, 0);       // eave slab
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.82, 1.7, 4),
    new THREE.MeshLambertMaterial({ color: [0xc9603f, 0xb05036, 0xcf8248][(Math.random() * 3) | 0], flatShading: true }));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.35 + h + 0.16 + 0.85;
  g.add(roof);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6),
    new THREE.MeshLambertMaterial({ color: 0xd9a52c, emissive: 0x4a3510, flatShading: true }));
  fin.position.y = roof.position.y + 1.0;
  g.add(fin);
  g.userData.r = Math.max(w, d) / 2 + 0.6; // collider radius for the caller
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// The king's palace at Kapilavastu: a two-storey haveli in red sandstone built
// around an open central courtyard (chowk), so the sky stays clear above the
// queen's couch for the conception scene. Colonnaded galleries on both floors,
// a masonry stair in the east wing, jharokha balconies over the facade, chhatri
// cupolas and a great onion dome. Floors, stair and railings are solid blocks,
// so both storeys are fully walkable. Courtyard: local x -7..7, z -6..4.
// 0xe87f66
function proceduralPalace(W, x, z) {
  const g = new THREE.Group();
  const gy = W.groundHeight(x, z);
  const B = (x0, x1, z0, z1, y0, y1) => W.addBlock(x + x0, x + x1, z + z0, z + z1, gy + y0, gy + y1);
  const L = (color, extra) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
  // warm emissive keeps the shade side rosy rather than brick-brown, Monument Valley style
  const stone = L(0xe88b66, { emissive: 0x3a150e }), stoneDark = L(0xbc5c4a, { emissive: 0x2a0f0a }), cream = L(0xf5ead2);
  const red = L(0xcf4f42), gold = L(0xd9a52c, { emissive: 0x4a3510 }), leaf = L(0x55997a);
  const box = (w, h, d, m, px, py, pz, ry = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(px, py, pz); if (ry) b.rotation.y = ry;
    g.add(b); return b;
  };
  const cyl = (rTop, rBot, h, seg, m, px, py, pz) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), m);
    c.position.set(px, py, pz); g.add(c); return c;
  };
  const column = (cx, baseY, cz, h, ry = 0, r = 0.34) => {
    cyl(r * 1.5, r * 1.7, 0.25, 8, cream, cx, baseY + 0.125, cz);
    cyl(r, r * 1.2, h, 8, stone, cx, baseY + h / 2, cz);
    cyl(r * 1.55, r, 0.4, 8, cream, cx, baseY + h + 0.2, cz);
    box(r * 4.2, 0.2, r * 1.6, stone, cx, baseY + h + 0.5, cz, ry);
    W.addCollider(x + cx, z + cz, r + 0.18, gy + baseY + h, baseY > 3 ? gy + baseY - 0.5 : undefined);
  };
  const chhatri = (sx, baseY, sz) => {
    for (const [ox, oz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]])
      cyl(0.08, 0.08, 1.2, 6, cream, sx + ox, baseY + 0.6, sz + oz);
    box(2.0, 0.16, 2.0, cream, sx, baseY + 1.28, sz);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), red);
    dome.position.set(sx, baseY + 1.32, sz); g.add(dome);
    cyl(0, 0.1, 0.45, 6, gold, sx, baseY + 2.5, sz);
  };
  const onion = (sx, baseY, sz, r) => {
    cyl(r * 0.92, r * 1.04, r * 0.34, 12, cream, sx, baseY + r * 0.17, sz);
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2), red);
    d.scale.y = 0.88; d.position.set(sx, baseY + r * 0.3, sz); g.add(d);
    const k = new THREE.Mesh(new THREE.SphereGeometry(r * 0.14, 8, 6), gold);
    k.position.set(sx, baseY + r * 1.24, sz); g.add(k);
    cyl(0.03, r * 0.07, r * 0.42, 6, gold, sx, baseY + r * 1.5, sz);
  };

  // ---- ground floor at plateau grade; courtyard inlay ----
  box(37, 0.12, 27, stoneDark, 0, 0, 0);
  box(13.4, 0.18, 9.4, red, 0, 0.02, -1);

  // ---- outer walls, ground storey (5 high), door bay open at the front ----
  const wallsG = [ // [x0, x1, z0, z1]
    [-18, -2.2, 12.65, 13.35], [2.2, 18, 12.65, 13.35],   // front, door bay open
    [-18, 18, -13.35, -12.65],                            // back
    [-18.35, -17.65, -13, 13], [17.65, 18.35, -13, 13],   // sides
  ];
  for (const [x0, x1, z0, z1] of wallsG) {
    box(x1 - x0, 5, z1 - z0, stone, (x0 + x1) / 2, 2.5, (z0 + z1) / 2);
    B(x0, x1, z0, z1, 0, 5);
  }
  // NPCs ignore blocks, so line the walls with low colliders they can feel
  for (let ex = -17.5; ex <= 17.5; ex += 2) {
    if (Math.abs(ex) > 3) W.addCollider(x + ex, z + 13, 0.8, gy + 4.2);
    W.addCollider(x + ex, z - 13, 0.8, gy + 4.2);
  }
  for (let ez = -12; ez <= 12; ez += 2) for (const s of [-1, 1])
    W.addCollider(x + s * 18, z + ez, 0.8, gy + 4.2);
  // decorated elevations on all four sides: pilasters, window bays, jharokha
  // oriels and a gilded frieze; the door bay stays open at the front
  const deco = (ry, f, halfW, door, winXs, jhXs) => {
    const sg = new THREE.Group(); sg.rotation.y = ry; g.add(sg);
    const dark = L(0x3a2418);
    const sbox = (w, h, d, m, px, py, pz) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(px, py, pz); sg.add(b); return b;
    };
    const scyl = (rT, rB, h, m, px, py, pz) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, 6), m);
      c.position.set(px, py, pz); sg.add(c); return c;
    };
    for (let px = -halfW + 2.5; px <= halfW - 2.4; px += 3.1)
      if (!door || Math.abs(px) > 3) sbox(0.34, 4.6, 0.14, cream, px, 2.3, f + 0.07);
    for (const px of winXs) {
      sbox(1.2, 2.0, 0.16, cream, px, 6.9, f + 0.07);   // upper cusped window bays
      sbox(0.72, 1.5, 0.1, dark, px, 6.75, f + 0.15);
      if (!door || Math.abs(px) > 3.2) {                 // ground-storey windows
        sbox(1.1, 1.7, 0.16, cream, px, 2.55, f + 0.07);
        sbox(0.66, 1.3, 0.1, dark, px, 2.45, f + 0.15);
      }
    }
    for (const jx of jhXs) { // jharokhas: projecting oriel windows with ribbed caps
      sbox(2.4, 0.4, 0.8, stoneDark, jx, 5.6, f + 0.35);
      sbox(2.2, 0.18, 1.1, cream, jx, 5.9, f + 0.55);
      for (const ox of [-0.95, 0.95]) scyl(0.07, 0.07, 1.75, cream, jx + ox, 6.85, f + 0.95);
      sbox(2.2, 0.62, 0.1, cream, jx, 6.3, f + 1.05);
      for (const ox of [-1.05, 1.05]) sbox(0.1, 0.62, 0.9, cream, jx + ox, 6.3, f + 0.6);
      sbox(2.5, 0.16, 1.3, cream, jx, 7.8, f + 0.55);
      const jd = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), red);
      jd.scale.y = 0.75; jd.position.set(jx, 7.86, f + 0.55); sg.add(jd);
      scyl(0, 0.08, 0.35, gold, jx, 8.7, f + 0.55);
    }
    sbox(halfW * 2 + 0.9, 0.45, 0.28, gold, 0, 8.32, f + 0.1); // gilded frieze
  };
  deco(0, 13.35, 18, true, [-15, -4.5, 0, 4.5, 15], [-10.5, 10.5]);
  deco(Math.PI, 13.35, 18, false, [-15, -4.5, 0, 4.5, 15], [-10.5, 10.5]);
  deco(Math.PI / 2, 18.35, 13, false, [-9.5, 0, 9.5], [-5, 5]);
  deco(-Math.PI / 2, 18.35, 13, false, [-9.5, 0, 9.5], [-5, 5]);
  // string course between the storeys
  for (const [w, px, pz, d] of [[37.4, 0, 13.4, 0.3], [37.4, 0, -13.4, 0.3], [0.3, -18.4, 0, 27.4], [0.3, 18.4, 0, 27.4]])
    box(w, 0.35, d, cream, px, 4.85, pz);
  // grand doorway: cream jambs, gilded lintel, torana pendants, low steps
  for (const s of [-1, 1]) box(0.55, 4.4, 1.0, cream, s * 2.45, 2.2, 13);
  box(5.7, 0.65, 1.1, gold, 0, 4.65, 13);
  for (const px of [-1.4, 0, 1.4]) cyl(0.1, 0.02, 0.5, 6, gold, px, 4.1, 13.45);
  box(6.4, 0.14, 1.2, cream, 0, 0.07, 14.0);
  box(5.4, 0.28, 0.9, cream, 0, 0.14, 13.6);
  B(-2.7, 2.7, 13.15, 14.05, 0, 0.28);
  // flame lamps flanking the entrance
  for (const s of [-1, 1]) {
    cyl(0.09, 0.13, 2.1, 6, stone, s * 3.6, 1.05, 14.6);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), gold);
    fl.position.set(s * 3.6, 2.28, 14.6); g.add(fl);
    W.addCollider(x + s * 3.6, z + 14.6, 0.28, gy + 2.4);
  }

  // ---- ground colonnades: around the courtyard and through both halls ----
  const gh = 3.9;
  for (const s of [-1, 1]) {
    // the south row keeps a wide central bay: a clear axis from door to couch
    for (const cx of [-7.6, -3.8, 0, 3.8, 7.6]) if (s < 0 || cx !== 0) column(cx, 0.06, s < 0 ? -6.6 : 4.6, gh);
    for (const cz of [-2.9, 0.8]) column(s * 7.6, 0.06, cz, gh, Math.PI / 2);
    for (const cx of [4.5, 10.5]) { column(s * cx, 0.06, 8.8, gh); column(s * cx, 0.06, -9.8, gh); }
  }

  // ---- floor two: gallery ring around the open courtyard (top at 5.0) ----
  const slabs = [ // stairwell open in the east wing
    [-18, 18, 4.6, 13], [-18, 18, -13, -6.6],
    [-18, -7.6, -6.6, 4.6], [7.6, 15.2, -6.6, 4.6], [15.2, 18, -6.6, -3.5],
  ];
  for (const [x0, x1, z0, z1] of slabs) {
    box(x1 - x0, 0.5, z1 - z0, stoneDark, (x0 + x1) / 2, 4.75, (z0 + z1) / 2);
    B(x0, x1, z0, z1, 4.5, 5);
  }

  // ---- masonry stair in the east wing, ground to floor two ----
  for (let i = 0; i < 14; i++) {
    const top = (5 / 14) * (i + 1), sz = 4.2 - i * 0.55;
    box(2.4, top, 0.55, stone, 16.4, top / 2, sz);
    B(15.2, 17.6, sz - 0.275, sz + 0.275, 0, top);
    if (i % 2 === 0) box(0.16, 0.55, 0.6, cream, 15.28, top + 0.22, sz);
  }

  // ---- jali railings: around the courtyard opening and the stairwell ----
  for (const [x0, x1, z0, z1] of [
    [-7.7, 7.7, 4.5, 4.7], [-7.7, 7.7, -6.7, -6.5],
    [-7.7, -7.5, -6.6, 4.6], [7.5, 7.7, -6.6, 4.6],
    [15.1, 15.3, -3.5, 4.6], [15.2, 18, 4.5, 4.7]]) {
    box(x1 - x0, 0.9, z1 - z0, cream, (x0 + x1) / 2, 5.45, (z0 + z1) / 2);
    B(x0, x1, z0, z1, 5, 5.9);
  }

  // ---- upper colonnade on the courtyard grid ----
  const uh = 3.15;
  for (const s of [-1, 1]) {
    for (const cx of [-7.6, -3.8, 0, 3.8, 7.6]) if (s < 0 || cx !== 0) column(cx, 5, s < 0 ? -6.6 : 4.6, uh, 0, 0.28);
    for (const cz of [-2.9, 0.8]) column(s * 7.6, 5, cz, uh, Math.PI / 2, 0.28);
  }

  // ---- upper outer walls with arched windows; jharokha balconies on the facade ----
  const wallsU = [
    [-18, 18, 12.65, 13.35], [-18, 18, -13.35, -12.65],
    [-18.35, -17.65, -13, 13], [17.65, 18.35, -13, 13],
  ];
  for (const [x0, x1, z0, z1] of wallsU) {
    box(x1 - x0, 3.6, z1 - z0, stone, (x0 + x1) / 2, 6.8, (z0 + z1) / 2);
    B(x0, x1, z0, z1, 5, 8.6);
  }

  // ---- roof ring over the galleries; the courtyard stays open to the sky ----
  for (const [x0, x1, z0, z1] of [
    [-18, 18, 4.6, 13], [-18, 18, -13, -6.6], [-18, -7.6, -6.6, 4.6], [7.6, 18, -6.6, 4.6]])
    box(x1 - x0, 0.6, z1 - z0, stoneDark, (x0 + x1) / 2, 8.9, (z0 + z1) / 2);
  for (const [w, px, pz, d] of [[38.6, 0, 13.6, 1.2], [38.6, 0, -13.6, 1.2], [1.2, -18.6, 0, 26], [1.2, 18.6, 0, 26]])
    box(w, 0.22, d, stoneDark, px, 8.62, pz);              // chhajja overhang
  for (let mi = -13.7; mi <= 13.7; mi += 2.6) {            // parapet merlons
    for (const mz of [13.2, -13.2]) box(0.8, 0.5, 0.22, cream, mi * 1.3, 9.45, mz);
    if (Math.abs(mi) <= 10.4) for (const mx of [-18.1, 18.1]) box(0.22, 0.5, 0.8, cream, mx, 9.45, mi * 1.25);
  }

  // ---- roofscape: corner chhatris, the great dome and its companions ----
  for (const [sx, sz] of [[-15.3, -10.3], [15.3, -10.3], [-15.3, 10.3], [15.3, 10.3]]) chhatri(sx, 9.2, sz);
  onion(0, 9.2, -9.8, 3.0);                                // great dome over the rear hall
  onion(-12, 9.2, -9.8, 1.3); onion(12, 9.2, -9.8, 1.3);
  onion(0, 9.2, 8.8, 1.5);                                 // pavilion over the entrance

  // ---- courtyard planters, clear of the couch at local (0, -1) ----
  for (const [px, pz] of [[-5.6, -4.6], [5.6, -4.6], [-5.6, 2.6], [5.6, 2.6]]) {
    box(1.1, 0.55, 1.1, stoneDark, px, 0.28, pz);
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), leaf);
    s.position.set(px, 0.95, pz); g.add(s);
    B(px - 0.55, px + 0.55, pz - 0.55, pz + 0.55, 0, 0.58);
  }

  g.position.set(x, gy, z);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  W.group.add(g);
  W.camBlockers.push(g);
  return g;
}

// Royal stables west of the palace: an open-fronted timber shed facing east,
// stalls divided by rails, with the horses standing in. The carriage horse is
// exposed on W.stableCarriageHorse so acts where the prince rides it can hide it.
function stables(W, x, z) {
  const g = new THREE.Group();
  const gy = W.groundHeight(x, z);
  const L = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const wood = L(0x8a6a4e), woodDark = L(0x5f4636), thatch = L(0xbfa16a), strawM = L(0xd9bc74);
  const box = (w, h, d, m, px, py, pz) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(px, py, pz); g.add(b); return b;
  };
  const post = (px, pz, h) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, h, 6), wood);
    c.position.set(px, h / 2, pz); g.add(c);
    W.addCollider(x + px, z + pz, 0.25, gy + h);
  };
  const D = 13.2; // shed length along z, four stalls
  box(5.2, 0.14, D + 0.8, L(0xa88a6c), 0, 0.07, 0);      // earthen floor slab
  box(0.3, 4.3, D, woodDark, -2.3, 2.15, 0);             // back wall
  for (let ez = -D / 2; ez <= D / 2; ez += 1.7) W.addCollider(x - 2.3, z + ez, 0.5, gy + 4.2);
  for (const s of [-1, 1]) {                              // end walls
    box(4.6, 4.1, 0.3, woodDark, -0.2, 2.05, s * D / 2);
    for (let ex = -2.2; ex <= 2; ex += 1.4) W.addCollider(x + ex, z + s * D / 2, 0.5, gy + 4.0);
    post(2.2, s * D / 2, 4.3);
  }
  for (const pz of [-2.2, 2.2]) post(2.2, pz, 4.3);       // open front posts
  for (const pz of [-2.2, 2.2]) {                          // stall rails
    box(4.4, 0.1, 0.1, wood, -0.1, 1.6, pz);
    box(4.4, 0.1, 0.1, wood, -0.1, 0.9, pz);
  }
  const roof = box(5.8, 0.18, D + 1.2, thatch, 0.1, 4.65, 0); // pitched roof, low at the back
  roof.rotation.z = -0.16;
  box(5.8, 0.1, 0.3, woodDark, 0.1, 4.7, 0);
  for (const [hx, hz] of [[1.4, -5.6], [1.6, 5.5]]) {      // hay piles by the entrance
    const hay = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), strawM);
    hay.scale.y = 0.6; hay.position.set(hx, 0.4, hz); g.add(hay);
  }
  box(1.6, 0.35, 0.5, woodDark, 3.0, 0.24, 0);             // water trough
  // the horses: two bay, one black, and the prince's carriage horse
  const horses = [];
  const stallZ = [-4.95, -1.65, 1.65, 4.95];
  const coats = [0x7a5230, 0x2a2422, 0x8a6242, 0xc9b8a0];
  for (let i = 0; i < 4; i++) {
    const h = makeHorse(coats[i]);
    h.anim = 'idle';
    h.group.scale.setScalar(1.5);
    h.group.position.set(x - 0.7, gy + 0.12, z + stallZ[i]);
    h.group.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    W.group.add(h.group);
    horses.push(h);
    if (coats[i] !== 0xc9b8a0) W.addCollider(x - 0.7, z + stallZ[i], 0.8, gy + 1.6);
  }
  W.stableCarriageHorse = horses[3].group;
  W.updaters.push((dt) => { for (const h of horses) h.update(dt); });
  g.position.set(x, gy, z);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  W.group.add(g);
  W.camBlockers.push(g);
  return g;
}

// A lesser palace in the same haveli vocabulary: one lofty storey, pilastered
// walls, cusped windows, a torana doorway, chhajja, merlons, corner chhatris
// and a central dome. Decorative only — solid, not enterable.
function smallPalace(W, x, z) {
  const g = new THREE.Group();
  const gy = W.groundHeight(x, z);
  const L = (color, extra) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
  // warm emissive keeps the shade side rosy rather than brick-brown, Monument Valley style
  const stone = L(0xe87f66, { emissive: 0x3a150e }), stoneDark = L(0xbc5c4a, { emissive: 0x2a0f0a }), cream = L(0xf5ead2);
  const red = L(0xcf4f42), gold = L(0xd9a52c, { emissive: 0x4a3510 }), dark = L(0x4a3428);
  const box = (w, h, d, m, px, py, pz) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(px, py, pz); g.add(b); return b;
  };
  const cyl = (rT, rB, h, m, px, py, pz) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, 8), m);
    c.position.set(px, py, pz); g.add(c); return c;
  };
  box(17, 0.5, 13, stoneDark, 0, 0.25, 0);                   // plinth
  box(15.5, 5.6, 11.5, stone, 0, 3.3, 0);                    // main body
  for (let px = -6.6; px <= 6.6; px += 2.2)                   // pilasters, front and back
    for (const s of [-1, 1]) if (Math.abs(px) > 1.6 || s < 0) box(0.3, 5.2, 0.14, cream, px, 3.1, s * 5.82);
  for (let pz = -4.4; pz <= 4.4; pz += 2.2)                   // pilasters, sides
    for (const s of [-1, 1]) box(0.14, 5.2, 0.3, cream, s * 7.82, 3.1, pz);
  for (const px of [-5.5, -2.75, 2.75, 5.5]) for (const s of [-1, 1]) { // cusped windows
    box(1.0, 1.8, 0.14, cream, px, 4.0, s * 5.86);
    box(0.6, 1.4, 0.1, dark, px, 3.9, s * 5.94);
  }
  for (const pz of [-2.6, 2.6]) for (const s of [-1, 1]) {
    box(0.14, 1.8, 1.0, cream, s * 7.86, 4.0, pz);
    box(0.1, 1.4, 0.6, dark, s * 7.94, 3.9, pz);
  }
  box(1.9, 3.4, 0.6, cream, 0, 2.2, 5.9);                    // doorway with torana
  box(1.3, 2.8, 0.2, dark, 0, 1.9, 6.15);
  box(2.9, 0.5, 0.7, gold, 0, 4.15, 5.9);
  for (const px of [-0.9, 0, 0.9]) cyl(0.08, 0.02, 0.4, gold, px, 3.7, 6.2);
  box(3.4, 0.3, 1.6, cream, 0, 0.55, 6.4);                   // door steps
  box(16.6, 0.22, 12.6, stoneDark, 0, 6.2, 0);               // chhajja
  box(15.6, 0.35, 0.22, gold, 0, 5.85, 5.85);                // gilded frieze over the door
  box(15.5, 0.5, 11.5, stone, 0, 6.55, 0);                   // roof slab
  for (let mi = -7; mi <= 7; mi += 1.75)                      // parapet merlons
    for (const s of [-1, 1]) box(0.7, 0.4, 0.18, cream, mi, 6.98, s * 5.7);
  for (let mi = -4.9; mi <= 4.9; mi += 1.75)
    for (const s of [-1, 1]) box(0.18, 0.4, 0.7, cream, s * 7.7, 6.98, mi);
  for (const [sx, sz] of [[-6.2, -4.2], [6.2, -4.2], [-6.2, 4.2], [6.2, 4.2]]) { // corner chhatris
    for (const [ox, oz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]])
      cyl(0.06, 0.06, 1.0, cream, sx + ox, 7.3, sz + oz);
    box(1.5, 0.14, 1.5, cream, sx, 7.85, sz);
    const dm = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), red);
    dm.position.set(sx, 7.88, sz); g.add(dm);
    cyl(0, 0.08, 0.35, gold, sx, 8.75, sz);
  }
  cyl(1.9, 2.1, 1.3, cream, 0, 7.4, 0);                      // raised drum so the dome clears the parapet
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.0, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2), red);
  dome.scale.y = 0.88; dome.position.set(0, 8.0, 0); g.add(dome);
  const kal = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), gold);
  kal.position.set(0, 9.9, 0); g.add(kal);
  cyl(0.03, 0.13, 0.8, gold, 0, 10.45, 0);
  // solid to walk against, on all four faces
  for (let ex = -8; ex <= 8; ex += 1.6) for (const s of [-1, 1]) W.addCollider(x + ex, z + s * 6, 1.0);
  for (let ez = -5; ez <= 5; ez += 1.6) for (const s of [-1, 1]) W.addCollider(x + s * 8, z + ez, 1.0);
  g.position.set(x, gy, z);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  W.group.add(g);
  W.camBlockers.push(g);
  return g;
}

// Celestial palace for Tushita in a Nagara temple idiom (after the GLB it
// replaces): stepped marble plinth, grand front staircase rising to a
// balconied upper storey, double colonnade, jali railings, chhatri cupolas,
// and a spine of shikhara towers crowned by amalaka discs and gold kalashas.
function celestialPalace(W, x, z) {
  const g = new THREE.Group();
  const gy = W.groundHeight(x, z);
  // walkable solid box, in palace-local coordinates
  const B = (x0, x1, z0, z1, y0, y1) => W.addBlock(x + x0, x + x1, z + z0, z + z1, gy + y0, gy + y1);
  const L = (color, extra) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
  const marble = L(0xf2e7d0), rose = L(0xdba887), roseDark = L(0xbf8a63);
  const white = L(0xfaf3e2), gold = L(0xd9a52c, { emissive: 0x4a3510 });
  const dark = L(0x4a3220);
  const box = (w, h, d, m, px, py, pz, ry = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(px, py, pz); if (ry) b.rotation.y = ry;
    g.add(b); return b;
  };
  const cyl = (rTop, rBot, h, seg, m, px, py, pz) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), m);
    c.position.set(px, py, pz); g.add(c); return c;
  };
  // fluted column with lotus-bell capital and bracket slab; solid to walk against,
  // ignored when the player stands on a storey above (or below) it
  const column = (cx, baseY, cz, h, ry = 0, r = 0.36) => {
    cyl(r * 1.5, r * 1.7, 0.25, 8, marble, cx, baseY + 0.125, cz);
    cyl(r, r * 1.2, h, 8, rose, cx, baseY + h / 2, cz);
    cyl(r * 1.55, r, 0.4, 8, white, cx, baseY + h + 0.2, cz);
    box(r * 4.2, 0.2, r * 1.6, rose, cx, baseY + h + 0.5, cz, ry);
    W.addCollider(x + cx, z + cz, r + 0.18, gy + baseY + h, baseY > 3 ? gy + baseY - 0.5 : undefined);
  };
  // curvilinear tower: shrinking stacked tiers, amalaka disc, gold kalasha
  const shikhara = (sx, baseY, sz, baseW, tiers, tierH) => {
    for (let i = 0; i < tiers; i++) {
      const w = baseW * (1 - i / (tiers + 0.7));
      box(w, tierH, w, rose, sx, baseY + tierH * (i + 0.5), sz, (i % 2) * Math.PI / 8);
    }
    const topY = baseY + tiers * tierH;
    cyl(baseW * 0.2, baseW * 0.2, baseW * 0.09, 10, white, sx, topY + baseW * 0.045, sz);
    const k = cyl(0, baseW * 0.09, baseW * 0.24, 8, gold, sx, topY + baseW * 0.22, sz);
    k.geometry = new THREE.SphereGeometry(baseW * 0.1, 8, 6);
    cyl(0.02, baseW * 0.05, baseW * 0.3, 6, gold, sx, topY + baseW * 0.42, sz);
  };
  // pillared cupola for the roof corners
  const chhatri = (sx, baseY, sz) => {
    for (const [ox, oz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]])
      cyl(0.08, 0.08, 1.2, 6, white, sx + ox, baseY + 0.6, sz + oz);
    box(2.0, 0.16, 2.0, white, sx, baseY + 1.28, sz);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), rose);
    dome.position.set(sx, baseY + 1.32, sz); g.add(dome);
    cyl(0, 0.1, 0.45, 6, gold, sx, baseY + 2.5, sz);
  };

  // ---- stepped plinth and terrace (floor one at y 2.4) ----
  box(38, 1.1, 26, roseDark, 0, 0.55, 0);
  B(-19, 19, -13, 13, 0, 1.1);
  box(35, 1.0, 23, rose, 0, 1.6, 0);
  B(-17.5, 17.5, -11.5, 11.5, 0, 2.1);
  box(33, 0.3, 21, marble, 0, 2.25, 0);
  B(-16.5, 16.5, -10.5, 10.5, 0, 2.4);
  box(9, 0.06, 16, L(0x8a3428), 0, 2.43, 3);          // carpet up the terrace
  // gold kalasha orbs on the plinth corners
  for (const [sx, sz] of [[-16.5, 11.5], [16.5, 11.5], [-16.5, -11.5], [16.5, -11.5]]) {
    box(1.1, 0.7, 1.1, marble, sx, 2.45, sz);
    B(sx - 0.55, sx + 0.55, sz - 0.55, sz + 0.55, 2.1, 2.8);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), gold);
    orb.position.set(sx, 3.15, sz); g.add(orb);
  }

  // ---- grand front staircase, balustraded ----
  // solid landing bridging the stair top across the plinth tiers to the terrace
  box(11, 2.4, 2.6, rose, 0, 1.2, 12.2);
  B(-5.5, 5.5, 10.9, 13.5, 0, 2.4);
  for (let i = 0; i < 8; i++) {
    const w = 13 - i * 0.35, sz = 13.35 + (7 - i) * 0.82, top = 0.3 + i * 0.3;
    box(w, 0.3, 0.9, marble, 0, top - 0.15, sz);
    B(-w / 2, w / 2, sz - 0.45, sz + 0.45, 0, top);
    box(0.7, 0.65, 0.95, rose, -(w / 2 + 0.35), top + 0.05, sz);
    box(0.7, 0.65, 0.95, rose, w / 2 + 0.35, top + 0.05, sz);
    B(-w / 2 - 0.7, -w / 2, sz - 0.48, sz + 0.48, 0, top + 0.38);
    B(w / 2, w / 2 + 0.7, sz - 0.48, sz + 0.48, 0, top + 0.38);
  }
  // flame lamps flanking the foot of the stairs
  for (const s of [-1, 1]) {
    cyl(0.09, 0.13, 2.2, 6, rose, s * 7.6, 1.1, 19.6);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), gold);
    fl.position.set(s * 7.6, 2.4, 19.6); g.add(fl);
    W.addCollider(x + s * 7.6, z + 19.6, 0.3, gy + 2.5);
  }

  // ---- ground-floor mandapa: perimeter and inner colonnades ----
  const gh = 3.6; // ground column height
  for (const s of [-1, 1]) {
    for (const cx of [7.5, 11.25, 15]) column(s * cx, 2.4, 4, gh);          // front, centre open
    for (const cz of [-10.2, -6.65, -3.1, 0.45]) column(s * 15, 2.4, cz, gh, Math.PI / 2); // sides
    for (const cx of [3.75, 7.5, 11.25, 15]) column(s * cx, 2.4, -10.2, gh); // back
    for (const cz of [-7.5, -4, -0.5]) column(s * 5.6, 2.4, cz, gh, 0, 0.3); // inner rows
  }
  column(0, 2.4, -10.2, gh);
  // jali railings between the outer columns (front centre left open)
  for (const [w, px, pz, ry] of [[7.5, -11.25, 4, 0], [7.5, 11.25, 4, 0],
    [14.2, -15, -3.1, Math.PI / 2], [14.2, 15, -3.1, Math.PI / 2], [30, 0, -10.2, 0]]) {
    box(w, 0.85, 0.16, white, px, 2.85, pz, ry);
    const hw = w / 2;
    if (ry) B(px - 0.1, px + 0.1, pz - hw, pz + hw, 2.4, 3.28);
    else B(px - hw, px + hw, pz - 0.1, pz + 0.1, 2.4, 3.28);
  }

  // ---- entablature, chhajja roof, parapet ----
  box(31, 0.5, 17, gold, 0, 6.85, -4);
  box(34, 0.55, 20, roseDark, 0, 7.38, -4);
  B(-17, 17, -14, 6, 7.1, 7.65);                      // the lower roof is walkable
  for (let mi = -6; mi <= 6; mi++) {
    for (const mz of [5.85, -13.85]) box(0.85, 0.5, 0.22, white, mi * 2.6, 7.95, mz);
    if (Math.abs(mi) <= 3) for (const mx of [-16.85, 16.85]) box(0.22, 0.5, 0.85, white, mx, 7.95, -4 + mi * 2.6);
  }

  // ---- upper storey (floor two at y 7.95) with front balcony ----
  box(23, 0.3, 14, marble, 0, 7.8, -4);
  B(-11.5, 11.5, -11, 3, 7.65, 7.95);
  box(9, 0.3, 3.6, marble, 0, 7.8, 4.5);              // balcony floor
  B(-4.5, 4.5, 2.7, 6.3, 7.65, 7.95);
  for (const s of [-1, 1]) {
    // balcony railing, parted in the middle where the stair arrives
    box(1.8, 0.7, 0.16, white, s * 3.6, 8.45, 6.2);
    B(s * 2.7, s * 4.5, 6.1, 6.3, 7.95, 8.8);
    box(0.16, 0.7, 3.4, white, s * 4.45, 8.45, 4.5);
    B(s * 4.37, s * 4.53, 2.7, 6.2, 7.95, 8.8);
    column(s * 3.7, 2.4, 5.4, 4.8, 0, 0.28);          // slender balcony supports
  }
  // staircase from the terrace up to the balcony
  for (let i = 0; i < 15; i++) {
    const top = 2.77 + i * 0.37, sz = 13.1 - i * 0.5;
    box(5, 0.37, 0.52, marble, 0, top - 0.185, sz);
    B(-2.5, 2.5, sz - 0.26, sz + 0.26, top - 0.37, top);
    if (i % 2 === 0) for (const s of [-1, 1]) {
      box(0.45, 0.9, 0.55, rose, s * 2.75, top + 0.03, sz);
      B(s * 2.52, s * 2.98, sz - 0.28, sz + 0.28, top - 0.42, top + 0.48);
    }
  }
  // upper colonnade and railings
  const uh = 3.0; // upper column height
  for (const s of [-1, 1]) {
    for (const cx of [3.4, 7.1, 10.8]) column(s * cx, 7.95, 2.4, uh, 0, 0.3);
    for (const cz of [-10.4, -6.9, -3.4, 0.1]) column(s * 10.8, 7.95, cz, uh, Math.PI / 2, 0.3);
    for (const cx of [3.6, 7.2, 10.8]) column(s * cx, 7.95, -10.4, uh, 0, 0.3);
  }
  column(0, 7.95, -10.4, uh, 0, 0.3);
  for (const [w, px, pz, ry] of [[7.4, -7.1, 2.4, 0], [7.4, 7.1, 2.4, 0],
    [12.8, -10.8, -4, Math.PI / 2], [12.8, 10.8, -4, Math.PI / 2], [21.6, 0, -10.4, 0]]) {
    box(w, 0.8, 0.16, white, px, 8.4, pz, ry);
    const hw = w / 2;
    if (ry) B(px - 0.1, px + 0.1, pz - hw, pz + hw, 7.95, 8.8);
    else B(px - hw, px + hw, pz - 0.1, pz + 0.1, 7.95, 8.8);
  }
  // inner sanctum beneath the great tower, with a dark doorway
  box(6.5, 3.2, 5.5, white, 0, 9.55, -7);
  B(-3.25, 3.25, -9.75, -4.25, 7.95, 11.15);
  box(1.6, 2.3, 0.12, dark, 0, 9.1, -4.2);
  box(2.2, 0.5, 0.3, gold, 0, 10.4, -4.2);            // gilded lintel

  // ---- upper entablature, roof, parapet ----
  box(24, 0.45, 15, gold, 0, 11.55, -4);
  box(26, 0.5, 17, roseDark, 0, 11.95, -4);
  B(-13, 13, -12.5, 4.5, 11.7, 12.2);
  for (let mi = -4; mi <= 4; mi++) {
    for (const mz of [4.4, -12.4]) box(0.8, 0.45, 0.2, white, mi * 2.7, 12.45, mz);
    if (Math.abs(mi) <= 2) for (const mx of [-12.9, 12.9]) box(0.2, 0.45, 0.8, white, mx, 12.45, -4 + mi * 2.7);
  }

  // ---- roofscape: corner chhatris and the shikhara spine ----
  for (const [sx, sz] of [[-11, -11], [11, -11], [-11, 3], [11, 3]]) chhatri(sx, 12.2, sz);
  shikhara(0, 12.2, 2.2, 2.6, 3, 0.9);                 // over the balcony
  shikhara(0, 12.2, -2, 4, 4, 1.0);                    // mid spine
  box(7.6, 0.8, 7.6, roseDark, 0, 12.6, -8.5);         // great tower pedestal
  shikhara(0, 13.0, -8.5, 7, 7, 1.15);                 // main tower, ~23 units up
  for (const [ox, oz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]])
    shikhara(ox, 13.0, -8.5 + oz, 1.6, 2, 0.7);        // mini-turrets at its feet

  g.position.set(x, gy, z);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  W.group.add(g);
  W.camBlockers.push(g);
  // low colliders ringing the plinth: NPCs ignore collider heights, so these keep
  // wandering gods off the palace while the player walks over them from the stairs
  for (let ex = -19; ex <= 19; ex += 2.2) {
    if (Math.abs(ex) > 6.2) W.addCollider(x + ex, z + 13, 1.3, gy + 2.3); // front, stair bay open
    W.addCollider(x + ex, z - 13, 1.3, gy + 2.3);
  }
  for (let ez = -11; ez <= 11; ez += 2.2) for (const s of [-1, 1])
    W.addCollider(x + s * 19, z + ez, 1.3, gy + 2.3);
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

// Remap a GLB material into the pastel palette by hue family; textured
// materials (e.g. the Bodhi tree) keep their map and are left alone.
const PASTEL_GREENS = [0x3f8264, 0x55997a, 0x6fae8e, 0x8fc4a4];
function pastelRemap(m) {
  if (m.map) return;
  const hsl = {};
  m.color.getHSL(hsl);
  if (hsl.h > 0.16 && hsl.h < 0.5 && hsl.s > 0.12) {           // foliage
    // deeper, richer greens than the shrub set: big canopies wash out otherwise
    m.color.set([0x235742, 0x306852, 0x3d7355][(Math.random() * 3) | 0]);
    m.color.offsetHSL(0, 0.08, (Math.random() - 0.5) * 0.04);
    // dense GLB canopies self-shadow heavily; a touch of self-glow lifts the dark faces
    if (m.emissive) m.emissive.copy(m.color).multiplyScalar(0.12);
  } else if (hsl.s > 0.1 && hsl.h <= 0.16 && hsl.l < 0.55) {   // bark and browns
    m.color.setHSL(0.07, 0.26, 0.4);
  } else {                                                     // gently pastelise the rest
    m.color.setHSL(hsl.h, Math.min(hsl.s, 0.45), Math.min(0.8, hsl.l * 1.1 + 0.05));
  }
}

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
      const pick = (Math.random() * srcs.length) | 0;
      const h = (opts.treeH || 5) * (0.75 + Math.random() * 0.7);
      // willows model their roots; bury them below the turf like the hero trees
      const sink = treeNames[pick] === 'willow' ? -h * 0.11 : 0;
      placeModel(W, srcs[pick], h, x, z, Math.random() * Math.PI * 2, 0.4, { sink, remap: pastelRemap });
    }
  }
}

// ---------- world builders ----------

export async function buildJetaGrove() {
  const W = new World({ size: 300, hills: 1.4, seed: 11, baseColor: 0x49723e });
  W.flatten(0, 0, 26, 0.2);          // clearing with the Buddha's tree
  W.flatten(-40, 30, 14, 0.5);
  W.buildTerrain();
  W.addWater(-1.6);
  // Buddha's banyan
  const banyan = await loadModel('banyan');
  placeModel(W, banyan, 18, 0, -6, 1.35, 2.0, { sink: -0.4, remap: pastelRemap }); // turned so the trunk clears the seat
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
  const W = new World({ size: 260, hills: 0.9, seed: 23, baseColor: 0xe8d4c0, dirtColor: 0xf2e4d0 });
  W.flatten(0, 0, 40, 0.3);
  W.flatten(0, -34, 28, 0.3, 22);   // level ground under the whole palace footprint
  W.buildTerrain();
  W.terrain.material.color = new THREE.Color(0xfff0dd);
  celestialPalace(W, 0, -34);
  W.spots.palace = new THREE.Vector3(0, 0, -34);
  // gods as statues, flanking the pillar circle on either side, facing inwards
  const god1 = await loadModel('heavenly-god');
  const god2 = await loadModel('heavenly-god-02');
  const guanyin = await loadModel('guanyin');
  placeModel(W, god1, 6, -20, 0, Math.PI / 2, 1.2, { tint: new THREE.Color(1.15, 1.05, 0.9) });
  placeModel(W, god2, 6, 20, 0, -Math.PI / 2, 1.2, { tint: new THREE.Color(1.15, 1.05, 0.9) });
  // Guanyin within the pillared hall, an altar statue beneath the low roof
  placeModel(W, guanyin, 4.5, 0, -42, 0, 1.2, { tint: new THREE.Color(1.2, 1.1, 1.0), sink: 2.4 });
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
  const W = new World({ size: 300, hills: 1.2, seed: 37, baseColor: 0x597543, dirtColor: 0xa4834e });
  W.flatten(0, -50, 42, 1.3, 24);   // palace plateau: flat under the whole footprint
  W.flatten(-30, -44, 10, 1.3, 8);  // stables, west of the palace
  W.flatten(-64, -30, 15, 1.0, 11); // the lesser palaces, well outside the king's wall
  W.flatten(64, -30, 15, 1.0, 11);
  W.flatten(0, 20, 30, 0.2);    // town square
  W.flatten(0, 60, 12, 0.1);    // south road / gate
  W.buildTerrain();
  proceduralPalace(W, 0, -50);
  stables(W, -30, -44);         // the training grounds lie east; the stables face them
  smallPalace(W, -64, -30);     // the lesser palaces flank the compound from outside the wall
  smallPalace(W, 64, -30);
  W.spots.palace = new THREE.Vector3(0, 0, -44);
  W.spots.hall = new THREE.Vector3(0, 0, -51);   // the open central courtyard
  // the king's wall: Śuddhodana kept the prince shielded from the world
  {
    const wallM = new THREE.MeshLambertMaterial({ color: 0xd47a5c, flatShading: true, emissive: 0x30120c });
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
  // town: houses framing the road south, with three more lanes behind each side.
  // The road itself (x -7..7) stays clear — several scenes play out on it.
  const placeHouse = (x, z, faceRoad) => {
    const h = house();
    h.position.set(x, W.groundHeight(x, z), z);
    h.rotation.y = (faceRoad ? (x > 0 ? -Math.PI / 2 : Math.PI / 2) : Math.PI * 2 * Math.random()) + (Math.random() - 0.5) * 0.4;
    W.group.add(h);
    W.addCollider(x, z, h.userData.r);
    W.camBlockers.push(h);
  };
  for (let i = 0; i < 14; i++) { // main row, fewer but grander
    const side = i % 2 ? 1 : -1;
    const z = 2 + (i >> 1) * 9 + (Math.random() - 0.5) * 2;
    placeHouse(side * (8.5 + Math.random() * 5), z, true);
  }
  for (const side of [-1, 1]) for (let r = 1; r <= 3; r++) for (let k = 0; k < 5; k++)
    placeHouse(side * (19 + r * 11 + (Math.random() - 0.5) * 5),
      4 + k * 13 + (Math.random() - 0.5) * 5, r === 1 && Math.random() < 0.5);
  // city gate at south edge
  const gateM = new THREE.MeshLambertMaterial({ color: 0xc99e6a, flatShading: true });
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
    exclude: [{ x: 0, z: -51, r: 54 }, { x: 0, z: 25, r: 26 }, { x: 0, z: 60, r: 10 },
      { x: -37, z: 30, r: 36 }, { x: 37, z: 30, r: 36 },
      { x: -64, z: -30, r: 19 }, { x: 64, z: -30, r: 19 }], treeH: 8,
  });
  W.scatterGrass(1800, [{ x: 0, z: 20, r: 24 }, { x: 0, z: -30, r: 26 }]);
  W.spots.courtyard = new THREE.Vector3(0, 0, -32); // within the king's walls, before the palace
  W.spots.playerStart = new THREE.Vector3(4, 0, 0);
  setFogRange(60, 240);
  return W;
}

export async function buildLumbini() {
  const W = new World({ size: 260, hills: 1.0, seed: 51, baseColor: 0x45724b, dirtColor: 0x628958 });
  W.flatten(0, 0, 22, 0.3);
  W.buildTerrain();
  W.addWater(-1.2);
  const willow = await loadModel('willow');
  placeModel(W, willow, 16, 0, -5, 0.3, 1.6, { sink: -3.0, remap: pastelRemap }); // roots below the turf
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
  const W = new World({ size: 320, hills: 2.6, seed: 67, baseColor: 0x446b39, dirtColor: 0x637a47, baseHeight: 2.2 });
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
  placeModel(W, bodhi, 20, -7.2, -24, 0, 2.0, { sink: -3, remap: pastelRemap }); // right behind the seat
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
  const W = new World({ size: 280, hills: 0.9, seed: 83, baseColor: 0x406b39, dirtColor: 0x5c794a, baseHeight: 0.8 });
  // river at west
  for (let z = -140; z <= 140; z += 12) W.flatten(-52 + Math.sin(z * 0.05) * 5, z, 10, -2.0);
  W.flatten(0, -8, 24, 0.35);  // teaching clearing
  W.buildTerrain();
  W.addWater(-1.0);
  const banyan = await loadModel('banyan');
  placeModel(W, banyan, 17, -3, -18, 0.9, 1.8, { sink: -0.4, remap: pastelRemap });
  // teaching mound
  const moundM = new THREE.MeshLambertMaterial({ color: 0x86a55e, flatShading: true });
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 0.55, 12), moundM);
  mound.position.set(0, W.groundHeight(0, -10) + 0.27, -10);
  mound.receiveShadow = true;
  W.group.add(mound);
  W.camBlockers.push(mound);
  // walkable: an inscribed solid block so the player can step up onto it
  W.addBlock(-1.55, 1.55, -11.55, -8.45, mound.position.y - 0.275, mound.position.y + 0.275);
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
  const W = new World({ size: 260, hills: 1.1, seed: 97, baseColor: 0x546c43, dirtColor: 0x736849 });
  W.flatten(0, -4, 20, 0.25);
  W.buildTerrain();
  const willow = await loadModel('willow');
  // twin sala trees, roots buried
  placeModel(W, willow, 18, -3.9, -6, 0.2, 1.5, { sink: -3, remap: pastelRemap });
  placeModel(W, willow, 17, 3.9, -6, 2.4, 1.5, { sink: -3, remap: pastelRemap });
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
