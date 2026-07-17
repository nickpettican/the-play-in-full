// Verlet cloth clothing: simulated outer robes, skirts and hair, plus static-baked
// tube tops and short over-skirts (wraps). Attached automatically by makePerson via
// dressCloth(); stepping rides each character's own P.update, so no loop changes.
// Parameters are tuned in clothtest.html — copy new numbers into the tables below.
// How the sim works: docs/cloth-simulation.md.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _g = new THREE.Vector3();
const _m = new THREE.Matrix4();

// ---------- kāṣāya rice-field patchwork (monastic robes and skirts) ----------
// drawn light so each robe's material colour tints it
let KASAYA = null;
function kasaya() {
  if (KASAYA) return KASAYA;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(50,25,0,0.28)';
  g.lineWidth = 5;
  const m = 12, cols = 5, w = (512 - 2 * m) / cols, h = 256 - 2 * m;
  g.strokeRect(m, m, 512 - 2 * m, h);
  for (let i = 0; i < cols; i++) {
    const x0 = m + i * w;
    if (i) { g.beginPath(); g.moveTo(x0, m); g.lineTo(x0, m + h); g.stroke(); }
    // staggered horizontal seams, alternating per strip like the traditional pattern
    for (const f of (i % 2 ? [0.33] : [0.22, 0.72])) {
      const y = m + f * h;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke();
    }
  }
  KASAYA = new THREE.CanvasTexture(c);
  KASAYA.wrapS = KASAYA.wrapT = THREE.RepeatWrapping;
  KASAYA.colorSpace = THREE.SRGBColorSpace;
  return KASAYA;
}

function clothMat(colour) {
  return new THREE.MeshPhysicalMaterial({
    color: colour, side: THREE.DoubleSide, roughness: 0.9,
    sheen: 0.6, sheenColor: new THREE.Color(0xffe2b0), sheenRoughness: 0.5,
  });
}

// ---------- tuned parameters (from clothtest.html; per dress class, per cloth kind) ----------
// shape: a flared tube, top ring lerping to hem ring; angles in units of π (len 2 =
// closed loop, seam bound). fHip/fOvalZ/fTopY shape female hips (skirt/wrap only).
// static: moulded once over the colliders, then baked rigid onto the anchor.
const WRAP = { // short over-skirt, waist to thigh — shared by monastics and men
  static: true,
  shape: { cols: 12, rows: 4, topR: 0.15, botR: 0.16, topY: 0.78, botY: 0.5,
           start: 0, len: 2, rotY: 0, sx: 1.05, sz: 0.7, y: 0, z: 0,
           bulge: 0, bulgeT: 0.5, fHip: 1.3, fHipT: 0.35, fOvalZ: 0.5, fTopY: 0.05 },
  sim: { gravity: 20, damping: 0.99, wind: 0, stiffness: 3, substeps: 1, maxSpeed: 4, colliderK: 0.5 },
};
const SETS = {
  monastic: { // monks and the Buddha (nuns wear the woman skirt/wrap/top, see dressCloth)
    robe: {
      shape: { cols: 12, rows: 8, topR: 0.19, botR: 0.3, topY: 0.5, botY: -0.6,
               start: -0.37, len: 1.77, rotY: 3.13, sx: 1.13, sz: 0.8, y: 0.06, z: 0 },
      sim: { gravity: 20, damping: 1, wind: 0, stiffness: 6, substeps: 1, maxSpeed: 3, colliderK: 0.6, follow: 1, sway: 0.15 },
    },
    skirt: {
      shape: { cols: 16, rows: 8, topR: 0.12, botR: 0.2, topY: 0.82, botY: 0.18,
               start: 0, len: 2, rotY: 0, sx: 1.1, sz: 0.75, y: 0, z: 0,
               bulge: 0.02, bulgeT: 0.18, fHip: 1.4, fHipT: 0.45, fOvalZ: 0, fTopY: 0 },
      sim: { gravity: 20, damping: 0.995, wind: 0, stiffness: 5, substeps: 1, maxSpeed: 5, colliderK: 0.6, follow: 1, sway: 0.15 },
    },
    wrap: WRAP,
  },
  woman: { // laywomen, devīs, nuns: cloth hair, static tube top, skirt, wrap
    hair: {
      shape: { cols: 12, rows: 8, topR: 0.1, botR: 0.3, topY: 0.18, botY: -0.55,
               start: 0.35, len: 1.3, rotY: 0, sx: 1.1, sz: 1, y: 0, z: -0.02,
               thick: 0.03, thick2: 0.012 },
      sim: { gravity: 20, damping: 0.95, wind: 1, stiffness: 2, substeps: 1, maxSpeed: 3, colliderK: 1, follow: 1, sway: 0.4 },
    },
    top: {
      static: true, // the sim explodes against the breast colliders
      shape: { cols: 12, rows: 6, topR: 0.17, botR: 0.14, topY: 0.5, botY: 0.18,
               start: 0, len: 2, rotY: 0, sx: 1.07, sz: 0.8, y: 0, z: 0 },
      sim: { gravity: 25, damping: 0.99, wind: 0, stiffness: 2, substeps: 1, maxSpeed: 1, colliderK: 0.48 },
    },
    skirt: {
      shape: { cols: 16, rows: 8, topR: 0.12, botR: 0.2, topY: 0.82, botY: 0.18,
               start: 0, len: 2, rotY: 0, sx: 1.15, sz: 1, y: 0, z: 0,
               bulge: 0.02, bulgeT: 0.18, fHip: 1.4, fHipT: 0.45, fOvalZ: 0, fTopY: 0 },
      sim: { gravity: 20, damping: 0.995, wind: 0, stiffness: 4, substeps: 1, maxSpeed: 5, colliderK: 0.6, follow: 1, sway: 0.3 },
    },
    wrap: {
      static: true,
      shape: { cols: 12, rows: 4, topR: 0.12, botR: 0.2, topY: 0.79, botY: 0.6,
               start: 0, len: 2, rotY: 0, sx: 1, sz: 0.7, y: 0.03, z: 0,
               bulge: 0.005, bulgeT: 0.5, fHip: 1.17, fHipT: 0.43, fOvalZ: 1, fTopY: 0 },
      sim: { gravity: 20, damping: 0.99, wind: 0, stiffness: 3, substeps: 1, maxSpeed: 4, colliderK: 0.5 },
    },
  },
  man: { // laymen, princes, devas: shoulder-length cloth hair, skirt, wrap
    hair: {
      shape: { cols: 10, rows: 8, topR: 0.1, botR: 0.2, topY: 0.19, botY: -0.2,
               start: 0.35, len: 1.3, rotY: 0, sx: 1.1, sz: 1, y: 0, z: -0.02,
               thick: 0.03, thick2: 0.012 },
      sim: { gravity: 20, damping: 0.99, wind: 0.3, stiffness: 2, substeps: 1, maxSpeed: 4, colliderK: 0.5, follow: 1, sway: 0.15 },
    },
    skirt: {
      shape: { cols: 16, rows: 8, topR: 0.17, botR: 0.28, topY: 0.78, botY: 0.18,
               start: 0, len: 2, rotY: 0, sx: 0.98, sz: 0.65, y: 0, z: 0,
               bulge: 0, bulgeT: 0.5, fHip: 1.3, fHipT: 0.35, fOvalZ: 0.5, fTopY: 0.05 },
      sim: { gravity: 20, damping: 0.995, wind: 0, stiffness: 4, substeps: 1, maxSpeed: 5, colliderK: 0.5, follow: 1, sway: 0.3 },
    },
    wrap: WRAP,
  },
  ascetic: { // short skirt in place of the rigid wrap
    skirt: {
      shape: { cols: 16, rows: 8, topR: 0.16, botR: 0.25, topY: 0.8, botY: 0.45,
               start: 0, len: 2, rotY: 0, sx: 1.06, sz: 0.68, y: 0, z: 0,
               bulge: 0.02, bulgeT: 0.18, fHip: 1.4, fHipT: 0.45, fOvalZ: 0, fTopY: 0 },
      sim: { gravity: 20, damping: 0.995, wind: 0, stiffness: 4, substeps: 1, maxSpeed: 3, colliderK: 0.4, follow: 1, sway: 0.3 },
    },
  },
};
// the nun's top hem runs lower than the lay one
const NUN_TOP = { ...SETS.woman.top, shape: { ...SETS.woman.top.shape, botY: 0 } };
// seated: robe hem ends above the seat, the skirt becomes a low pooled cone.
// Sims are merged OVER the standing sim (follow/sway carry through), like clothtest.
const SIT = {
  robe: {
    shape: { cols: 12, rows: 8, topR: 0.2, botR: 0.18, topY: 0.5, botY: -0.18,
             start: -0.37, len: 1.77, rotY: 3.13, sx: 1.13, sz: 0.8, y: 0.06, z: 0 },
    sim: { gravity: 20, damping: 1, wind: 0, stiffness: 6, substeps: 1, maxSpeed: 3, colliderK: 0.5 },
  },
  skirt: {
    shape: { cols: 16, rows: 8, topR: 0.245, botR: 0.45, topY: 0.25, botY: 0,
             start: 0, len: 2, rotY: 0, sx: 1, sz: 0.8, y: 0, z: 0.1,
             bulge: 0, bulgeT: 0.5, fHip: 1, fHipT: 0.35, fOvalZ: 0, fTopY: 0 },
    sim: { gravity: 20, damping: 0.9, wind: 0, stiffness: 3, substeps: 1, maxSpeed: 0.5, colliderK: 0.5 },
  },
};

// ---------- the cloth itself ----------
// A cols×rows Verlet particle grid pinned at the top ring. Particles live in world
// space; each frame their positions are written back in the character group's local
// space, so the mesh is an ordinary child of the group (fades, removal and nested
// parents like the carriage all just work).
class Cloth {
  constructor(P, kind, colour, def) {
    this.P = P; this.kind = kind;
    this.shape = def.shape; this.sim = def.sim; this.static = !!def.static;
    const shape = this.shape, info = P.clothInfo;
    this.anchor = (kind === 'skirt' || kind === 'wrap') ? P.group
      : kind === 'hair' ? P.headG : P.body;
    this.anchor.updateWorldMatrix(true, false);
    const W = shape.cols, H = shape.rows;
    this.W = W;
    const yK = (kind === 'robe' || kind === 'top') ? P.tK : 1;
    const hips = kind === 'skirt' || kind === 'wrap';
    const fHip = (hips && info.female) ? (shape.fHip ?? 1) : 1;
    const fOvalZ = shape.fOvalZ ?? 1;
    this.local = [];
    for (let r = 0; r < H; r++) {
      const t = r / (H - 1);
      // bulge: a rounded mid-profile swell peaking at bulgeT (semi-spherical wraps)
      const rad = THREE.MathUtils.lerp(shape.topR, shape.botR, t) +
        (shape.bulge ?? 0) * Math.sin(Math.PI * Math.min(t / (2 * (shape.bulgeT ?? 0.5)), 1));
      // female hips: a bump peaking at fHipT of the way down, wider in x than z (oval)
      const b = (fHip - 1) * Math.sin(Math.PI * THREE.MathUtils.clamp(t / (2 * (shape.fHipT ?? 0.35)), 0, 1));
      const radX = rad * (1 + b), radZ = rad * (1 + b * fOvalZ);
      const y = (THREE.MathUtils.lerp(shape.topY, shape.botY, t) +
                 (hips && info.female ? (shape.fTopY ?? 0) : 0)) * yK + shape.y;
      for (let c = 0; c < W; c++) {
        const phi = shape.rotY + Math.PI * (shape.start + shape.len * c / (W - 1));
        this.local.push(new THREE.Vector3(
          Math.sin(phi) * radX * shape.sx, y, Math.cos(phi) * radZ * shape.sz + shape.z));
      }
    }
    this.p = this.local.map(v => this.anchor.localToWorld(v.clone()));
    this.prev = this.p.map(v => v.clone());
    // structural + shear constraints; a closed loop (len≈2) binds the seam columns
    this.cons = [];
    const idx = (r, c) => r * W + c;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (c + 1 < W) this.addCon(idx(r, c), idx(r, c + 1));
      if (r + 1 < H) this.addCon(idx(r, c), idx(r + 1, c));
      if (r + 1 < H && c + 1 < W) { this.addCon(idx(r, c), idx(r + 1, c + 1)); this.addCon(idx(r, c + 1), idx(r + 1, c)); }
    }
    if (Math.abs(shape.len - 2) < 0.05) for (let r = 1; r < H; r++) this.addCon(idx(r, 0), idx(r, W - 1));
    // sphere colliders; leg ones skipped while seated (legs hidden)
    const s = P.group.getWorldScale(_v).x || 1, tK = P.tK;
    this.spheres = [
      { obj: P.headG, off: new THREE.Vector3(0, 0.09, 0), r: 0.15 * s },
      { obj: P.body, off: new THREE.Vector3(0, 0.42 * tK, 0), r: 0.17 * s },
      { obj: P.body, off: new THREE.Vector3(0, 0.20 * tK, 0), r: 0.19 * s },
      { obj: P.body, off: new THREE.Vector3(0, -0.02, 0), r: 0.20 * s },
      { obj: P.legL, off: new THREE.Vector3(0, -0.28, 0), r: 0.11 * s, leg: true },
      { obj: P.legL, off: new THREE.Vector3(0, -0.60, 0), r: 0.10 * s, leg: true },
      { obj: P.legR, off: new THREE.Vector3(0, -0.28, 0), r: 0.11 * s, leg: true },
      { obj: P.legR, off: new THREE.Vector3(0, -0.60, 0), r: 0.10 * s, leg: true },
    ];
    // sized so that at the default colliderK (~0.55) they still cover the breast meshes
    if (info.breasts) this.spheres.push(
      { obj: P.body, off: new THREE.Vector3(-0.085, 0.40 * tK, 0.09), r: 0.21 * s },
      { obj: P.body, off: new THREE.Vector3(0.085, 0.40 * tK, 0.09), r: 0.21 * s });
    this.sw = this.spheres.map(() => new THREE.Vector3()); // per-step world centres
    this.H = H;
    this.geo = new THREE.PlaneGeometry(1, 1, W - 1, H - 1); // vertex order matches r*W+c
    this.mesh = new THREE.Mesh(this.geo, clothMat(colour));
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    // rice-field patchwork on the monastic outer robe and lower skirt alike
    if (kind === 'robe' || (kind === 'skirt' && info.monastic)) this.mesh.material.map = kasaya();
    if (this.static) {
      // rigid, but moulded once over the colliders (so the top drapes over the breasts),
      // then baked in local space to ride the anchor's transform
      const { p } = this;
      for (let k = 0; k < 4; k++) {
        for (const [a, b, rest] of this.cons) {
          _v.subVectors(p[b], p[a]);
          const d = _v.length() || 1e-6;
          _v.multiplyScalar((d - rest) / d);
          const fa = a >= W, fb = b >= W;
          if (fa && fb) { p[a].addScaledVector(_v, 0.5); p[b].addScaledVector(_v, -0.5); }
          else if (fa) p[a].add(_v);
          else if (fb) p[b].sub(_v);
        }
        for (const sp of this.spheres) {
          if (sp.leg && !sp.obj.visible) continue;
          sp.obj.localToWorld(_w.copy(sp.off));
          const r = sp.r * this.sim.colliderK;
          for (let i = W; i < p.length; i++) {
            _v.subVectors(p[i], _w);
            const d = _v.length();
            if (d < r) p[i].copy(_w).addScaledVector(_v, r / (d || 1e-6));
          }
        }
      }
      const a = this.geo.attributes.position;
      p.forEach((v, i) => { this.anchor.worldToLocal(v); a.setXYZ(i, v.x, v.y, v.z); });
      this.geo.computeVertexNormals();
      this.anchor.add(this.mesh);
      return;
    }
    P.group.add(this.mesh);
    if (shape.thick) {
      // hair volume: an inner shell pulled toward the head axis, one row shorter so
      // its hem edge hides behind the outer sheet
      this.n2 = W * (H - 1);
      this.geo2 = new THREE.PlaneGeometry(1, 1, W - 1, H - 2);
      this.mesh2 = new THREE.Mesh(this.geo2, this.mesh.material);
      this.mesh2.frustumCulled = false;
      this.mesh2.castShadow = true;
      P.group.add(this.mesh2);
    }
    this.aPrev = this.anchor.getWorldPosition(new THREE.Vector3());
    this.write();
  }
  addCon(a, b) { this.cons.push([a, b, this.p[a].distanceTo(this.p[b])]); }
  reset() {
    this.local.forEach((l, i) => {
      this.anchor.localToWorld(this.p[i].copy(l));
      this.prev[i].copy(this.p[i]);
    });
    this.anchor.getWorldPosition(this.aPrev);
    this.write();
  }
  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.geo.dispose();
    if (this.mesh2) { this.mesh2.parent?.remove(this.mesh2); this.geo2.dispose(); }
    this.mesh.material.dispose();
  }
  step(h, t) {
    if (this.static) return;
    const { p, prev, W, sim } = this;
    // a large jump of the anchor (teleport, act spawn) snaps the cloth rather than trailing
    this.anchor.getWorldPosition(_v);
    if (_v.distanceToSquared(this.aPrev) > 1) return this.reset();
    // follow: free particles inherit the body's motion beyond what maxSpeed lets them
    // chase — walking swing is untouched, but a running player can't outpace the robe
    // and sling it back like a cape. follow scales how much of the excess is inherited.
    if (sim.follow) {
      _g.subVectors(_v, this.aPrev);
      const d = _g.length(), free = sim.maxSpeed * h;
      if (d > free) {
        _g.multiplyScalar(sim.follow * (d - free) / d);
        for (let i = W; i < p.length; i++) { p[i].add(_g); prev[i].add(_g); }
      }
    }
    this.aPrev.copy(_v);
    for (let c = 0; c < W; c++) {      // pin the top ring
      this.anchor.localToWorld(_v.copy(this.local[c]));
      p[c].copy(_v); prev[c].copy(_v);
    }
    const vmax = sim.maxSpeed * h;
    for (let i = W; i < p.length; i++) {
      _v.subVectors(p[i], prev[i]).multiplyScalar(sim.damping);
      if (_v.lengthSq() > vmax * vmax) _v.setLength(vmax); // clamp: no whip-crack explosions
      prev[i].copy(p[i]);
      p[i].add(_v);
      p[i].y -= sim.gravity * h * h;
      p[i].z += Math.sin(t * 1.3 + p[i].x * 2) * sim.wind * h * h;
    }
    // collider centres once per step; push-out runs INSIDE the solver loop so the
    // constraints can no longer drag particles back through the body (legs/torso)
    for (let j = 0; j < this.spheres.length; j++) {
      const sp = this.spheres[j];
      if (!(sp.leg && !sp.obj.visible)) sp.obj.localToWorld(this.sw[j].copy(sp.off));
    }
    for (let k = 0; k < sim.stiffness; k++) {
      for (const [a, b, rest] of this.cons) {
        _v.subVectors(p[b], p[a]);
        const d = _v.length() || 1e-6;
        _v.multiplyScalar((d - rest) / d);
        const fa = a >= W, fb = b >= W;
        if (fa && fb) { p[a].addScaledVector(_v, 0.5); p[b].addScaledVector(_v, -0.5); }
        else if (fa) p[a].add(_v);   // pinned partner: free end takes the whole correction
        else if (fb) p[b].sub(_v);
      }
      for (let j = 0; j < this.spheres.length; j++) {
        const sp = this.spheres[j];
        if (sp.leg && !sp.obj.visible) continue;
        const c = this.sw[j], r = sp.r * sim.colliderK;
        for (let i = W; i < p.length; i++) {
          _v.subVectors(p[i], c);
          const d = _v.length();
          if (d < r) p[i].copy(c).addScaledVector(_v, r / (d || 1e-6));
        }
      }
    }
    // sway: hard cap on deviation from the rest pose, growing toward the hem — starts,
    // stops and turns can't fling the cloth about. Bounded movement, not static.
    if (sim.sway) {
      for (let i = W; i < p.length; i++) {
        const lim = sim.sway * ((i / W) | 0) / (this.H - 1);
        this.anchor.localToWorld(_w.copy(this.local[i]));
        _v.subVectors(p[i], _w);
        const d = _v.length();
        if (d > lim) p[i].copy(_w).addScaledVector(_v, lim / d);
      }
    }
    // hems pool on the ground the character stands on, wherever that is
    const gy = _g.setFromMatrixPosition(this.P.group.matrixWorld).y + 0.02;
    for (let i = W; i < p.length; i++) if (p[i].y < gy) p[i].y = gy;
    this.write();
  }
  write() {
    _m.copy(this.P.group.matrixWorld).invert();
    const a = this.geo.attributes.position;
    this.p.forEach((v, i) => { _v.copy(v).applyMatrix4(_m); a.setXYZ(i, _v.x, _v.y, _v.z); });
    a.needsUpdate = true;
    this.geo.computeVertexNormals();
    if (this.geo2) {
      // offset tapers thick → thick2 down the rows, so the two layers converge at
      // the hem instead of reading as a visibly separate under-sheet
      const t1 = this.shape.thick, t2 = this.shape.thick2 ?? t1;
      const b = this.geo2.attributes.position, W = this.W, rowsN = this.H - 2 || 1;
      this.anchor.getWorldPosition(_w);
      for (let i = 0; i < this.n2; i++) {
        const v = this.p[i];
        const th = t1 + (t2 - t1) * (((i / W) | 0) / rowsN);
        _g.set(v.x - _w.x, 0, v.z - _w.z);
        const l = _g.length() || 1e-6;
        _v.set(v.x - _g.x / l * th, v.y, v.z - _g.z / l * th).applyMatrix4(_m);
        b.setXYZ(i, _v.x, _v.y, _v.z);
      }
      b.needsUpdate = true;
      this.geo2.computeVertexNormals();
    }
  }
}

// ---------- dressing ----------
// Decides which cloths a character wears, builds them, and hooks setAnim/update so
// sitting swaps to the seated shapes and the sim steps with the character.
// info: {kind, female, monastic, breasts, skinny, outerRobe, robe, outerRobeColour,
//        hairColor, skirtColour}
export function dressCloth(P, info) {
  let set, spec;
  const monastic = info.monastic || info.kind === 'buddha';
  if (monastic) {
    // nuns wear the female-cut skirt and wrap (kāṣāya-patterned, robe-coloured)
    // plus a low-hemmed tube top in the outer-robe colour
    set = info.female
      ? { ...SETS.monastic, skirt: SETS.woman.skirt, wrap: SETS.woman.wrap, top: NUN_TOP }
      : SETS.monastic;
    spec = { skirt: info.robe, wrap: info.robe };
    if (info.female) spec.top = info.outerRobeColour ?? info.robe;
    if (info.outerRobe) spec.robe = info.outerRobeColour;
  } else if (info.kind === 'ascetic' || info.skinny) {
    set = SETS.ascetic;
    spec = { skirt: info.robe };
  } else if (info.kind === 'demon') {
    return; // demons keep their rigid dress
  } else {
    const skirtC = info.skirtColour ?? new THREE.Color(info.robe).multiplyScalar(0.78);
    set = info.female ? SETS.woman : SETS.man;
    spec = info.female
      ? { hair: info.hairColor, top: info.robe, skirt: skirtC, wrap: skirtC }
      : { hair: info.hairColor, skirt: info.robe, wrap: info.robe };
  }
  P.clothInfo = { female: info.female, breasts: info.breasts, monastic };
  const C = P.cloths = [];
  const hideRigid = () => {
    if ('skirt' in spec) {
      P.skirt.visible = false;
      if (P.overSkirt) P.overSkirt.visible = false;
    }
  };
  const build = () => {
    // keep material state (the witness forms clone materials translucent) across rebuilds
    const prior = {};
    for (const c of C) { prior[c.kind] = c.mesh.material; c.dispose(); }
    C.length = 0;
    const seated = P.anim === 'sit', lying = P.anim === 'lie';
    for (const [kind, colour] of Object.entries(spec)) {
      let def = set[kind];
      if (seated && SIT[kind])
        def = { ...def, shape: SIT[kind].shape, sim: { ...def.sim, ...SIT[kind].sim } };
      // lying (sleepers, the parinirvāṇa): bake robe and skirt rigid — gravity is
      // sideways to a lying body, so live cloth would slide off it. Hair stays live.
      if (lying && !def.static && kind !== 'hair') def = { ...def, static: true };
      const c = new Cloth(P, kind, colour, def);
      const pm = prior[kind];
      if (pm) {
        c.mesh.material.transparent = pm.transparent;
        c.mesh.material.opacity = pm.opacity;
      }
      c.mesh.visible = !(seated && kind === 'wrap'); // short over-skirt: hidden seated
      // seated monastics: the skirt cloth takes the outer-robe colour
      if (kind === 'skirt' && 'robe' in spec)
        c.mesh.material.color.set(seated ? spec.robe : spec.skirt);
      C.push(c);
    }
    hideRigid();
    // …and the crossed-legs seat base takes the outer-robe colour (monastics) or the
    // skirt colour (its own material, never the shared robe one)
    const baseC = 'robe' in spec ? spec.robe : spec.skirt;
    if (P._sitBase && baseC !== undefined) {
      P._origBaseMat ??= P._sitBase.material;
      if (seated) {
        P._robeBaseMat ??= new THREE.MeshLambertMaterial({ flatShading: true });
        P._robeBaseMat.color.set(baseC);
        P._sitBase.material = P._robeBaseMat;
      } else P._sitBase.material = P._origBaseMat;
    }
  };
  build();
  let mode = P.anim;
  const origSet = P.setAnim;
  P.setAnim = (a) => {
    origSet(a);
    hideRigid(); // setAnim re-shows the rigid skirt the cloth replaces
    // sit and lie each rebuild into their own shapes; everything else shares one
    const m = (a === 'sit' || a === 'lie') ? a : 'up';
    const prev = (mode === 'sit' || mode === 'lie') ? mode : 'up';
    mode = a;
    if (m !== prev) build();
  };
  const origUpd = P.update;
  P.update = (dt, t) => {
    origUpd(dt, t);
    P.group.updateWorldMatrix(true, true);
    for (const c of C) {
      const n = Math.max(1, c.sim.substeps | 0), h = Math.min(dt, 0.033) / n;
      for (let s = 0; s < n; s++) c.step(h, t);
    }
  };
}
