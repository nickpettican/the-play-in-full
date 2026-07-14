// Third-person player: input (desktop + touch), physics, camera with collision.
import * as THREE from 'three';
import { camera, scene, renderer } from './engine.js';
import { makePerson, makeBowl, makeHalo } from './characters.js';
import { dialogue, focusHud } from './dialogue.js';
import { sfxStep, initAudio } from './audio.js';

export const player = {
  pos: new THREE.Vector3(0, 0, 8),
  vel: new THREE.Vector3(),
  yaw: 0, camYaw: 0, camPitch: 0.25, camDist: 5.2,
  grounded: true,
  sitting: false,
  bowlOut: false,
  person: null,
  world: null,          // set by game: {groundHeight, colliders, camBlockers, size}
  speedWalk: 4.2, speedRun: 7.5,
  onInteract: null,     // set by acts
  onBow: null,
  frozen: false,        // during cutscenes
  camLook: null,        // Vector3: the camera pans to look here instead of the player
};

const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function attachBowl() {
  player.bowl = makeBowl();
  player.bowl.scale.setScalar(2);
  player.bowl.visible = false;
  player.person.body.add(player.bowl); // resting on top of the cradling hands
  player.bowl.position.set(0, 0.28, 0.32);
}

export function createPlayerAvatar(kind /* 'monk' | 'nun' */) {
  if (player.person) scene.remove(player.person.group);
  const nun = kind === 'nun';
  player.kind = kind;
  player.person = makePerson({
    kind, robe: nun ? 0xb35c2e : 0xcc7722,
    skin: nun ? 0xd8a877 : 0xc8996c,
  });
  // the player's halo glows with mindfulness: full focus = full halo, none = none
  player.mindHalo = makeHalo('gold', 0.75);
  player.mindHalo.position.set(0, 0.12, 0);
  player.mindHalo.material.opacity = 0;
  player.person.headG.add(player.mindHalo);
  attachBowl();
  scene.add(player.person.group);
}

// The player's witnessing forms: a god in Tushita, then a translucent monastic —
// unseen by others, until the first teaching, where the same faint form can be
// addressed ('veiled'); afterwards, solid flesh again.
export function setWitnessForm(mode /* 'heavenly' | 'translucent' | 'veiled' | 'normal' */) {
  player.bowlOut = false;
  if (mode === 'heavenly') {
    const nun = player.kind === 'nun';
    if (player.person) scene.remove(player.person.group);
    player.person = makePerson({
      kind: nun ? 'devi' : 'deva', robe: 0xe8d8f8,
      skin: nun ? 0xd8a877 : 0xc8996c, ornate: true, halo: 'white',
    });
    player.person.group.traverse(o => {
      if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.8; }
    });
    attachBowl();
    scene.add(player.person.group);
  } else {
    createPlayerAvatar(player.kind);
    if (mode === 'translucent' || mode === 'veiled') {
      player.person.group.traverse(o => {
        if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; }
      });
    }
  }
  player.heavenly = mode === 'heavenly';
  player.translucent = mode === 'translucent'; // 'veiled' looks the same but can be seen and addressed
}
export const setHeavenly = (on) => setWitnessForm(on ? 'heavenly' : 'normal');

// ---------- input ----------
const keys = {};
let interactQueued = false, bowQueued = false;

// E interact · F bow · R begging bowl · Ctrl sit
addEventListener('keydown', e => {
  if (e.code === 'Tab') e.preventDefault();
  keys[e.code] = true;
  if (dialogue.open) return;
  if (e.code === 'KeyE' && !e.repeat) interactQueued = true;
  if (e.code === 'KeyF' && !e.repeat) bowQueued = true;
  if (e.code === 'KeyR' && !e.repeat) toggleBowl();
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
    e.preventDefault();
    if (!e.repeat) player.sitToggle = !player.sitToggle;
  }
});
addEventListener('keyup', e => keys[e.code] = false);

function toggleBowl() {
  player.bowlOut = !player.bowlOut;
  if (player.bowl) player.bowl.visible = player.bowlOut;
  const P = player.person;
  if (!P) return;
  // elbows back and out, hands cradling the bowl close before the belly
  P.lockArms = player.bowlOut;
  if (player.bowlOut) {
    P.armL.rotation.set(-0.12, 0.3, -0.13); P.elbL.rotation.set(-1.35, 0, 0.55);
    P.armR.rotation.set(-0.12, -0.3, 0.13); P.elbR.rotation.set(-1.35, 0, -0.55);
  } else {
    P.armL.rotation.set(0, 0, -0.08); P.elbL.rotation.set(-0.12, 0, 0);
    P.armR.rotation.set(0, 0, 0.08); P.elbR.rotation.set(-0.12, 0, 0);
  }
}

const canvas = renderer.domElement;
canvas.addEventListener('click', () => {
  initAudio();
  if (dialogue.open) return;
  if (!IS_TOUCH && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
    return;
  }
  interactQueued = true;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousedown', e => {
  // contextmenu doesn't fire reliably under pointer lock; use the raw button
  if (e.button === 2 && !dialogue.open) bowQueued = true;
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement === canvas && !dialogue.open) {
    // standard: mouse right looks right, mouse down looks down
    player.camYaw -= e.movementX * 0.0026;
    player.camPitch = THREE.MathUtils.clamp(player.camPitch + e.movementY * 0.0022, -0.55, 1.15);
  }
});

// ---------- touch ----------
const mobileUI = document.getElementById('mobileUI');
const stickMove = { x: 0, y: 0 };
if (IS_TOUCH) {
  mobileUI.style.display = 'block';
  document.getElementById('ctrlHint').style.display = 'none';
  // go fullscreen landscape; retry on each gesture until one sticks — Chrome Android
  // sometimes rejects the very first request (best effort; iOS Safari never allows it,
  // the rotate overlay covers that). ponytail: promise chain, not async, so a failed
  // orientation.lock can't swallow a successful fullscreen.
  addEventListener('touchend', () => {
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock('landscape'))
      .catch(() => {});
  }, { passive: true });
  const stick = document.getElementById('stick');
  const knob = document.getElementById('knob');
  let stickId = null, lookId = null, lx = 0, ly = 0, lookMoved = 0, pinchD = 0;

  stick.addEventListener('touchstart', e => {
    e.preventDefault(); stickId = e.changedTouches[0].identifier;
  }, { passive: false });

  addEventListener('touchstart', e => {
    initAudio();
    for (const t of e.changedTouches) {
      if (t.identifier !== stickId && lookId === null && t.clientX > innerWidth * 0.4) {
        lookId = t.identifier; lx = t.clientX; ly = t.clientY; lookMoved = 0;
      }
    }
  });
  addEventListener('touchmove', e => {
    // pinch zoom: two touches off the stick
    const pts = [...e.touches].filter(t => t.identifier !== stickId);
    if (pts.length >= 2) {
      const d = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      if (pinchD) player.camDist = THREE.MathUtils.clamp(player.camDist - (d - pinchD) * 0.02, 2.2, 10);
      pinchD = d;
      lookMoved = 99; // a pinch is never a tap-to-interact
      const lp = pts.find(t => t.identifier === lookId);
      if (lp) { lx = lp.clientX; ly = lp.clientY; } // keep look anchor fresh so the camera doesn't jump after the pinch
    } else pinchD = 0;
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        const r = stick.getBoundingClientRect();
        let dx = (t.clientX - (r.left + 55)) / 55, dy = (t.clientY - (r.top + 55)) / 55;
        const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
        stickMove.x = dx; stickMove.y = dy;
        knob.style.left = (35 + dx * 32) + 'px';
        knob.style.top = (35 + dy * 32) + 'px';
      } else if (pinchD) {
        // camera look is suspended while pinching
      } else if (t.identifier === lookId && !dialogue.open) {
        player.camYaw -= (t.clientX - lx) * 0.005;
        player.camPitch = THREE.MathUtils.clamp(player.camPitch + (t.clientY - ly) * 0.004, -0.55, 1.15);
        lookMoved += Math.abs(t.clientX - lx) + Math.abs(t.clientY - ly);
        lx = t.clientX; ly = t.clientY;
      }
    }
  }, { passive: true });
  addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; stickMove.x = stickMove.y = 0; knob.style.left = '35px'; knob.style.top = '35px'; }
      if (t.identifier === lookId) {
        if (lookMoved < 12 && !dialogue.open) interactQueued = true; // tap = interact
        lookId = null;
      }
    }
    pinchD = 0;
  });
  document.getElementById('btnAct').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (!dialogue.open) interactQueued = true; }, { passive: false });
  document.getElementById('btnJump').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); keys.Space = true; setTimeout(() => keys.Space = false, 120); }, { passive: false });
  document.getElementById('btnBow').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (!dialogue.open) bowQueued = true; }, { passive: false });
  document.getElementById('btnBowl').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (!dialogue.open) toggleBowl(); }, { passive: false });
  document.getElementById('btnSit').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); player.sitToggle = !player.sitToggle; }, { passive: false });
}

// ---------- physics + camera ----------
const _dir = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _lookPt = new THREE.Vector3(), _lastLook = new THREE.Vector3();
let _lookBlend = 0;
const _ray = new THREE.Raycaster();
let stepAcc = 0;

export function updatePlayer(dt, t) {
  const W = player.world;
  if (!W || !player.person) return;
  const p = player.pos;

  // desired move
  let mx = 0, mz = 0;
  if (!dialogue.open && !player.frozen) {
    if (keys.KeyW || keys.ArrowUp) mz -= 1;
    if (keys.KeyS || keys.ArrowDown) mz += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    mx += stickMove.x; mz += stickMove.y;
  }
  const mLen = Math.hypot(mx, mz);
  if (mLen > 0.05 || !player.grounded) player.sitToggle = false; // moving stands you up
  const sitting = player.sitToggle;
  // sitting quietly restores mindfulness, slowly, and the bar shows it
  if (sitting) {
    dialogue.focus = Math.min(1, dialogue.focus + dt * 0.02);
    focusHud(true);
  } else if (player.sitting) focusHud(false); // just stood up
  player.sitting = sitting;

  const run = keys.ShiftLeft || keys.ShiftRight;
  const speed = (run ? player.speedRun : player.speedWalk) * Math.min(1, mLen);

  const px0 = p.x, pz0 = p.z; // for walking into solid architecture
  if (mLen > 0.05 && !sitting) {
    // forward = away from the camera; right = strafe right of the view
    const a = player.camYaw + Math.PI + Math.atan2(-mx, -mz);
    player.yaw = a;
    const vx = Math.sin(a) * speed, vz = Math.cos(a) * speed;
    p.x += vx * dt; p.z += vz * dt;
    stepAcc += speed * dt;
    if (stepAcc > (run ? 2.2 : 1.7)) { stepAcc = 0; if (player.grounded) sfxStep(run); }
    player.person.setAnim('walk');
    player.person.speed = speed / player.speedWalk;
  } else {
    player.person.setAnim(sitting ? 'sit' : 'idle');
  }

  // jump + gravity (rivers are wadeable: waist-deep at most)
  let groundY = W.groundHeight(p.x, p.z);
  if (W.waterLevel > -900) groundY = Math.max(groundY, W.waterLevel - 0.55);
  // solid blocks: stand on any top within a step's reach below/above the feet
  if (W.blocks) for (const b of W.blocks)
    if (p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1
        && b.y1 <= p.y + 0.55 && b.y1 > groundY) groundY = b.y1;
  if (keys.Space && player.grounded && !sitting && !dialogue.open && !player.frozen) {
    player.vel.y = 5.4; player.grounded = false;
  }
  if (!player.grounded || p.y > groundY + 0.02) {
    player.vel.y -= 14 * dt;
    p.y += player.vel.y * dt;
    if (p.y <= groundY) { p.y = groundY; player.vel.y = 0; player.grounded = true; }
    else player.grounded = false;
  } else p.y = groundY;

  // collide with cylinders
  for (const c of W.colliders) {
    const dx = p.x - c.x, dz = p.z - c.z;
    if (c.h !== undefined && p.y > c.h) continue;
    if (c.b !== undefined && p.y < c.b) continue;
    const d2 = dx * dx + dz * dz, rr = c.r + 0.32;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr;
    }
  }
  // solid blocks act as walls when their top is above step reach; a player who
  // somehow starts inside one (teleport, act spawn) may walk free rather than freeze
  if (W.blocks) for (const b of W.blocks) {
    const x0 = b.x0 - 0.24, x1 = b.x1 + 0.24, z0 = b.z0 - 0.24, z1 = b.z1 + 0.24;
    if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1
        && b.y1 > p.y + 0.55 && b.y0 < p.y + 1.5
        && !(px0 > x0 && px0 < x1 && pz0 > z0 && pz0 < z1)) { p.x = px0; p.z = pz0; break; }
  }
  // world wrap (seamless: terrain noise is periodic with W.size)
  const HS = W.size / 2;
  if (p.x > HS) p.x -= W.size; if (p.x < -HS) p.x += W.size;
  if (p.z > HS) p.z -= W.size; if (p.z < -HS) p.z += W.size;

  // bow
  if (bowQueued) { bowQueued = false; player.person.bow(); if (player.onBow) player.onBow(); }

  // avatar transform
  const g = player.person.group;
  g.position.copy(p);
  const targetRot = player.yaw;
  let dr = targetRot - g.rotation.y;
  while (dr > Math.PI) dr -= Math.PI * 2;
  while (dr < -Math.PI) dr += Math.PI * 2;
  g.rotation.y += dr * Math.min(1, dt * 10);
  player.person.update(dt, t);
  // the halo IS the mindfulness meter, in monastic and heavenly form alike
  const halo = player.heavenly ? player.person.haloSprite : player.mindHalo;
  if (halo) halo.material.opacity = Math.pow(dialogue.focus, 1.6) * (0.72 + Math.sin(t * 2.2) * 0.12);

  // interact
  if (interactQueued) {
    interactQueued = false;
    if (player.onInteract && !dialogue.open && !player.frozen) player.onInteract();
  }

  // ---------- camera ----------
  const dist = player.camDist, headY = 1.55;
  _camTarget.set(p.x, p.y + headY, p.z);
  const cy = player.camYaw, cp = player.camPitch;
  const off = new THREE.Vector3(
    Math.sin(cy) * Math.cos(cp), Math.sin(cp), Math.cos(cy) * Math.cos(cp)
  ).multiplyScalar(dist);
  let camPos = _camTarget.clone().add(off);

  // collision: raycast from head to camera
  let maxD = dist;
  if (W.camBlockers && W.camBlockers.length) {
    _ray.camera = camera;
    _ray.set(_camTarget, off.clone().normalize());
    _ray.far = dist;
    const hits = _ray.intersectObjects(W.camBlockers, true);
    if (hits.length) maxD = Math.max(0.6, hits[0].distance - 0.35);
  }
  // never below terrain
  camPos = _camTarget.clone().add(off.clone().setLength(maxD));
  let terrY = W.groundHeight(camPos.x, camPos.z) + 0.35;
  if (W.waterLevel > -900) terrY = Math.max(terrY, W.waterLevel + 0.3);
  if (camPos.y < terrY) camPos.y = terrY;

  camera.position.lerp(camPos, Math.min(1, dt * 12));
  // scripted pan: ease the gaze toward player.camLook and back again when cleared
  if (player.camLook) _lastLook.copy(player.camLook);
  _lookBlend = THREE.MathUtils.clamp(_lookBlend + (player.camLook ? dt : -dt) * 0.7, 0, 1);
  _lookPt.copy(_camTarget);
  if (_lookBlend > 0) _lookPt.lerp(_lastLook, _lookBlend * _lookBlend * (3 - 2 * _lookBlend));
  camera.lookAt(_lookPt);
}
