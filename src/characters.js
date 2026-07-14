// Procedural characters: monastics, devas, laypeople, demons, animals. All primitives.
import * as THREE from 'three';

// shared geometries
const G = {
  head: new THREE.CapsuleGeometry(0.105, 0.1, 4, 8),       // pill head (total height 0.323: 5% shorter)
  neck: new THREE.CylinderGeometry(0.045, 0.05, 0.1, 7),
  torso: new THREE.CylinderGeometry(0.235, 0.145, 0.7, 9),  // wide shoulders, narrow waist
  torsoSkinny: new THREE.CylinderGeometry(0.2, 0.06, 0.55, 9), // fasting: ribs and hollow belly
  skirt: new THREE.CylinderGeometry(0.15, 0.26, 0.85, 9),
  skirtOver: new THREE.CylinderGeometry(0.155, 0.27, 0.38, 9),  // women: short layer, waist to thigh
  skirtUnder: new THREE.CylinderGeometry(0.265, 0.31, 0.58, 9), // women: main skirt, top flush with the layer's hem
  wrap: new THREE.CylinderGeometry(0.125, 0.145, 0.3, 9),    // short waist robe (ascetic)
  armUp: new THREE.CapsuleGeometry(0.05, 0.28, 3, 6),      // upper arm (shoulder to elbow)
  armLo: new THREE.CapsuleGeometry(0.044, 0.28, 3, 6),     // forearm (elbow to wrist)
  armUpThin: new THREE.CapsuleGeometry(0.03, 0.28, 3, 6),
  armLoThin: new THREE.CapsuleGeometry(0.025, 0.28, 3, 6),
  leg: new THREE.CapsuleGeometry(0.06, 0.62, 3, 6),
  legThin: new THREE.CapsuleGeometry(0.031, 0.62, 3, 6),
  hand: new THREE.SphereGeometry(0.05, 6, 5),
  shoulder: new THREE.SphereGeometry(0.075, 7, 6),
  sitBase: new THREE.CylinderGeometry(0.25, 0.37, 0.28, 9),
  horn: new THREE.ConeGeometry(0.04, 0.16, 6),
  crownRing: new THREE.TorusGeometry(0.11, 0.02, 6, 12),
  necklace: new THREE.TorusGeometry(0.15, 0.018, 6, 14),
  bowl: new THREE.SphereGeometry(0.075, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
  hairCap: new THREE.SphereGeometry(0.125, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.62),
  hairBack: new THREE.CapsuleGeometry(0.09, 0.22, 3, 7),
  hairBackF: new THREE.CapsuleGeometry(0.108, 0.7, 3, 7),  // women: twice as long, 1.2× wider
  bun: new THREE.SphereGeometry(0.062, 8, 6),
  ushnisha: new THREE.SphereGeometry(0.055, 8, 6),
  eye: new THREE.SphereGeometry(0.017, 6, 5),                // scaled to a tall ellipse below
  eyeShut: new THREE.TorusGeometry(0.024, 0.006, 4, 10, Math.PI), // ∩ crescent: peaceful meditation eyes
  eyeSlit: new THREE.BoxGeometry(0.036, 0.007, 0.012),       // horizontal slit: sleeping
  eyeAngry: new THREE.BoxGeometry(0.05, 0.013, 0.012),       // angled bar: demons' glare
};
G.bowl.rotateX(Math.PI); // open side up
G.eye.scale(0.7, 1.25, 0.55);
G.eyeShut.scale(1, 0.6, 1); // gentler arc: shallow peaceful crescents

const MATS = {};
function mat(hex, emissive = 0) {
  const key = hex + '_' + emissive;
  if (!MATS[key]) MATS[key] = new THREE.MeshLambertMaterial({
    color: hex, emissive, flatShading: true,
  });
  return MATS[key];
}

// ---------- halo ----------
let haloTexGold = null, haloTexWhite = null;
function haloTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.55, inner.replace('1)', '0.55)'));
  grad.addColorStop(0.78, outer);
  grad.addColorStop(1, 'rgba(255,220,140,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,240,200,0.85)'; g.lineWidth = 3;
  g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
  return new THREE.CanvasTexture(c);
}
export function makeHalo(kind = 'gold', size = 0.5) {
  if (!haloTexGold) {
    haloTexGold = haloTexture('rgba(255,215,120,1)', 'rgba(255,180,60,0.5)');
    haloTexWhite = haloTexture('rgba(255,255,240,1)', 'rgba(255,250,220,0.35)');
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: kind === 'gold' ? haloTexGold : haloTexWhite,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    opacity: kind === 'gold' ? 0.95 : 0.6,
  }));
  sp.scale.setScalar(size);
  sp.raycast = () => {}; // decorative: never blocks the camera ray
  return sp;
}

// ---------- speech-bubble marker ----------
let bubbleTex = null;
export function makeTalkMarker() {
  if (!bubbleTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(250,240,215,0.95)';
    g.beginPath();
    g.moveTo(14, 44); g.lineTo(24, 44); g.lineTo(20, 56); g.lineTo(32, 44);
    g.lineTo(50, 44);
    g.quadraticCurveTo(58, 44, 58, 36); g.lineTo(58, 18);
    g.quadraticCurveTo(58, 10, 50, 10); g.lineTo(14, 10);
    g.quadraticCurveTo(6, 10, 6, 18); g.lineTo(6, 36);
    g.quadraticCurveTo(6, 44, 14, 44);
    g.fill();
    g.fillStyle = 'rgba(90,60,20,0.9)';
    for (const x of [20, 32, 44]) { g.beginPath(); g.arc(x, 27, 3.2, 0, Math.PI * 2); g.fill(); }
    bubbleTex = new THREE.CanvasTexture(c);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthWrite: false }));
  sp.scale.setScalar(0.42);
  sp.raycast = () => {};
  return sp;
}

// ---------- floating name label ----------
export function makeNameLabel(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 80;
  const g = c.getContext('2d');
  g.font = 'italic 40px Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = 8;
  g.fillStyle = 'rgba(248,232,196,0.96)';
  g.fillText(text, 256, 40);
  const t = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  sp.scale.set(2.2, 0.34, 1);
  sp.raycast = () => {};
  return sp;
}

// ---------- monastic outer robe ----------
// Default drape parameters — tune in posetest.html (?mode=robe) and paste back here.
export const OUTER_ROBE = {
  p0x: 0.05, p0y: 0.53, p1x: 0.19, p1y: 0.5, p2x: 0.15, p2y: -0.04,
  p3x: 0.18, p3y: -0.34, p4x: 0.23, p4y: -0.81,
  start: -0.37, len: 1.77,          // lathe angles, in units of π
  rotY: 3.13,                  // the opening bares the right shoulder and arm
  x: 0, y: 0.06, z: 0,
  sx: 1.22, sy: 1, sz: 0.9,
  topMul: 1.21, botLerp: -0.14,    // shading: darker shoulder, lighter hem
  fz: 0,                           // hem pushed forward (shear): shoulder stays put
};
// nuns: a slightly fuller drape over the wider hips
export const OUTER_ROBE_NUN = { ...OUTER_ROBE, p3x: 0.22, p3y: -0.33, p4x: 0.26 };
// seated monastics and the Buddha: a short drape ending above the seat base
export const OUTER_ROBE_SIT = {
  p0x: 0.05, p0y: 0.53, p1x: 0.2, p1y: 0.5, p2x: 0.14, p2y: -0.06,
  p3x: 0.15, p3y: -0.11, p4x: 0.16, p4y: -0.14,
  start: -0.37, len: 1.77,
  rotY: 3.13,
  x: 0, y: 0.06, z: 0,
  sx: 1.22, sy: 1, sz: 0.9,
  topMul: 1.21, botLerp: -0.14,
  fz: -0.01,
};

// A flared drape over the left shoulder, right shoulder bare.
// Caller multiplies scale.y by its torso squash.
export function makeOuterRobe(robe, o = OUTER_ROBE) {
  const pts = [[o.p0x, o.p0y], [o.p1x, o.p1y], [o.p2x, o.p2y], [o.p3x, o.p3y], [o.p4x, o.p4y]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 18, Math.PI * o.start, Math.PI * o.len);
  const top = new THREE.Color(robe).multiplyScalar(o.topMul);
  const bot = new THREE.Color(robe).lerp(new THREE.Color(0xfff2d8), o.botLerp);
  const ys = pts.map(p => p.y), minY = Math.min(...ys), maxY = Math.max(...ys);
  const posA = geo.attributes.position, cols = new Float32Array(posA.count * 3), cc = new THREE.Color();
  for (let i = 0; i < posA.count; i++) {
    const k = Math.min(1, Math.max(0, (posA.getY(i) - minY) / (maxY - minY || 1)));
    cc.copy(bot).lerp(top, k);
    cols[i * 3] = cc.r; cols[i * 3 + 1] = cc.g; cols[i * 3 + 2] = cc.b;
    // fz: shear the hem forward while the shoulder stays put (seated legs sit forward)
    if (o.fz) posA.setZ(i, posA.getZ(i) + o.fz * (1 - k));
  }
  if (o.fz) geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const drape = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: true, side: THREE.DoubleSide,
  }));
  drape.rotation.y = o.rotY;
  drape.position.set(o.x, o.y, o.z);
  drape.scale.set(o.sx, o.sy, o.sz);
  return drape;
}

// ---------- humanoid ----------
// opts: {kind, robe, skin, halo, scale, ornate, hair, hairColor, skinny, handsJoined,
//        chibi, outerRobe}
// hair: 'bald' | 'long' | 'bun' (long hair + man-bun at the back) | 'ushnisha' (Buddha only)
// chibi: 0..1 — bigger head, shorter legs and arms (0 = classic proportions)
// outerRobe: drape the monastic outer robe over the left shoulder, right shoulder bare
export function makePerson(opts = {}) {
  const {
    kind = 'monk', robe = 0x9a4318, outerRobeColour = 0xcc7722, skin = 0xc8996c,
    halo = null, scale = 1, ornate = false, skinny = false, handsJoined = false,
    chibi = 0.2, outerRobe = false,
  } = opts;
  const legS = 1 - 0.55 * chibi;                // leg shortening
  const standY = 0.85 - 0.75 * (1 - legS);      // hip height standing
  const sitY = 0.34 - 0.06 * chibi;
  const yK = standY / 0.85;                     // squashes the skirt band down with the hips
  const tK = 1 - 0.35 * chibi;                  // torso squash: neck/head/arms ride down with it
  const female = kind === 'nun' || kind === 'laywoman' || kind === 'devi';
  const monastic = kind === 'monk' || kind === 'nun';
  let hair = opts.hair;
  if (hair === undefined) {
    if (monastic || kind === 'ascetic' || kind === 'demon') hair = 'bald';
    else hair = female ? 'long' : 'bun';
  }
  const hairColor = opts.hairColor ?? 0x241a10;
  const robeM = mat(robe);
  const skinM = mat(skin);
  const hairM = mat(hairColor);
  const root = new THREE.Group();
  const body = new THREE.Group();          // everything above the hips
  body.position.y = standY;
  root.add(body);

  // torso — flattened front-to-back: wide at the shoulders, shallow chest and back
  const torso = new THREE.Mesh(skinny ? G.torsoSkinny : G.torso, skinny ? skinM : robeM);
  torso.position.y = 0.21 * tK;
  torso.scale.z = 0.58;
  torso.scale.y = tK;
  if (female && !skinny) torso.scale.x = 0.92;
  body.add(torso);
  // neck
  const neck = new THREE.Mesh(G.neck, skinM);
  neck.position.y = 0.59 * tK;
  neck.scale.y = tK;
  body.add(neck);

  // head
  const headG = new THREE.Group();
  headG.position.y = (0.7 - 0.05 * chibi) * tK;
  headG.scale.setScalar(1 + 0.6 * chibi);   // chibi: a big head on a small frame
  const head = new THREE.Mesh(G.head, skinM);
  head.position.y = 0.09;
  headG.add(head);
  body.add(headG);

  // eyes: tall elliptical dots; crescents in meditation (the Buddha always);
  // horizontal slits when lying asleep. Placed below the hair-cap rim (~0.12).
  // The Buddha's are dark blue; everyone else's near-black.
  const angry = kind === 'demon'; // Māra and his army glare, dark red and slanted
  const eyeM = mat(kind === 'buddha' ? 0x1c2f6e : angry ? 0x4a100a : 0x16120e);
  const eyesOpen = [], eyesShut = [], eyesSlit = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(angry ? G.eyeAngry : G.eye, eyeM);
    e.position.set(s * 0.047, angry ? 0.1 : 0.08, 0.098);
    if (angry) e.rotation.z = s * 0.5; // inner corners down: a scowl
    headG.add(e); eyesOpen.push(e);
    const c = new THREE.Mesh(G.eyeShut, eyeM);
    c.position.set(s * 0.047, 0.08, 0.098);
    if (skinny || kind === 'ascetic') c.rotation.z = Math.PI; // ∪ instead of ∩: the austerity years, sorrowful
    c.visible = false;
    headG.add(c); eyesShut.push(c);
    const sl = new THREE.Mesh(G.eyeSlit, eyeM);
    sl.position.set(s * 0.047, 0.08, 0.098);
    sl.visible = false;
    headG.add(sl); eyesSlit.push(sl);
  }
  const setEyes = (shape) => {
    for (const e of eyesOpen) e.visible = shape === 'open';
    for (const c of eyesShut) c.visible = shape === 'shut';
    for (const sl of eyesSlit) sl.visible = shape === 'slit';
  };

  // hair
  if (hair === 'long' || hair === 'bun') {
    const cap = new THREE.Mesh(G.hairCap, hairM);
    cap.position.y = 0.15; cap.scale.set(1, 1, 1);
    headG.add(cap);
    const back = new THREE.Mesh(female ? G.hairBackF : G.hairBack, hairM); // long hair down the back
    back.position.set(0, female ? -0.13 : -0.02, -0.1); // dropped so the crown stays put
    if (female) back.scale.set(1.15, 1, 0.8); // a flat sheet of hair lying against the back
    back.rotation.x = 0.15;
    headG.add(back);
    if (hair === 'bun') {
      const bun = new THREE.Mesh(G.bun, hairM);       // man-bun at the back of the head
      bun.position.set(0, 0.16, -0.14);
      headG.add(bun);
    }
  } else if (hair === 'ushnisha') {
    const cap = new THREE.Mesh(G.hairCap, hairM);     // hugging the skull, no hat-brim rim
    cap.position.y = 0.16; cap.scale.set(0.92, 0.82, 0.92);
    headG.add(cap);
    const u = new THREE.Mesh(G.ushnisha, hairM);      // crown protuberance on top
    u.position.y = 0.29;
    headG.add(u);
  }
  if (kind === 'demon') {
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(G.horn, mat(0x2b2b33));
      h.position.set(s * 0.08, 0.26, 0);
      h.rotation.z = -s * 0.5;
      headG.add(h);
    }
    head.scale.set(1.12, 0.95, 1.05);
  }

  // legs — women's hips are set a little wider at the top, feet in the same place
  const legL = new THREE.Group(), legR = new THREE.Group();
  const hipX = female && !skinny ? 0.125 : 0.09;
  legL.position.set(-hipX, standY + 0.05, 0); legR.position.set(hipX, standY + 0.05, 0);
  legL.scale.y = legR.scale.y = legS;
  if (female && !skinny) { legL.rotation.z = 0.037; legR.rotation.z = -0.037; }
  const legGeo = skinny ? G.legThin : G.leg;
  const legMat = (monastic || skinny || kind === 'ascetic' || kind === 'demon') ? skinM : robeM;
  const mkLeg = () => { const m = new THREE.Mesh(legGeo, legMat); m.position.y = -0.48; return m; };
  legL.add(mkLeg()); legR.add(mkLeg());
  root.add(legL, legR);
  // women wear a short flared layer over the main skirt, which begins where the layer ends
  const skirt = new THREE.Mesh(skinny ? G.wrap : (female ? G.skirtUnder : G.skirt), robeM);
  skirt.position.y = (skinny ? 0.86 : female ? 0.25 : 0.45) * yK; // female: top just under the layer's hem
  skirt.scale.z = 0.68; // hips flattened front-to-back like the torso
  skirt.scale.y = skinny ? 1 : yK;
  root.add(skirt);
  let overSkirt = null;
  if (female && !skinny) {
    overSkirt = new THREE.Mesh(G.skirtOver, robeM);
    overSkirt.position.y = 0.72 * yK;
    overSkirt.scale.z = 0.68;
    overSkirt.scale.y = yK;
    root.add(overSkirt);
  }

  // arms — jointed at the elbow; monastics' right arm is bare (robe over the left shoulder only)
  const bareArms = skinny || kind === 'ascetic' || kind === 'demon';
  const armL = new THREE.Group(), armR = new THREE.Group();
  const armX = skinny ? 0.21 : 0.255; // thinner torso, so the shoulders sit closer in
  armL.position.set(-armX, 0.52 * tK, 0); armR.position.set(armX, 0.52 * tK, 0);
  let elbL = null, elbR = null;
  for (const [g, s] of [[armL, -1], [armR, 1]]) {
    // the -x arm is the character's anatomical right when facing forward
    const bare = bareArms || (monastic && s === -1);
    const sh = new THREE.Mesh(G.shoulder, bare ? skinM : robeM);
    if (skinny) sh.scale.setScalar(0.62); // bony shoulder
    g.add(sh);
    const up = new THREE.Mesh(skinny ? G.armUpThin : G.armUp, bare ? skinM : robeM);
    up.position.y = -0.18; g.add(up);
    const elb = new THREE.Group();
    elb.position.y = -0.37;
    const lo = new THREE.Mesh(skinny ? G.armLoThin : G.armLo, bare ? skinM : robeM);
    lo.position.y = -0.16; elb.add(lo);
    const h = new THREE.Mesh(G.hand, skinM); h.position.y = -0.33; elb.add(h);
    g.add(elb);
    g.rotation.z = s * 0.08;
    elb.rotation.x = -0.12; // natural slight bend
    if (s === -1) elbL = elb; else elbR = elb;
    // the Buddha's arms reach a little further; chibi arms are stubbier
    g.scale.y = (kind === 'buddha' ? 1.25 : 1) * (1 - 0.3 * chibi);
  }
  body.add(armL, armR);

  let drape = null, drapeSit = null;
  if (outerRobe) {
    drape = makeOuterRobe(robe, female ? OUTER_ROBE_NUN : OUTER_ROBE);
    drape.scale.y *= tK;
    drapeSit = makeOuterRobe(robe, OUTER_ROBE_SIT);
    drapeSit.scale.y *= tK;
    drapeSit.visible = false;
    body.add(drape, drapeSit);
  }

  if (ornate) {
    const goldM = mat(0xe6b93f, 0x805f10);
    const neckl = new THREE.Mesh(G.necklace, goldM);
    neckl.position.y = 0.55 * tK; neckl.rotation.x = Math.PI / 2;
    body.add(neckl);
    const crown = new THREE.Mesh(G.crownRing, goldM);
    crown.position.y = 0.21; crown.rotation.x = Math.PI / 2.1;
    headG.add(crown);
  }

  let haloSprite = null;
  if (halo) {
    haloSprite = makeHalo(halo, halo === 'gold' ? 0.82 : 0.63);
    haloSprite.position.set(0, 0.12, 0); // centred on the head
    headG.add(haloSprite);
  }

  root.scale.setScalar(scale);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

  // ---------- animation state ----------
  const P = {
    group: root, body, headG, armL, armR, elbL, elbR, legL, legR, skirt, drape, drapeSit, tK,
    anim: null, phase: Math.random() * 10, speed: 0, // null so the first setAnim('idle') runs in full
    bowT: 0, bowHold: false, haloSprite, height: (standY + (0.82 + 0.28 * chibi) * tK + 0.18) * scale, opts, handsJoined,
  };

  const restArms = () => {
    if (P.lockArms) return; // posed arms (bowl, bow…) stay put
    if (handsJoined) { // elbows out and back; forearms fold in, palms meet at the navel
      armL.rotation.set(-0.12, -0.2, -0.11); elbL.rotation.set(-0.72, 0.19, 1.17);
      armR.rotation.set(-0.12, 0.2, 0.11); elbR.rotation.set(-0.72, -0.19, -1.17);
    } else {
      armL.rotation.set(0, 0, -0.08); armR.rotation.set(0, 0, 0.08);
      elbL.rotation.set(-0.12, 0, 0); elbR.rotation.set(-0.12, 0, 0);
    }
  };

  P.setAnim = (a) => {
    if (P.anim === a) return;
    P.anim = a;
    root.rotation.z = 0;
    // the Buddha keeps crescent eyes always, even lying at the parinirvāṇa
    setEyes(kind === 'buddha' ? 'shut' : a === 'sit' ? 'shut' : a === 'lie' ? 'slit' : 'open');
    if (a === 'sit') {
      legL.visible = legR.visible = false;
      skirt.visible = false;
      if (overSkirt) overSkirt.visible = false;
      if (drape) { drape.visible = false; drapeSit.visible = true; }
      body.position.y = sitY;
      const base = P._sitBase || (P._sitBase = new THREE.Mesh(G.sitBase, robeM)); // always cloth, never skin
      base.position.y = 0.11;
      base.position.z = 0.1;
      base.scale.z = 0.82;
      root.add(base);
      base.visible = true;
      if (P.lockArms) { /* posed arms stay put */ }
      else if (P.bhumisparsha) {
        // earth-witness: right arm (the -x arm) hangs straight down over the right knee,
        // fingers to the earth; left elbow out and back, hand resting at the navel
        armL.rotation.set(-0.03, 0.66, -0.07); elbL.rotation.set(-0.44, -0.04, -0.36);
        armR.rotation.set(-0.02, 0.16, 0.16); elbR.rotation.set(-0.73, 0.25, -1.32);
      } else if (!handsJoined) {
        // meditation: elbows out, forearms across the lap, hands meeting just before the navel
        armL.rotation.set(-0.13, -1.09, -0.2); elbL.rotation.set(-0.79, 0.59, 1.65);
        armR.rotation.set(-0.13, 1.09, 0.2); elbR.rotation.set(-0.79, -0.59, -1.65);
      } else restArms();
    } else {
      legL.visible = legR.visible = true;
      skirt.visible = true;
      if (overSkirt) overSkirt.visible = true;
      if (drape) { drape.visible = true; drapeSit.visible = false; }
      body.position.y = standY;
      if (P._sitBase) P._sitBase.visible = false;
      restArms();
      if (a === 'lie') root.rotation.z = Math.PI / 2 - 0.12;
    }
  };

  P.update = (dt, t) => {
    P.phase += dt * (P.anim === 'walk' ? 6.5 * Math.max(P.speed, 0.6) : P.anim === 'rage' ? 5 : 1.4);
    const ph = P.phase;
    if (P.anim === 'walk') {
      const legAmp = monastic || kind === 'buddha' ? 0.14 : 0.35; // composed monastic gait
      legL.rotation.x = Math.sin(ph) * legAmp;
      legR.rotation.x = Math.sin(ph + Math.PI) * legAmp;
      if (!handsJoined && !P.lockArms) {
        armL.rotation.x = Math.sin(ph + Math.PI) * 0.35;
        armR.rotation.x = Math.sin(ph) * 0.35;
      }
      body.position.y = standY + Math.abs(Math.sin(ph)) * 0.03;
    } else if (P.anim === 'idle') {
      legL.rotation.x = legR.rotation.x = 0;
      if (!handsJoined && !P.lockArms) { armL.rotation.x = armR.rotation.x = 0; }
      body.position.y = standY + Math.sin(ph * 0.8) * 0.008; // breathing
      headG.rotation.y = Math.sin(ph * 0.3) * 0.15;
    } else if (P.anim === 'sit') {
      body.position.y = sitY + Math.sin(ph * 0.7) * 0.006;
    } else if (P.anim === 'rage') {
      // fierce flailing: arms whirl, body twists and lunges
      armL.rotation.x = -1.1 + Math.sin(ph * 2.1) * 1.1;
      armR.rotation.x = -1.1 + Math.sin(ph * 2.1 + 2.1) * 1.1;
      armL.rotation.z = -0.5 + Math.sin(ph * 1.7) * 0.4;
      armR.rotation.z = 0.5 - Math.sin(ph * 1.7 + 1) * 0.4;
      body.rotation.z = Math.sin(ph * 1.3) * 0.16;
      body.rotation.x = 0.15 + Math.sin(ph * 2.7) * 0.2;
      body.position.y = standY + Math.abs(Math.sin(ph * 1.9)) * 0.06;
    }
    if (P.bowHold) {
      body.rotation.x = 0.65; // held still in a bow (age, grief, offering)
    } else if (P.bowT > 0) {
      P.bowT = Math.max(0, P.bowT - dt);
      const k = Math.sin(Math.min(1, (1.4 - P.bowT) / 0.5) * Math.PI * 0.5);
      body.rotation.x = k * 0.3 * Math.min(1, P.bowT / 0.4 + 0.3);
    } else if (P.anim !== 'rage') body.rotation.x *= 0.85;
    // hands drawn to añjali (namaste) at the chest while bowing
    if ((P.bowHold || P.bowT > 0) && !P.lockArms) {
      P._anjali = true;
      const s = Math.min(1, dt * 8);
      const tw = (o, r) => {
        o.rotation.x += (r[0] - o.rotation.x) * s;
        o.rotation.y += (r[1] - o.rotation.y) * s;
        o.rotation.z += (r[2] - o.rotation.z) * s;
      };
      tw(armL, [-0.41, 0.1, 0.09]); tw(elbL, [-2.72, 0.42, 0.73]);
      tw(armR, [-0.41, -0.1, -0.09]); tw(elbR, [-2.72, -0.42, -0.73]);
    } else if (P._anjali) {
      // ponytail: arms snap back to the interrupted pose; ease-out if it reads abruptly
      P._anjali = false;
      const a = P.anim; P.anim = null; P.setAnim(a);
    }
    if (haloSprite) haloSprite.material.opacity = 0.75 + Math.sin(t * 2.2 + P.phase) * 0.15;
    if (P.bodyHalo) P.bodyHalo.material.opacity = 0.16 + Math.sin(t * 1.4 + P.phase) * 0.04;
  };
  P.bow = () => { P.bowT = 1.4; };
  P.setAnim('idle');
  return P;
}

// The Buddha: dark gold robes, golden skin, blue-black hair with ushnisha,
// hands joined while walking, earth-witness mudrā when seated.
// Stands a little taller than the great bodhisattvas.
export function makeBuddha(opts = {}) {
  const P = makePerson({
    kind: 'buddha', robe: 0x9a7418, skin: 0xd8b24a,
    hair: 'ushnisha', hairColor: 0x141430, outerRobe: true,
    halo: 'gold', handsJoined: true, scale: 1.25, ...opts,
  });
  P.bhumisparsha = true;
  // a second, fainter aura around the whole body, centred at the chest
  P.bodyHalo = makeHalo('gold', 2.6);
  P.bodyHalo.material.opacity = 0.16;
  P.bodyHalo.position.set(0, 0.3, 0); // chest height within the body group
  P.body.add(P.bodyHalo);
  return P;
}

// ---------- begging bowl ----------
export function makeBowl() {
  // double-sided: the shell is open on top, so from above only the inside shows
  return new THREE.Mesh(G.bowl, new THREE.MeshLambertMaterial({
    color: 0x4a3424, flatShading: true, side: THREE.DoubleSide,
  }));
}

// ---------- quadrupeds (built facing +z so rotation.y = atan2(dx,dz) works) ----------
function quadruped({ body = [0.55, 0.28, 0.24], legLen = 0.42, neckLen = 0.3, headSize = 0.13, color = 0x8a6a4a, tail = true }) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = -Math.PI / 2; // model is authored along +x; face +z
  root.add(inner);
  const M = mat(color);
  const b = new THREE.Mesh(new THREE.BoxGeometry(...[body[0], body[1], body[2]]), M);
  b.position.y = legLen + body[1] / 2;
  inner.add(b);
  const legs = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const g = new THREE.Group();
    g.position.set(x * body[0] * 0.38, legLen + 0.05, z * body[2] * 0.32);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, legLen, 6), M);
    l.position.y = -legLen / 2;
    g.add(l);
    inner.add(g); legs.push(g);
  }
  const neck = new THREE.Group();
  neck.position.set(body[0] / 2, legLen + body[1] * 0.85, 0);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, neckLen, 6), M);
  nk.position.y = neckLen / 2; nk.rotation.z = -0.5;
  nk.position.x = neckLen * 0.25;
  neck.add(nk);
  const head = new THREE.Mesh(new THREE.BoxGeometry(headSize * 1.8, headSize, headSize), M);
  head.position.set(neckLen * 0.55 + headSize * 0.5, neckLen * 0.9, 0);
  neck.add(head);
  inner.add(neck);
  if (tail) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.008, 0.35, 5), M);
    t.position.set(-body[0] / 2 - 0.05, legLen + body[1] * 0.7, 0);
    t.rotation.z = 0.9;
    inner.add(t);
  }
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const A = { group: root, inner, legs, neck, head, phase: Math.random() * 9, anim: 'idle', speed: 1 };
  A.update = (dt) => {
    A.phase += dt * (A.anim === 'walk' ? 7 * A.speed : 1.2);
    if (A.anim === 'walk') {
      // the body is authored along +x, so a fore-aft swing rotates about z
      legs[0].rotation.z = Math.sin(A.phase) * 0.5;
      legs[3].rotation.z = Math.sin(A.phase) * 0.5;
      legs[1].rotation.z = Math.sin(A.phase + Math.PI) * 0.5;
      legs[2].rotation.z = Math.sin(A.phase + Math.PI) * 0.5;
    } else {
      for (const l of legs) l.rotation.z *= 0.8;
      neck.rotation.z = Math.sin(A.phase * 0.4) * 0.1;
    }
  };
  return A;
}

export function makeHorse(color = 0xf2ead8) {
  const h = quadruped({ body: [0.9, 0.42, 0.34], legLen: 0.62, neckLen: 0.45, headSize: 0.16, color });
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.04), mat(0x5a4a3a));
  mane.position.set(0.55, 1.25, 0); mane.rotation.z = -0.5;
  h.inner.add(mane);
  h.inner.scale.setScalar(1.5); // a proper mount (inner only: riders attach to the root)
  return h;
}
export function makeDeer() {
  const d = quadruped({ body: [0.6, 0.3, 0.22], legLen: 0.5, neckLen: 0.34, headSize: 0.11, color: 0xb08a5a });
  if (Math.random() < 0.5) {
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.22, 4), mat(0x7a6248));
      a.position.set(0.45, 0.95, s * 0.05); a.rotation.z = 0.4; a.rotation.x = s * 0.5;
      d.inner.add(a);
    }
  }
  return d;
}
export function makeElephant(white = true) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = -Math.PI / 2; // authored along +x; face +z
  root.add(inner);
  const M = mat(white ? 0xf5f2ea : 0x9a9088, white ? 0x333029 : 0);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.68, 0.75, 6, 12), M);
  body.rotation.z = Math.PI / 2; // pill lying along +x
  body.position.y = 1.15;
  inner.add(body);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.8, 8), M);
    l.position.set(x * 0.55, 0.4, z * 0.38);
    inner.add(l);
  }
  const head = new THREE.Group();
  head.position.set(1.15, 1.45, 0);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), M);
  head.add(hd);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), M);
    ear.scale.set(0.15, 1, 0.8);
    ear.position.set(-0.12, 0.08, s * 0.46);
    ear.rotation.x = s * 0.25; // flare outward
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mat(0x201a14));
    eye.position.set(0.26, 0.12, s * 0.33);
    head.add(eye);
  }
  let py = -0.25, px = 0.32, r = 0.11;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, 0.28, 7), M);
    seg.position.set(px, py, 0);
    seg.rotation.z = 0.25 + i * 0.12;
    head.add(seg);
    py -= 0.24; px += 0.07 + i * 0.015; r *= 0.85;
  }
  // six tusks, three a side, each pivoted at the head surface so it stays connected
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const len = 1.05 - i * 0.15;
    const geo = new THREE.ConeGeometry(0.05, len, 6);
    geo.translate(0, len / 2, 0); // base at the pivot, tip pointing +y
    const t = new THREE.Mesh(geo, mat(0xfff6dd, 0x554d33));
    t.position.set(0.1, -0.25, s * (0.12 + i * 0.09)); // on the head sphere, beside the trunk
    t.rotation.z = -2.5 + i * 0.18;         // fanned forward, drooping down
    t.rotation.x = s * (-0.25 + i * 0.28);   // splayed outward
    head.add(t);
  }
  inner.add(head);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const E = { group: root, head, phase: 0 };
  E.update = (dt) => { E.phase += dt; head.rotation.z = Math.sin(E.phase * 0.7) * 0.05; };
  return E;
}

// ---------- carriage (built along +x; inner group turns it to face +z travel) ----------
export function makeCarriage(c = {}) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = -Math.PI / 2;
  root.add(inner);
  const wood = mat(c.wood ?? 0x7a4a26), woodDark = mat(c.woodDark ?? 0x543218);
  const goldM = mat(c.gold ?? 0xd9a52c, 0x6b4f10);
  const crimson = mat(c.cloth ?? 0xa3352c), cream = mat(c.trim ?? 0xf0e3c8);
  // the royal platform, carved rails and a cushioned seat
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 1.3), wood);
  base.position.y = 0.72;
  inner.add(base);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 1.4), goldM);
  rim.position.y = 0.66;
  inner.add(rim);
  for (const s of [-1, 1]) {                       // carved side panels
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 0.08), woodDark);
    p.position.set(0, 1.0, s * 0.62);
    inner.add(p);
    const t = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.06, 0.1), goldM);
    t.position.set(0, 1.23, s * 0.62);
    inner.add(t);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 1.2), woodDark);
  back.position.set(-1.02, 1.0, 0);
  inner.add(back);
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 1.0), crimson);
  cushion.position.set(-0.35, 0.84, 0);
  inner.add(cushion);
  for (const [x, z] of [[-0.95, -0.55], [0.95, -0.55], [-0.95, 0.55], [0.95, 0.55]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.5, 6), goldM);
    p.position.set(x, 1.55, z);
    inner.add(p);
  }
  // two-tier canopy with a gold kalasha finial and hanging pendants
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.55, 0.5, 4), crimson);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.5;
  inner.add(roof);
  const eave = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 1.5), cream);
  eave.position.y = 2.28;
  inner.add(eave);
  const roof2 = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.42, 4), crimson);
  roof2.rotation.y = Math.PI / 4;
  roof2.position.y = 2.95;
  inner.add(roof2);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), goldM);
  orb.position.y = 3.22;
  inner.add(orb);
  const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.04, 0.3, 5), goldM);
  fin.position.y = 3.42;
  inner.add(fin);
  for (const [x, z] of [[-1.05, -0.65], [1.05, -0.65], [-1.05, 0.65], [1.05, 0.65]]) {
    const pd = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), goldM);
    pd.rotation.x = Math.PI;
    pd.position.set(x, 2.2, z);
    inner.add(pd);
  }
  // the draw-pole reaching forward to the horse's yoke
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.4, 6), wood);
  pole.rotation.z = Math.PI / 2 - 0.12;
  pole.position.set(2.1, 0.55, 0);
  inner.add(pole);
  // great spoked wheels with gilded hubs, joined by an axle
  const wheels = [];
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), woodDark);
  axle.rotation.x = Math.PI / 2;
  axle.position.set(0, 0.52, 0);
  inner.add(axle);
  for (const [x, z] of [[-0.75, -0.68], [0.75, -0.68], [-0.75, 0.68], [0.75, 0.68]]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 14), wood);
    w.position.set(x, 0.52, z);
    inner.add(w); wheels.push(w);
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.94, 4), wood);
      sp.rotation.z = i * Math.PI / 8;
      w.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 8), goldM);
    hub.rotation.x = Math.PI / 2;
    w.add(hub);
  }
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: root, wheels, update(dt, moving) { if (moving) for (const w of wheels) w.rotation.z -= dt * 1.6; } };
}
