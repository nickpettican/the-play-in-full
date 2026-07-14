// Points-based particle systems: petals, motes, bursts, radiance.
import * as THREE from 'three';
import { scene } from './engine.js';

function discTexture(rgb = '255,235,200') {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.6, `rgba(${rgb},0.5)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
let softTex = null;
const getSoft = () => (softTex ||= discTexture());

const systems = [];

// Generic system: n particles with pos, vel, life; respawn callback.
function makeSystem({ n, color = 0xffffff, size = 0.12, additive = true, vertexColors = false, gravity = 0, drag = 1, spawn, respawn = true }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const life = new Float32Array(n);
  const maxLife = new Float32Array(n);
  const col = vertexColors ? new Float32Array(n * 3) : null;
  const P = { dead: false };
  const init = i => {
    const s = spawn(i);
    pos.set(s.p, i * 3); vel.set(s.v, i * 3);
    life[i] = maxLife[i] = s.life;
    if (col && s.c) col.set(s.c, i * 3);
  };
  for (let i = 0; i < n; i++) { init(i); life[i] = Math.random() * maxLife[i]; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({
    color: vertexColors ? 0xffffff : color, size, map: getSoft(),
    transparent: true, depthWrite: false, vertexColors,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    opacity: 0.9,
  });
  const points = new THREE.Points(geo, m);
  points.frustumCulled = false;
  scene.add(points);
  P.points = points;
  P.update = (dt) => {
    let alive = 0;
    for (let i = 0; i < n; i++) {
      life[i] -= dt;
      if (life[i] <= 0) {
        if (respawn && !P.stopping) { init(i); }
        else { pos[i * 3 + 1] = -9999; continue; }
      }
      alive++;
      vel[i * 3 + 1] -= gravity * dt;
      vel[i * 3] *= drag; vel[i * 3 + 1] *= drag; vel[i * 3 + 2] *= drag;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
    }
    geo.attributes.position.needsUpdate = true;
    if (!alive && P.stopping) P.kill();
  };
  P.kill = () => { if (P.dead) return; P.dead = true; scene.remove(points); geo.dispose(); m.dispose(); };
  P.stop = () => { P.stopping = true; };
  systems.push(P);
  return P;
}

export function updateParticles(dt) {
  for (let i = systems.length - 1; i >= 0; i--) {
    if (systems[i].dead) systems.splice(i, 1);
    else systems[i].update(dt);
  }
}
export function clearParticles() {
  for (const s of systems) s.kill();
  systems.length = 0;
}

// ---------- presets ----------
// Falling petals around a point (e.g. celebration, Lumbini).
export function petals(center, radius = 12, n = 120, colors = [[1, .7, .75], [1, .9, .6], [1, 1, 1], [.98, .6, .5]]) {
  return makeSystem({
    n, size: 0.16, additive: false, vertexColors: true, gravity: 0.12, drag: 0.995,
    spawn: () => {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
      const c = colors[(Math.random() * colors.length) | 0];
      return {
        p: [center.x + Math.cos(a) * r, center.y + 6 + Math.random() * 6, center.z + Math.sin(a) * r],
        v: [(Math.random() - 0.5) * 0.5, -0.4 - Math.random() * 0.4, (Math.random() - 0.5) * 0.5],
        life: 10 + Math.random() * 6, c,
      };
    },
  });
}

// Petals let fall from moving sources (the gods' hands overhead).
export function petalsFrom(sources, n = 600,
  colors = [[1, .7, .75], [1, .9, .6], [1, 1, 1], [.98, .6, .5]]) {
  const w = new THREE.Vector3();
  return makeSystem({
    // large: they fall from 25-45m up, so they must read at that distance
    n, size: 0.55, additive: false, vertexColors: true, gravity: 0.25, drag: 0.995,
    spawn: () => {
      sources[(Math.random() * sources.length) | 0].getWorldPosition(w);
      return {
        p: [w.x, w.y, w.z],
        v: [(Math.random() - 0.5) * 0.4, -0.3 - Math.random() * 0.3, (Math.random() - 0.5) * 0.4],
        life: 14 + Math.random() * 8, c: colors[(Math.random() * colors.length) | 0],
      };
    },
  });
}

// Ambient light motes drifting upward (heaven / radiance).
export function motes(center, radius = 25, n = 160, color = 0xffe9b0) {
  return makeSystem({
    n, size: 0.14, color, gravity: -0.02, drag: 0.998,
    spawn: () => {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
      return {
        p: [center.x + Math.cos(a) * r, center.y + Math.random() * 5, center.z + Math.sin(a) * r],
        v: [(Math.random() - 0.5) * 0.15, 0.15 + Math.random() * 0.25, (Math.random() - 0.5) * 0.15],
        life: 8 + Math.random() * 6,
      };
    },
  });
}

// One-shot colourful burst (Mara's weapons disintegrating).
export function burst(at, n = 40) {
  const cols = [[1, .55, .3], [1, .85, .3], [.6, .8, 1], [1, .5, .8], [.7, 1, .6]];
  const s = makeSystem({
    n, size: 0.18, vertexColors: true, gravity: 0.5, drag: 0.985, respawn: false,
    spawn: () => {
      const c = cols[(Math.random() * cols.length) | 0];
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI;
      const sp = 0.6 + Math.random() * 1.4;
      return {
        p: [at.x, at.y, at.z],
        v: [Math.sin(b) * Math.cos(a) * sp, Math.cos(b) * sp * 0.6 - 0.2, Math.sin(b) * Math.sin(a) * sp],
        life: 2.2 + Math.random() * 1.6, c,
      };
    },
  });
  s.stopping = true; // one-shot
  return s;
}

// Radiance column for the awakening.
export function radiance(at, n = 260) {
  return makeSystem({
    n, size: 0.22, color: 0xfff0c8, gravity: -0.25, drag: 0.996,
    spawn: () => {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 2.4;
      return {
        p: [at.x + Math.cos(a) * r, at.y + Math.random() * 1.5, at.z + Math.sin(a) * r],
        v: [Math.cos(a) * 0.1, 0.8 + Math.random() * 1.4, Math.sin(a) * 0.1],
        life: 4 + Math.random() * 4,
      };
    },
  });
}

// Fireflies for night scenes.
export function fireflies(center, radius = 20, n = 40) {
  return makeSystem({
    n, size: 0.1, color: 0xd8ffa0, gravity: 0, drag: 0.99,
    spawn: () => {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
      return {
        p: [center.x + Math.cos(a) * r, center.y + 0.5 + Math.random() * 2, center.z + Math.sin(a) * r],
        v: [(Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.4],
        life: 3 + Math.random() * 4,
      };
    },
  });
}

// Gentle golden aura around the player (focus reward).
export function aura(target, dur = 20) {
  const s = makeSystem({
    n: 50, size: 0.09, color: 0xffdf90, gravity: -0.05, drag: 0.99,
    spawn: () => {
      const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.4;
      return {
        p: [target.position.x + Math.cos(a) * r, target.position.y + 0.3 + Math.random() * 1.4, target.position.z + Math.sin(a) * r],
        v: [0, 0.2 + Math.random() * 0.2, 0],
        life: 1.5 + Math.random(),
      };
    },
  });
  setTimeout(() => s.stop(), dur * 1000);
  return s;
}
