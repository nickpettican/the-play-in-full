// The twelve deeds: act state machine, scripted characters, cutscenes.
import * as THREE from 'three';
import { scene, loadModel, instantiate, setDaylight, snapDaylight } from './engine.js';
import { switchWorld, world, lotus } from './world.js';
import { player, setWitnessForm } from './player.js';
import { spawnNPC, clearNPCs, npcs, nearestNPC, talkTo, resetQuestions, allQuestionsExhausted } from './npc.js';
import { makePerson, makeBuddha, makeBowl, makeHalo, makeTalkMarker, makeHorse, makeElephant, makeCarriage, makeDeer } from './characters.js';
import { showNarration, showChoices, showActCard, fade, dialogue } from './dialogue.js';
import { NARRATION, actTitle, QA_PALI, QA_MAHAYANA, QA_DEVA, QA_ASCETIC, QA_IMPERMANENCE, BODHISATTVAS, DISCIPLES, script } from './content.js';
import { T } from './i18n.js';
import { setAmbient, sfxBell, sfxSwell, sfxTwinkle, sfxFile, sfxDrum, sfxWhoosh, sfxSparkle, sfxHorse, sfxChime } from './audio.js';
import { petals, motes, burst, radiance, fireflies, aura, clearParticles } from './particles.js';

export const game = { act: -1, updaters: [], props: [], interactables: [] };

// ---------- helpers ----------
function addProp(obj) { scene.add(obj); game.props.push(obj); return obj; }
function clearStage() {
  clearNPCs(); clearParticles();
  for (const p of game.props) scene.remove(p);
  game.props.length = 0;
  game.updaters.length = 0;
  game.interactables.length = 0;
}
function onUpdate(fn) { game.updaters.push(fn); }

// interactable: floating marker at pos; action() when player clicks nearby
function addInteractable({ pos, r = 3, marker = true, markerY = 2.4, action, host = null }) {
  const it = { pos, r, action, alive: true };
  if (marker) {
    it.sprite = makeTalkMarker();
    const holder = host || scene;
    it.sprite.position.copy(host ? new THREE.Vector3(0, markerY, 0) : pos.clone().add(new THREE.Vector3(0, markerY, 0)));
    holder.add(it.sprite);
    if (!host) game.props.push(it.sprite);
  }
  it.remove = () => {
    it.alive = false;
    if (it.sprite) (host || scene).remove(it.sprite);
    const i = game.interactables.indexOf(it);
    if (i >= 0) game.interactables.splice(i, 1);
  };
  game.interactables.push(it);
  return it;
}

player.onInteract = () => {
  // nearest wins, whether a scripted interactable or an NPC;
  // while a translucent witness, no one can see the player to talk to them
  let best = null, bestD = 1e9;
  for (const it of game.interactables) {
    const p = it.pos.clone ? it.pos : it.pos();
    const d = p.distanceTo(player.pos);
    if (d < it.r && d < bestD) { bestD = d; best = it; }
  }
  const n = nearestNPC(3); // filters out NPCs who can't perceive the translucent witness
  if (n && n.group.position.distanceTo(player.pos) < bestD) { talkTo(n); return; }
  if (best) best.action(best);
};

// bow near an NPC -> they bow back (unless the player is an unseen witness)
player.onBow = () => {
  if (player.translucent) return;
  for (const N of npcs) {
    if (N.group.position.distanceTo(player.pos) < 4 && N.behaviour !== 'sit') N.person.bow();
  }
};

function pickQA(bank, n) {
  const pool = bank.slice();
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  return out;
}

// A full sangha around a centre: 8 bodhisattvas + monks (10% arhats).
// opts.qaBank: when withQA is false, a share of monks still answer from this bank.
function spawnSangha(W, centre, { monks = 26, withQA = true, qaBank = null, bowNear = null } = {}) {
  BODHISATTVAS.forEach((B, i) => {
    const a = (i / BODHISATTVAS.length) * Math.PI * 2 + 0.35;
    const r = 4.2 + (i % 2) * 1.2;
    const pos = new THREE.Vector3(centre.x + Math.cos(a) * r, 0, centre.z + Math.sin(a) * r);
    pos.y = W.groundHeight(pos.x, pos.z);
    spawnNPC({
      kind: 'deva', name: B.name, robe: B.hue, ornate: true, halo: 'gold', scale: 1.16,
      behaviour: i % 3 === 0 ? 'idle' : 'sit', pos,
      yaw: Math.atan2(centre.x - pos.x, centre.z - pos.z),
      qa: withQA ? B.qa.concat(pickQA(QA_MAHAYANA, 1)) : (qaBank ? pickQA(qaBank, 1) : []),
    });
  });
  for (let i = 0; i < monks; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 7 + Math.random() * 14;
    const pos = new THREE.Vector3(centre.x + Math.cos(a) * r, 0, centre.z + Math.sin(a) * r);
    pos.y = W.groundHeight(pos.x, pos.z);
    const mahayana = Math.random() < 0.1;
    const arhat = Math.random() < 0.12;
    spawnNPC({
      kind: Math.random() < 0.3 ? 'nun' : 'monk',
      robe: [0xcc7722, 0xb35c2e, 0xa3542a, 0xd98a33][(Math.random() * 4) | 0],
      skin: [0xc8996c, 0xa87a50, 0xd8a877, 0x8a6a48][(Math.random() * 4) | 0],
      halo: arhat ? 'white' : null,
      behaviour: Math.random() < 0.55 ? 'sit' : 'wander',
      pos, wanderR: 10, bowNear,
      yaw: Math.atan2(centre.x - pos.x, centre.z - pos.z),
      qa: withQA ? pickQA(mahayana ? QA_MAHAYANA : QA_PALI, 2 + (Math.random() * 2 | 0))
        : (qaBank && Math.random() < 0.4 ? pickQA(qaBank, 2) : []),
    });
  }
}

// The great disciples, seated in an arc close to the Blessed One.
function spawnDisciples(W, centre) {
  DISCIPLES.forEach((D, i) => {
    const a = (i / DISCIPLES.length) * Math.PI * 2 - 0.35;
    const r = 4.6 + (i % 2) * 1.0;
    const pos = new THREE.Vector3(centre.x + Math.cos(a) * r, 0, centre.z + Math.sin(a) * r);
    pos.y = W.groundHeight(pos.x, pos.z);
    spawnNPC({
      kind: 'monk', name: D.name, robe: D.robe, skin: 0xc8996c,
      halo: D.halo, behaviour: 'sit', pos,
      yaw: Math.atan2(centre.x - pos.x, centre.z - pos.z),
      qa: D.qa.slice(),
    });
  });
}

// The Blessed One, seated in meditation — the generated figure, not a statue.
async function placeBuddha(W, pos, { ry = 0 } = {}) {
  const B = makeBuddha({ handsJoined: false });
  B.setAnim('sit');
  B.group.position.set(pos.x, W.groundHeight(pos.x, pos.z) + (W.spots.buddhaLift || 0), pos.z);
  B.group.rotation.y = ry;
  addProp(B.group);
  onUpdate((dt, t) => B.update(dt, t));
  return B;
}

function walkPerson(P, from, to, speed, W, done) {
  P.group.position.copy(from);
  P.setAnim('walk');
  const fn = (dt) => {
    const g = P.group;
    const dx = to.x - g.position.x, dz = to.z - g.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) {
      P.setAnim('idle');
      const i = game.updaters.indexOf(fn);
      if (i >= 0) game.updaters.splice(i, 1);
      done && done();
      return;
    }
    g.position.x += dx / d * speed * dt;
    g.position.z += dz / d * speed * dt;
    g.position.y = W.groundHeight(g.position.x, g.position.z);
    g.rotation.y = Math.atan2(dx, dz);
  };
  onUpdate(fn);
}

async function transition(actIdx, worldName, daylight, ambient) {
  player.frozen = true;
  await fade(true);
  clearStage();
  const W = await switchWorld(worldName);
  player.world = W;
  player.pos.copy(W.spots.playerStart);
  player.pos.y = W.groundHeight(player.pos.x, player.pos.z);
  snapDaylight(daylight);
  setAmbient(ambient);
  await showActCard(actTitle(actIdx)[0], actTitle(actIdx)[1]);
  await fade(false);
  player.frozen = false;
  return W;
}

function maybeFocusReward() {
  if (dialogue.focus >= 0.65) {
    aura(player.person.group, 25);
    sfxChime();
    showNarration([{ q: script('focusReward'), who: 'narrator' }]);
    return true;
  }
  return false;
}

// ---------- ACTS ----------
const ACTS = [];

// -- Prelude: Jeta's Grove --
ACTS[0] = async () => {
  const W = await transition(0, 'jeta', 'day', 'forest');
  const buddha = await placeBuddha(W, W.spots.buddha, { ry: -0.6 });
  spawnSangha(W, W.spots.buddha, { monks: 30, bowNear: W.spots.buddha });
  spawnDisciples(W, W.spots.buddha);
  petals(W.spots.buddha.clone().setY(2), 20, 50, [[1, 1, 1], [1, .85, .9]]);
  addInteractable({
    pos: W.spots.buddha.clone(), r: 3.6, markerY: 2.8,
    action(it) {
      showChoices('The Blessed One', script('buddhaPrompt').q, [{
        label: script('buddhaAsk'),
        action: () => {
          it.remove();
          showNarration(NARRATION.act0.map(x => ({ ...x, who: 'Ananda' })).concat([{ q: script('buddhaCard'), who: 'The Blessed One' }]),
            () => nextAct(), { focus: true });
        },
      }]);
    },
  });
};

// -- Act I: Tushita --
ACTS[1] = async () => {
  const W = await transition(1, 'tushita', 'heaven', 'heaven');
  setWitnessForm('heavenly');
  motes(new THREE.Vector3(0, 1, -8), 30, 200);
  // gods wandering
  for (let i = 0; i < 32; i++) {
    const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 24;
    const pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r - 4);
    pos.y = W.groundHeight(pos.x, pos.z);
    spawnNPC({
      kind: Math.random() < 0.5 ? 'deva' : 'devi', name: 'A god of the Heaven of Joy',
      robe: [0xe8d8f8, 0xf8e8c8, 0xd8e8f8, 0xf8d8e0][(Math.random() * 4) | 0],
      ornate: true, behaviour: 'wander', pos, wanderR: 10,
      qa: pickQA(QA_DEVA, 2),
    });
  }
  // Maitreya
  const mPos = new THREE.Vector3(-3.4, 0, -8.6);
  mPos.y = W.groundHeight(mPos.x, mPos.z);
  spawnNPC({
    kind: 'deva', name: 'Maitreya', robe: 0xf0c95c, ornate: true, halo: 'gold', scale: 2.0,
    behaviour: 'idle', pos: mPos, yaw: 0.4, qa: BODHISATTVAS.find(b => b.name === 'Maitreya').qa,
  });
  // The Bodhisattva (Shvetaketu), radiant white — twice the stature of the other gods
  const bPos = W.spots.bodhisattva.clone();
  bPos.y = W.groundHeight(bPos.x, bPos.z);
  const bodhi = makePerson({ kind: 'deva', robe: 0xfff6e0, skin: 0xe8c9a0, ornate: true, halo: 'gold', scale: 2.0 });
  bodhi.group.position.copy(bPos);
  bodhi.group.rotation.y = 0; // facing the centre of the pillar circle
  addProp(bodhi.group);
  onUpdate((dt, t) => bodhi.update(dt, t));
  addInteractable({
    pos: bPos, r: 4, markerY: 4.2,
    action(it) {
      it.remove();
      // hearing his farewell, the gods gather around him, bow, and sit
      npcs.forEach((N, i) => {
        if (N.behaviour === 'sit') return;
        N.behaviour = 'gather';
        const a = (i / npcs.length) * Math.PI * 2;
        const r = 4.6 + (i % 3) * 1.3;
        N._gTarget = new THREE.Vector3(bPos.x + Math.cos(a) * r, 0, bPos.z + Math.sin(a) * r);
      });
      onUpdate((dt) => {
        for (const N of npcs) {
          if (N.behaviour !== 'gather') continue;
          const g = N.group;
          const dx = N._gTarget.x - g.position.x, dz = N._gTarget.z - g.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.4) {
            N.behaviour = 'sit';
            g.rotation.y = Math.atan2(bPos.x - g.position.x, bPos.z - g.position.z);
            N.person.bow();
            setTimeout(() => N.person.setAnim('sit'), 1500);
          } else {
            N.person.setAnim('walk');
            N.person.speed = 0.5;
            g.position.x += dx / d * 2.4 * dt;
            g.position.z += dz / d * 2.4 * dt;
            g.rotation.y = Math.atan2(dx, dz);
          }
        }
      });
      showNarration(NARRATION.act1, () => nextAct(), { focus: true });
    },
  });
};

// -- Act II: Conception --
ACTS[2] = async () => {
  const W = await transition(2, 'kapilavastu', 'night', 'night');
  setWitnessForm('translucent'); // from here to the first teaching: an unseen monastic witness
  player.pos.set(0, 0, -34); // before the palace steps
  fireflies(new THREE.Vector3(0, 0, -44), 26);
  // sleeping queen on a couch inside the pillared hall
  const hall = W.spots.hall;
  const couchPos = new THREE.Vector3(hall.x, W.groundHeight(hall.x, hall.z), hall.z);
  const couch = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.3),
    new THREE.MeshLambertMaterial({ color: 0x8a3a3a, flatShading: true }));
  couch.position.copy(couchPos).add(new THREE.Vector3(0, 0.25, 0));
  couch.castShadow = true;
  addProp(couch);
  const maya = makePerson({ kind: 'laywoman', robe: 0xc23a5f, skin: 0xd8a877 });
  maya.setAnim('lie');
  // centred on the couch: 'lie' tips the figure toward local -x with the pivot at the feet
  maya.group.position.copy(couchPos).add(new THREE.Vector3(0.85, 0.55, 0));
  addProp(maya.group);
  onUpdate((dt, t) => maya.update(dt, t));
  // sleeping attendants on mats inside the hall
  for (let i = 0; i < 5; i++) {
    const p = makePerson({ kind: 'laywoman', robe: [0x6a4a8a, 0x4a6a8a, 0x8a6a4a][(i % 3)] });
    const x = couchPos.x - 5 + i * 2.2, z = couchPos.z + 4;
    const mat0 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x5a4a3a }));
    mat0.position.set(x, W.groundHeight(x, z) + 0.03, z);
    addProp(mat0);
    p.setAnim('lie');
    p.group.position.set(x + 0.8, W.groundHeight(x, z) + 0.1, z);
    addProp(p.group);
    onUpdate((dt, t) => p.update(dt, t));
  }
  addInteractable({
    pos: couchPos, r: 3.2, markerY: 1.8,
    action(it) {
      it.remove();
      player.frozen = true;
      // the white elephant descends
      const ele = makeElephant(true);
      ele.group.scale.setScalar(2.7); // vast in the sky, shrinking as it nears her
      ele.group.position.copy(couchPos).add(new THREE.Vector3(6, 26, 4));
      ele.group.rotation.y = -2.2;
      addProp(ele.group);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 2.4, 26, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.copy(couchPos).add(new THREE.Vector3(0, 13, 0));
      addProp(beam);
      motes(couchPos, 8, 80, 0xcfe0ff);
      sfxBell(240, 0.18, 8);
      let t0 = 0;
      onUpdate((dt) => {
        t0 += dt;
        ele.update(dt);
        const k = Math.min(1, t0 / 9);
        const e = k * k * (3 - 2 * k);
        ele.group.position.lerpVectors(
          couchPos.clone().add(new THREE.Vector3(6, 26, 4)),
          couchPos.clone().add(new THREE.Vector3(0, 0.8, 0)), e);
        ele.group.scale.setScalar(THREE.MathUtils.lerp(2.7, 0.225, e));
        beam.material.opacity = 0.18 * (1 - e * 0.6);
        if (k >= 1) ele.group.visible = false;
      });
      setTimeout(() => {
        showNarration(NARRATION.act2, () => { player.frozen = false; nextAct(); }, { focus: true });
      }, 5200);
    },
  });
};

// -- Act III: Birth --
ACTS[3] = async () => {
  const W = await transition(3, 'lumbini', 'morning', 'garden');
  const mayaPos = W.spots.maya.clone();
  mayaPos.y = W.groundHeight(mayaPos.x, mayaPos.z);
  const maya = makePerson({ kind: 'laywoman', robe: 0xc23a5f, skin: 0xd8a877 });
  maya.group.position.copy(mayaPos);
  maya.group.rotation.y = 2.42; // her right side turned to the trunk
  maya.armR.rotation.z = 2.4;   // arm raised up and out, grasping towards the branch
  addProp(maya.group);
  onUpdate((dt, t) => maya.update(dt, t));
  const attendants = [];
  for (let i = 0; i < 4; i++) {
    const a = 1.2 + i * 0.7;
    const p = new THREE.Vector3(mayaPos.x + Math.cos(a) * 2.6, 0, mayaPos.z + Math.sin(a) * 2.6);
    p.y = W.groundHeight(p.x, p.z);
    attendants.push(spawnNPC({
      kind: 'laywoman', name: 'An attendant', robe: [0x6a8a4a, 0x8a6a9a, 0xa88a4a, 0x4a7a8a][i],
      behaviour: 'idle', pos: p,
      yaw: Math.atan2(mayaPos.x - p.x, mayaPos.z - p.z),
    }));
  }
  addInteractable({
    pos: mayaPos, r: 3.2, markerY: 2.2,
    action(it) {
      it.remove();
      player.frozen = true;
      showNarration(NARRATION.act3.slice(0, 1), () => {
        // the birth: baby with halo takes seven steps east, lotuses bloom
        const baby = makePerson({ kind: 'prince', robe: 0xffe9c0, skin: 0xe8c9a0, halo: 'gold', scale: 0.42 });
        baby.group.position.copy(mayaPos).add(new THREE.Vector3(0.8, 0, 0.4));
        addProp(baby.group);
        petals(mayaPos, 14, 160);
        motes(mayaPos, 12, 120);
        setDaylight('radiance', 4);
        sfxFile('assets/mp3/birth-reached.mp3');
        // everyone bows still at the birth; Māyā lowers her arm from the branch
        for (const a of attendants) a.person.bowHold = true;
        maya.armR.rotation.z = 0.08;
        let steps = 0, stepT = 0;
        const babyUpd = (dt, t) => {
          baby.update(dt, t);
          if (steps < 7) {
            stepT += dt;
            if (stepT > 0.9) {
              stepT = 0; steps++;
              baby.group.position.x += 0.55;
              baby.group.position.y = W.groundHeight(baby.group.position.x, baby.group.position.z);
              baby.group.rotation.y = Math.PI / 2;
              const l = lotus(1.4);
              l.position.copy(baby.group.position);
              addProp(l);
              sfxChime();
              if (steps === 7) {
                setTimeout(() => {
                  showNarration(NARRATION.act3.slice(1).map((x, i) => i === 2 ? { ...x, who: 'The newborn' } : x),
                    () => { maybeFocusReward(); player.frozen = false; nextAct(); }, { focus: true });
                }, 1200);
              }
            } else baby.setAnim('walk');
          } else baby.setAnim('idle');
        };
        onUpdate(babyUpd);
        // gods descend to rejoice
        setTimeout(() => {
          for (let i = 0; i < 6; i++) {
            const a = i / 6 * Math.PI * 2 + Math.PI / 6; // ring offset: the eastward path stays clear
            const p = new THREE.Vector3(mayaPos.x + Math.cos(a) * 5, 0, mayaPos.z + Math.sin(a) * 5);
            p.y = W.groundHeight(p.x, p.z);
            const god = spawnNPC({
              kind: i % 2 ? 'deva' : 'devi', name: 'A rejoicing god', scale: 1.75,
              robe: [0xf8e8c8, 0xe8d8f8, 0xf8d8e0][(i % 3)], ornate: true,
              behaviour: 'idle', pos: p, yaw: Math.atan2(mayaPos.x - p.x, mayaPos.z - p.z),
            });
            god.person.bowHold = true;
          }
        }, 2500);
      }, { focus: true });
    },
  });
};

// -- Act IV: Skill in the arts --
ACTS[4] = async () => {
  const W = await transition(4, 'kapilavastu', 'day', 'palace');
  player.pos.set(0, 0, -26); // just inside the king's gate
  const c = new THREE.Vector3(24, 0, -30); // training grounds inside the king's wall, east of the palace
  // targets: drums on posts
  const drums = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2e }));
    post.position.y = 0.8; g.add(post);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12),
      new THREE.MeshLambertMaterial({ color: 0xb03a2e, flatShading: true }));
    drum.rotation.x = Math.PI / 2;
    drum.position.y = 1.7; g.add(drum);
    const x = c.x - 6 + i * 2.1, z = c.z - 16 - i * 1.2;
    g.position.set(x, W.groundHeight(x, z), z);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    addProp(g);
    drums.push(g);
  }
  // young Siddhartha with bow
  const sPos = new THREE.Vector3(c.x, 0, c.z + 4);
  sPos.y = W.groundHeight(sPos.x, sPos.z);
  const sid = makePerson({ kind: 'prince', robe: 0xe8b84a, skin: 0xd8a877, halo: 'gold' });
  sid.group.position.copy(sPos);
  sid.group.rotation.y = Math.PI;
  sid.lockArms = true;             // archer's stance, animated by the volley loop
  sid.armL.rotation.x = -1.35;     // bow arm extended
  sid.armR.rotation.x = -0.4;
  { // the bow: a staff held in his right hand (the -x arm)
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.5, 5),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2e, flatShading: true }));
    stick.position.set(0, -0.33, 0);
    stick.rotation.x = Math.PI / 2 - 0.2; // upright across the drawing line
    sid.elbL.add(stick);
  }
  addProp(sid.group);
  onUpdate((dt, t) => sid.update(dt, t));
  // Devadatta watches from the side, burning with envy (overheard, not conversed —
  // the witnessing player is unseen)
  {
    const p = new THREE.Vector3(c.x - 8, 0, c.z - 6);
    p.y = W.groundHeight(p.x, p.z);
    const dev = spawnNPC({
      kind: 'layman', name: 'Devadatta', robe: 0x8a3a5a, skin: 0xd8a877, hair: 'bun',
      behaviour: 'idle', pos: p, yaw: Math.atan2(sPos.x - p.x, sPos.z - p.z),
    });
    addInteractable({
      pos: () => dev.group.position, r: 3.2, markerY: 2.3, host: dev.group,
      action(it) {
        it.remove();
        showNarration([
          { q: '“The drums split for him before his arrow has left the string. All my life I have matched him stroke for stroke, and still the crowd sees only Siddhārtha.”', who: 'Devadatta, muttering' },
          { q: '“I struck my targets. So did Ānanda, and Sundarananda, and Daṇḍapāṇi. Then his one arrow passed through all of them as if they were air. Envy is a hot coal — and I cannot seem to put it down.”', who: 'Devadatta, muttering' },
        ]);
      },
    });
  }
  // spectators mill about, but keep clear of the shooting lane and the targets
  const inLane = (x, z) => Math.abs(x - c.x) < 8 && z < sPos.z + 1.5;
  for (let i = 0; i < 7; i++) {
    const side = i % 2 ? 1 : -1;
    const p = new THREE.Vector3(c.x + side * (9 + Math.random() * 5), 0, sPos.z - 2 - Math.random() * 14);
    p.y = W.groundHeight(p.x, p.z);
    spawnNPC({
      kind: i % 2 ? 'layman' : 'laywoman', name: 'A Śākya spectator',
      robe: [0x8a5a9a, 0x4a7a9a, 0xa8894a, 0x9a4a5a][(Math.random() * 4) | 0],
      behaviour: 'wander', pos: p, wanderR: 5, avoid: inLane,
      yaw: Math.atan2(sPos.x - p.x, sPos.z - p.z),
    });
  }
  // and life in the town: villagers among the houses along the road
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3((Math.random() - 0.5) * 16, 0, 6 + Math.random() * 44);
    p.y = W.groundHeight(p.x, p.z);
    spawnNPC({
      kind: i % 2 ? 'layman' : 'laywoman', name: 'A villager',
      robe: [0x7a8a4a, 0x8a5a3a, 0x5a6a8a, 0xa88a4a][(Math.random() * 4) | 0],
      behaviour: 'wander', pos: p, wanderR: 9,
    });
  }
  // arrow volley loop: draw, loose, follow through
  let shootT = 1.5, drawn = false;
  onUpdate((dt) => {
    shootT -= dt;
    if (!drawn && shootT < 0.5) {  // draw the bowstring just before the loose
      drawn = true;
      sid.armR.rotation.x = -2.1;
    }
    if (shootT <= 0) {
      shootT = 4.5; drawn = false;
      sid.armR.rotation.x = -1.0;  // release
      setTimeout(() => { sid.armR.rotation.x = -0.4; }, 350);
      const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4),
        new THREE.MeshLambertMaterial({ color: 0xe8d8a8 }));
      arrow.rotation.x = Math.PI / 2;
      const from = sid.group.position.clone().add(new THREE.Vector3(0, 1.35, 0));
      const to = drums[(Math.random() * drums.length) | 0].position.clone().add(new THREE.Vector3(0, 1.7, 0));
      arrow.position.copy(from);
      arrow.lookAt(to);
      arrow.rotateX(Math.PI / 2);
      addProp(arrow);
      sfxWhoosh();
      let tt = 0;
      const fn = (dt2) => {
        tt += dt2 * 2.2;
        arrow.position.lerpVectors(from, to, Math.min(1, tt));
        if (tt >= 1) {
          scene.remove(arrow);
          sfxDrum(110, 0.22);
          const i = game.updaters.indexOf(fn);
          if (i >= 0) game.updaters.splice(i, 1);
        }
      };
      onUpdate(fn);
    }
  });
  addInteractable({
    pos: sPos, r: 3.2, markerY: 2.3,
    action(it) {
      it.remove();
      showNarration(NARRATION.act4, () => nextAct(), { focus: true });
    },
  });
};

// -- Act V: Marriage --
ACTS[5] = async () => {
  const W = await transition(5, 'kapilavastu', 'golden', 'palace');
  player.pos.set(0, 0, -26); // just inside the king's gate
  const c = W.spots.courtyard;
  // wedding dais
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.5, 12),
    new THREE.MeshLambertMaterial({ color: 0xc9a86a, flatShading: true }));
  dais.position.set(c.x, W.groundHeight(c.x, c.z) + 0.25, c.z);
  dais.receiveShadow = true;
  addProp(dais);
  W.camBlockers.push(dais);
  const sid = makePerson({ kind: 'prince', robe: 0xe8b84a, skin: 0xd8a877, halo: 'gold', ornate: true });
  sid.group.position.set(c.x - 0.7, dais.position.y + 0.25, c.z);
  sid.setAnim('sit');
  addProp(sid.group);
  onUpdate((dt, t) => sid.update(dt, t));
  const gopa = makePerson({ kind: 'laywoman', robe: 0xd84a6a, skin: 0xd8a877, ornate: true });
  gopa.group.position.set(c.x + 0.7, dais.position.y + 0.25, c.z);
  gopa.setAnim('sit');
  addProp(gopa.group);
  onUpdate((dt, t) => gopa.update(dt, t));
  petals(new THREE.Vector3(c.x, 2, c.z), 10, 120);
  // wedding guests
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, r = 4.5 + Math.random() * 7;
    const p = new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
    p.y = W.groundHeight(p.x, p.z);
    spawnNPC({
      kind: i % 2 ? 'layman' : 'laywoman', name: 'A wedding guest',
      robe: [0x8a5a9a, 0x4a7a9a, 0xa8894a, 0x9a4a5a, 0x5a8a6a][(Math.random() * 5) | 0],
      behaviour: Math.random() < 0.5 ? 'idle' : 'wander', pos: p, wanderR: 5,
      yaw: Math.atan2(c.x - p.x, c.z - p.z),
    });
  }
  sfxBell(392, 0.12, 4);
  addInteractable({
    pos: new THREE.Vector3(c.x, 0, c.z), r: 4, markerY: 2.6,
    action(it) {
      it.remove();
      showNarration(NARRATION.act5, () => nextAct(), { focus: true });
    },
  });
};

// -- Act VI: The four sights --
ACTS[6] = async () => {
  const W = await transition(6, 'kapilavastu', 'day', 'forest');
  player.pos.set(2, 0, 2);
  // carriage route down the town road (z: 0 -> 60)
  const stops = [8, 22, 38, 54].map(z => new THREE.Vector3(0.5, 0, z));
  const carriage = makeCarriage();
  carriage.group.position.set(0.5, W.groundHeight(0.5, -2), -2);
  addProp(carriage.group);
  const horse = makeHorse(0xc9b8a0);
  horse.group.position.set(0.5, W.groundHeight(0.5, 0.4), 0.4);
  horse.group.rotation.y = 0;
  addProp(horse.group);
  const sid = makePerson({ kind: 'prince', robe: 0xe8b84a, skin: 0xd8a877, halo: 'gold' });
  sid.setAnim('sit');
  carriage.group.add(sid.group);
  sid.group.position.set(0, 0.66, -0.05); // seated on the carriage platform
  onUpdate((dt, t) => sid.update(dt, t));
  // the four sights, staged near each stop
  const sights = [];
  { // old man
    const p = makePerson({ kind: 'layman', robe: 0x8a8a7a, skin: 0xb08a60, hair: 'long', hairColor: 0xe8e8e8 });
    p.bowHold = true; // held still, bent with age
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 2.4, 5), new THREE.MeshLambertMaterial({ color: 0x6b4a2e }));
    stick.position.set(0.3, 0.45, 0.18); stick.rotation.z = 0.15;
    p.group.add(stick);
    sights.push({ person: p, off: new THREE.Vector3(2.8, 0, 0) });
  }
  { // sick man — hands stir weakly
    const p = makePerson({ kind: 'layman', robe: 0x7a7a5a, skin: 0xc0a070 });
    p.setAnim('lie');
    sights.push({
      person: p, off: new THREE.Vector3(-3, 0, 0.5),
      tick: (t) => {
        p.armL.rotation.x = -0.4 + Math.sin(t * 1.1) * 0.35;
        p.armR.rotation.x = -0.3 + Math.sin(t * 0.8 + 1.7) * 0.3;
      },
    });
  }
  { // corpse on a bier with mourners
    const p = makePerson({ kind: 'layman', robe: 0xe8e0d0, skin: 0xd8c8a8 });
    p.setAnim('lie');
    sights.push({ person: p, off: new THREE.Vector3(3, 0, 0.5), bier: true });
  }
  { // the mendicant, alms bowl held out
    const p = makePerson({ kind: 'monk', robe: 0xcc7722, skin: 0xc8996c });
    p.lockArms = true;
    p.armL.rotation.set(-0.12, 0.3, -0.13); elbL.rotation.set(-1.35, 0, 0.55);
    p.armR.rotation.set(-0.12, -0.3, 0.13); elbR.rotation.set(-1.35, 0, -0.55);
    const bowl = makeBowl();
    bowl.scale.setScalar(2);
    bowl.position.set(0, 0.28, 0.32);
    p.body.add(bowl);
    sights.push({ person: p, off: new THREE.Vector3(-2.8, 0, 0) });
  }
  sights.forEach((s, i) => {
    const pos = stops[i].clone().add(s.off);
    pos.y = W.groundHeight(pos.x, pos.z);
    if (s.bier) {
      const bier = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.9),
        new THREE.MeshLambertMaterial({ color: 0x6b4a2e }));
      bier.position.copy(pos).add(new THREE.Vector3(0, 0.15, 0));
      addProp(bier);
      pos.y += 0.3;
      for (let m = 0; m < 3; m++) {
        const mour = spawnNPC({
          kind: 'laywoman', name: 'A mourner', robe: 0xd8d0c0, behaviour: 'idle',
          pos: new THREE.Vector3(pos.x + m - 1, W.groundHeight(pos.x + m - 1, pos.z + 1.2), pos.z + 1.2),
          yaw: Math.PI,
        });
        mour.person.bowHold = true; // held still, bowed in grief
      }
    }
    s.person.group.position.copy(pos);
    // lying figures stretch along local -x; align the corpse with the bier's long side
    s.person.group.rotation.y = s.bier ? 0 : (-s.off.x > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (s.bier) s.person.group.position.x += 1.0;
    addProp(s.person.group);
    onUpdate((dt, t) => { s.person.update(dt, t); s.tick && s.tick(t); });
  });
  // carriage movement between stops
  let stage = 0, moving = true, done = false;
  let interactable = null;
  onUpdate((dt) => {
    carriage.update(dt, moving);
    horse.anim = moving ? 'walk' : 'idle';
    horse.update(dt);
    if (!moving || done) return;
    const target = stops[stage] || new THREE.Vector3(0.5, 0, 70);
    const g = carriage.group;
    const dx = target.x - g.position.x, dz = target.z - g.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) {
      if (stage >= 4) { done = true; return; }
      moving = false;
      const idx = stage;
      interactable = addInteractable({
        pos: () => carriage.group.position, r: 4, marker: true, markerY: 2.6, host: carriage.group,
        action(it) {
          it.remove();
          showNarration([{ q: script('sightAsk'), who: 'You' },
            { ...NARRATION.act6[idx], who: idx === 3 ? 'Narrator' : 'Narrator' }],
            () => {
              stage++;
              if (stage >= 4) {
                setTimeout(() => nextAct(), 1200);
              } else moving = true;
            }, { focus: true });
        },
      });
    } else {
      const sp = 2.2;
      g.position.x += dx / d * sp * dt;
      g.position.z += dz / d * sp * dt;
      g.position.y = W.groundHeight(g.position.x, g.position.z);
      g.rotation.y = Math.atan2(dx, dz);
      horse.group.position.copy(g.position).add(new THREE.Vector3(Math.sin(g.rotation.y) * 2.4, 0, Math.cos(g.rotation.y) * 2.4));
      horse.group.position.y = W.groundHeight(horse.group.position.x, horse.group.position.z);
      horse.group.rotation.y = g.rotation.y;
    }
  });
};

// -- Act VII: Renunciation --
ACTS[7] = async () => {
  const W = await transition(7, 'kapilavastu', 'night', 'night');
  W.removeGate?.(); // the king's gate stands open this night — the doors are gone
  player.pos.set(3, 0, -18); // just outside the king's gate
  fireflies(new THREE.Vector3(0, 0, 10), 30);
  const horse = makeHorse(0xf2ead8); // Kanthaka, white
  horse.group.position.set(0, W.groundHeight(0, -30), -30); // within the walls
  addProp(horse.group);
  const sid = makePerson({ kind: 'prince', robe: 0xe8b84a, skin: 0xd8a877, halo: 'gold' });
  horse.group.add(sid.group);
  sid.group.position.set(0, 1.6, -0.15); // astride the taller mount, just behind the withers
  sid.setAnim('sit');
  onUpdate((dt, t) => sid.update(dt, t));
  const chandaka = makePerson({ kind: 'layman', robe: 0x5a6a8a, skin: 0xb08a60 });
  chandaka.group.position.set(1.6, W.groundHeight(1.6, -30), -30);
  addProp(chandaka.group);
  onUpdate((dt, t) => chandaka.update(dt, t));
  // gods carrying the hooves: four glowing motes under the horse
  const hoofGlow = [];
  for (let i = 0; i < 4; i++) {
    const s = makeHalo('white', 0.5);
    addProp(s);
    hoofGlow.push(s);
  }
  showNarration([NARRATION.act7[0]].map(x => ({ ...x, who: 'The gods whisper' })));
  // procession to the gate
  const gate = W.spots.gate.clone();
  let going = true;
  let clopT = 0;
  onUpdate((dt, t) => {
    horse.update(dt);
    chandaka.update(dt, t);
    if (!going) return;
    const g = horse.group;
    const dx = gate.x - g.position.x, dz = gate.z - g.position.z;
    const d = Math.hypot(dx, dz);
    hoofGlow.forEach((s, i) => {
      s.position.set(
        g.position.x + Math.sin(g.rotation.y + i * 1.57) * 0.5,
        g.position.y + 0.15,
        g.position.z + Math.cos(g.rotation.y + i * 1.57) * 0.5);
    });
    if (d < 3) {
      going = false;
      horse.anim = 'idle';
      chandaka.setAnim('idle');
      addInteractable({
        pos: () => horse.group.position, r: 4.5, markerY: 3, host: horse.group,
        action(it) {
          it.remove();
          showNarration(NARRATION.act7.slice(1), () => nextAct(), { focus: true });
        },
      });
    } else {
      horse.anim = 'walk';
      chandaka.setAnim('walk');
      const sp = 2.2;
      g.position.x += dx / d * sp * dt;
      g.position.z += dz / d * sp * dt;
      g.position.y = W.groundHeight(g.position.x, g.position.z);
      g.rotation.y = Math.atan2(dx, dz);
      chandaka.group.position.set(g.position.x + 1.4, 0, g.position.z - 0.5);
      chandaka.group.position.y = W.groundHeight(chandaka.group.position.x, chandaka.group.position.z);
      chandaka.group.rotation.y = g.rotation.y;
      clopT += dt;
      if (clopT > 0.9) { clopT = 0; sfxHorse(); }
    }
  });
};

// -- Act VIII: Austerities --
ACTS[8] = async () => {
  const W = await transition(8, 'magadha', 'day', 'ascetic');
  player.yaw = player.camYaw = 0.56; // open looking towards the austerity grounds
  const spots = [W.spots.austerity, W.spots.austerity2, W.spots.austerity3];
  // emaciated Siddhartha: bare skin, a short robe at the waist, still haloed
  const sid = makePerson({ kind: 'ascetic', skinny: true, robe: 0x9a8a6a, skin: 0xb08a5c, halo: 'gold' });
  const p0 = spots[0].clone();
  p0.y = W.groundHeight(p0.x, p0.z);
  sid.group.position.copy(p0);
  sid.setAnim('sit');
  addProp(sid.group);
  // fellow ascetics — hardened enough to notice even an unseen witness
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 8;
    const p = new THREE.Vector3(spots[0].x + Math.cos(a) * r, 0, spots[0].z + Math.sin(a) * r);
    p.y = W.groundHeight(p.x, p.z);
    spawnNPC({
      kind: 'ascetic', name: 'An ascetic', robe: 0x9a8a6a, skin: 0xa87a50,
      behaviour: 'sit', pos: p, qa: pickQA(QA_ASCETIC, 2), seesWitness: true,
    });
  }
  // he sits a while at each place, then walks to the next
  let idx = 0, sitT = 12, walking = false;
  onUpdate((dt, t) => {
    sid.update(dt, t);
    if (walking) return;
    sitT -= dt;
    if (sitT <= 0) {
      walking = true;
      idx = (idx + 1) % spots.length;
      const to = spots[idx].clone();
      to.y = W.groundHeight(to.x, to.z);
      walkPerson(sid, sid.group.position.clone(), to, 0.9, W, () => {
        sid.setAnim('sit');
        walking = false; sitT = 12;
      });
    }
  });
  addInteractable({
    pos: () => sid.group.position, r: 3.4, markerY: 2.2, host: sid.group,
    action(it) {
      it.remove();
      showNarration(NARRATION.act8.map(x => ({ ...x, who: 'The Bodhisattva' })), () => nextAct(), { focus: true });
    },
  });
};

// -- Act IX: The seat of awakening --
ACTS[9] = async () => {
  const W = await transition(9, 'magadha', 'morning', 'garden');
  const treePos = W.spots.bodhiTree;
  player.pos.copy(W.spots.sujataSide).add(new THREE.Vector3(0, 0, 8));
  player.camYaw = 0.46; // camera opens facing the river-bank scene, not away from it
  // skeletal Siddhartha sitting at the river bank
  const sid = makePerson({ kind: 'ascetic', skinny: true, robe: 0x9a8a6a, skin: 0xb08a5c, halo: 'gold' });
  const bankPos = new THREE.Vector3(W.spots.sujataSide.x - 4, 0, W.spots.sujataSide.z);
  bankPos.y = W.groundHeight(bankPos.x, bankPos.z);
  sid.group.position.copy(bankPos);
  sid.group.rotation.y = Math.PI / 2;
  sid.setAnim('sit');
  addProp(sid.group);
  onUpdate((dt, t) => sid.update(dt, t));
  // Sujata, a village girl half the size, bowing, the bowl of kheer held out
  const suj = makePerson({ kind: 'laywoman', robe: 0xd88a4a, skin: 0xd8a877, scale: 0.75 });
  suj.group.position.set(bankPos.x + 1.4, W.groundHeight(bankPos.x + 1.4, bankPos.z), bankPos.z);
  suj.group.rotation.y = -Math.PI / 2;
  suj.bowHold = true; // held still in the bow of offering
  suj.lockArms = true;
  suj.armL.rotation.set(-0.12, 0.3, -0.13); suj.elbL.rotation.set(-1.35, 0, 0.55);
  suj.armR.rotation.set(-0.12, -0.3, 0.13); suj.elbR.rotation.set(-1.35, 0, -0.55);
  const kheer = makeBowl();
  kheer.scale.setScalar(1.6);
  kheer.position.set(0, 0.28, 0.32);
  suj.body.add(kheer);
  addProp(suj.group);
  onUpdate((dt, t) => suj.update(dt, t));

  addInteractable({
    pos: () => suj.group.position, r: 3.4, markerY: 1.4, host: suj.group,
    action(it) {
      it.remove();
      showNarration(NARRATION.act9a, () => {
        // restored, he walks to the Bodhi tree; Sujātā carries the bowl home
        const to = treePos.clone();
        to.y = W.groundHeight(to.x, to.z);
        walkPerson(sid, sid.group.position.clone(), to, 1.4, W, () => {
          scene.remove(sid.group);
          placeSeated();
        });
        suj.bowHold = false;
        const home = new THREE.Vector3(60, 0, -10);
        home.y = W.groundHeight(home.x, home.z);
        walkPerson(suj, suj.group.position.clone(), home, 1.1, W, () => scene.remove(suj.group));
      }, { focus: true });
    },
  });

  // not yet the Buddha: a golden-robed figure seated beneath the tree
  let seated = null, seatedStatue = null;
  function placeSeated() {
    seated = makePerson({ kind: 'monk', robe: 0xd8a832, skin: 0xc8996c, halo: 'gold' });
    const p = treePos.clone();
    p.y = W.groundHeight(p.x, p.z) + (W.spots.buddhaLift || 0);
    seated.group.position.copy(p);
    seated.group.rotation.y = Math.PI / 2; // back to the trunk, facing the river eastward
    seated.setAnim('sit');
    addProp(seated.group);
    onUpdate((dt, t) => seated.update(dt, t));
    addInteractable({
      pos: () => seated.group.position, r: 3.6, markerY: 2.2, host: seated.group,
      action(it) {
        it.remove();
        showNarration(NARRATION.act9b, () => maraAssault(p), { focus: true });
      },
    });
  }

  function maraAssault(p) {
    setDaylight('night', 5);
    setAmbient('night');
    sfxDrum(55, 0.4);
    const demons = [];
    const n = 34;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const r = 26 + Math.random() * 8;
      const isMara = i === 0; // Māra himself towers over his army
      const d = makePerson({
        kind: 'demon',
        robe: isMara ? 0x6a1a1a : [0x5a2a2a, 0x2a3a2a, 0x3a2a4a, 0x4a3a1a][(Math.random() * 4) | 0],
        skin: isMara ? 0x8a2a1a : [0x7a3a2a, 0x4a5a3a, 0x5a4a6a][(Math.random() * 3) | 0],
        scale: isMara ? 2.2 : 0.9 + Math.random() * 0.7,
        ornate: isMara,
      });
      const pos = new THREE.Vector3(p.x + Math.cos(a) * r, 0, p.z + Math.sin(a) * r);
      pos.y = W.groundHeight(pos.x, pos.z);
      d.group.position.copy(pos);
      addProp(d.group);
      const ring = new THREE.Vector3(p.x + Math.cos(a) * (isMara ? 11 : 9), 0, p.z + Math.sin(a) * (isMara ? 11 : 9));
      demons.push({ d, target: ring, arrived: false, throwT: 1 + Math.random() * 3 });
    }
    let drumT = 0;
    const projectiles = [];
    const demonUpd = (dt, t) => {
      drumT += dt;
      if (drumT > 1.4) { drumT = 0; sfxDrum(50 + Math.random() * 20, 0.3); }
      for (const D of demons) {
        D.d.update(dt, t);
        const g = D.d.group;
        if (!D.arrived) {
          const dx = D.target.x - g.position.x, dz = D.target.z - g.position.z;
          const dd = Math.hypot(dx, dz);
          if (dd < 0.5) { D.arrived = true; D.d.setAnim('rage'); }
          else {
            D.d.setAnim('walk');
            g.position.x += dx / dd * 2.6 * dt;
            g.position.z += dz / dd * 2.6 * dt;
            g.position.y = W.groundHeight(g.position.x, g.position.z);
            g.rotation.y = Math.atan2(dx, dz);
          }
        } else {
          g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z);
          D.throwT -= dt;
          if (D.throwT <= 0) {
            D.throwT = 2.5 + Math.random() * 3;
            D.d.armR.rotation.x = -2.4;
            setTimeout(() => { if (D.d.armR) D.d.armR.rotation.x = 0; }, 300);
            const isRock = Math.random() < 0.5;
            const proj = new THREE.Mesh(
              isRock ? new THREE.IcosahedronGeometry(0.14, 0) : new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4),
              new THREE.MeshLambertMaterial({ color: isRock ? 0x777069 : 0x8a6a3a }));
            proj.position.copy(g.position).add(new THREE.Vector3(0, 1.4, 0));
            addProp(proj);
            const from = proj.position.clone();
            const to = p.clone().add(new THREE.Vector3((Math.random() - .5), 1.4 + Math.random(), (Math.random() - .5)));
            projectiles.push({ m: proj, from, to, t: 0 });
            sfxWhoosh();
          }
        }
      }
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const P = projectiles[i];
        P.t += dt * 0.55;
        const k = Math.min(1, P.t);
        P.m.position.lerpVectors(P.from, P.to, k);
        P.m.position.y += Math.sin(k * Math.PI) * 4;
        P.m.rotation.x += dt * 6;
        // disintegrate ~2m from the Buddha
        if (P.m.position.distanceTo(p.clone().setY(P.m.position.y)) < 2.6 || k >= 1) {
          burst(P.m.position, 34);
          sfxSparkle();
          scene.remove(P.m);
          projectiles.splice(i, 1);
        }
      }
    };
    onUpdate(demonUpd);
    // interact with Buddha or any demon -> Mara narration, army departs
    const demonIts = [];
    const endIt = addInteractable({
      pos: () => seated.group.position, r: 4.2, marker: true, markerY: 2.2, host: seated.group,
      action(it) {
        it.remove();
        for (const d of demonIts) d.remove();
        demonIts.length = 0;
        showNarration(NARRATION.act9c, () => {
          // Māra is defeated: the army retreats and fades
          sfxFile('assets/mp3/ender-defeat-sound-short.mp3');
          const i = game.updaters.indexOf(demonUpd);
          if (i >= 0) game.updaters.splice(i, 1);
          for (const P of projectiles) scene.remove(P.m);
          // clone materials so the fade never touches the shared material cache
          for (const D of demons) D.d.group.traverse(o => {
            if (o.isMesh || o.isSprite) { o.material = o.material.clone(); o.material.transparent = true; }
          });
          onUpdate((dt, t) => {
            for (const D of demons) {
              const g = D.d.group;
              D.d.setAnim('walk');
              D.d.update(dt, t);
              const dx = g.position.x - p.x, dz = g.position.z - p.z;
              const dd = Math.hypot(dx, dz);
              g.rotation.y = Math.atan2(dx, dz);
              g.position.x += dx / dd * 4 * dt;
              g.position.z += dz / dd * 4 * dt;
              g.position.y = W.groundHeight(g.position.x, g.position.z);
              g.traverse(o => { if (o.material) o.material.opacity = Math.max(0, o.material.opacity - dt * 0.12); });
            }
          });
          setTimeout(() => enlightenment(p), 6000);
        }, { focus: true });
      },
    });
    // demons are interactable too
    for (const D of demons.slice(0, 6)) {
      demonIts.push(addInteractable({
        pos: () => D.d.group.position, r: 3, marker: false,
        action() { if (endIt.alive) endIt.action(endIt); },
      }));
    }
  }

  async function enlightenment(p) {
    player.frozen = true;
    setDaylight('radiance', 7);
    setAmbient('radiance');
    sfxFile('assets/mp3/enlightenment-reached.mp3');
    sfxFile('assets/mp3/levelup-mc.mp3');
    radiance(p);
    motes(p, 30, 220);
    petals(p.clone().setY(6), 24, 160, [[1, .9, .6], [1, 1, 1], [.9, .7, 1]]);
    // in the moment of awakening, the figure becomes the Buddha
    const B = makeBuddha({ handsJoined: false });
    B.setAnim('sit');
    B.group.position.copy(seated.group.position);
    B.group.rotation.y = seated.group.rotation.y;
    scene.remove(seated.group);
    addProp(B.group);
    onUpdate((dt, t) => B.update(dt, t));
    seatedStatue = B.group;
    // Sujātā returns and sits close by the Awakened One
    const suj2 = makePerson({ kind: 'laywoman', robe: 0xd88a4a, skin: 0xd8a877, scale: 0.75 });
    suj2.group.position.set(p.x + 1.9, W.groundHeight(p.x + 1.9, p.z + 1.4), p.z + 1.4);
    suj2.group.rotation.y = Math.atan2(p.x - (p.x + 1.9), p.z - (p.z + 1.4));
    suj2.setAnim('sit');
    addProp(suj2.group);
    onUpdate((dt, t) => suj2.update(dt, t));
    setTimeout(() => {
      showNarration(NARRATION.act9d, () => {
        maybeFocusReward();
        player.frozen = false;
        addInteractable({
          pos: () => seatedStatue.position, r: 3.6, markerY: 2.0, host: seatedStatue,
          action(it) { it.remove(); nextAct(); },
        });
      }, { focus: true });
    }, 7000);
  }
};

// -- Act X: First teaching --
ACTS[10] = async () => {
  const W = await transition(10, 'deerpark', 'golden', 'garden');
  setWitnessForm('normal'); // the unseen witness becomes a monastic of flesh again
  player.pos.set(3, 0, 0);  // close to the five ascetics
  player.pos.y = W.groundHeight(player.pos.x, player.pos.z);
  // deer
  for (let i = 0; i < 8; i++) {
    const deer = makeDeer();
    const x = (Math.random() - 0.5) * 60, z = (Math.random() - 0.5) * 60;
    deer.group.position.set(x, W.groundHeight(x, z), z);
    deer.group.rotation.y = Math.random() * 6;
    addProp(deer.group);
    let wt = Math.random() * 5, tgt = null;
    onUpdate((dt) => {
      deer.update(dt);
      if (!tgt) {
        wt -= dt;
        deer.anim = 'idle';
        if (wt <= 0) {
          const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 8;
          tgt = new THREE.Vector3(deer.group.position.x + Math.cos(a) * r, 0, deer.group.position.z + Math.sin(a) * r);
        }
      } else {
        deer.anim = 'walk'; deer.speed = 0.6;
        const g = deer.group;
        const dx = tgt.x - g.position.x, dz = tgt.z - g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.5) { tgt = null; wt = 2 + Math.random() * 6; }
        else {
          g.position.x += dx / d * 1.4 * dt; g.position.z += dz / d * 1.4 * dt;
          g.position.y = W.groundHeight(g.position.x, g.position.z);
          g.rotation.y = Math.atan2(dx, dz);
        }
      }
    });
  }
  // the five ascetics
  const five = [];
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    const pos = new THREE.Vector3(W.spots.ascetics.x + Math.sin(a) * 3.4, 0, W.spots.ascetics.z + Math.cos(a) * 3.4);
    pos.y = W.groundHeight(pos.x, pos.z);
    const P = makePerson({ kind: 'ascetic', robe: 0x9a8a6a, skin: 0xa87a50 });
    P.group.position.copy(pos);
    P.setAnim('sit');
    P.group.rotation.y = Math.atan2(W.spots.dais.x - pos.x, W.spots.dais.z - pos.z);
    addProp(P.group);
    onUpdate((dt, t) => P.update(dt, t));
    five.push(P);
  }
  // the Buddha approaches on foot: dark gold robes, golden skin, hands joined
  const buddha = makeBuddha();
  const from = W.spots.buddhaWalkFrom.clone();
  from.y = W.groundHeight(from.x, from.z);
  buddha.group.position.copy(from);
  addProp(buddha.group);
  onUpdate((dt, t) => buddha.update(dt, t));
  showNarration([NARRATION.act10[0]].map(x => ({ ...x, who: 'The Blessed One' })));
  const to = W.spots.dais.clone();
  to.y = W.groundHeight(to.x, to.z);
  // the five sit facing the platform until he is halfway; then they stand and
  // follow him with their eyes, holding a bow as he draws near
  const halfway = from.distanceTo(to) / 2;
  let standing = false, risen = false;
  onUpdate(() => {
    const bp = buddha.group.position;
    if (!standing && bp.distanceTo(to) < halfway) {
      standing = true;
      for (const P of five) P.setAnim('idle');
    }
    if (standing) for (const P of five) {
      const g = P.group;
      g.rotation.y = Math.atan2(bp.x - g.position.x, bp.z - g.position.z);
    }
    if (!risen && bp.distanceTo(to) < 9) {
      risen = true;
      for (const P of five) P.bowHold = true;
      sfxBell(320, 0.15, 5);
    }
  });
  walkPerson(buddha, from, to, 1.4, W, () => arrive());
  function arrive() {
    // the same figure simply takes his seat, a little higher on the mound
    const p = W.spots.dais.clone();
    p.y = W.groundHeight(p.x, p.z) + 0.55;
    buddha.group.position.copy(p);
    buddha.group.rotation.y = Math.atan2(W.spots.ascetics.x - p.x, W.spots.ascetics.z - p.z); // facing the five
    buddha.setAnim('sit');
    setTimeout(() => { for (const P of five) { P.bowHold = false; P.setAnim('sit'); } }, 2500);
    setTimeout(() => {
      showNarration(NARRATION.act10.map(x => ({ ...x, who: 'The Blessed One' })), () => {
        maybeFocusReward();
        addInteractable({
          pos: () => buddha.group.position, r: 3.8, markerY: 2.2, host: buddha.group,
          action(it) { it.remove(); nextAct(); },
        });
      }, { focus: true });
    }, 3500);
  }
};

// -- Act XI: Back in Jeta's Grove --
ACTS[11] = async () => {
  const W = await transition(11, 'jeta', 'day', 'forest');
  const buddha = await placeBuddha(W, W.spots.buddha, { ry: -0.6 });
  spawnSangha(W, W.spots.buddha, { monks: 34, bowNear: W.spots.buddha });
  spawnDisciples(W, W.spots.buddha);
  resetQuestions();
  petals(W.spots.buddha.clone().setY(2), 20, 60, [[1, 1, 1], [1, .85, .9]]);
  addInteractable({
    pos: W.spots.buddha.clone(), r: 3.6, markerY: 2.8,
    action(it) {
      it.remove();
      showNarration(NARRATION.act11.map((x, i) => i === 0 ? { ...x, who: 'The Blessed One' } : x),
        () => nextAct(), { focus: true });
    },
  });
};

// -- Act XII: Mahaparinirvana --
ACTS[12] = async () => {
  const W = await transition(12, 'kushinagar', 'dusk', 'sorrow');
  const c = W.spots.couch.clone();
  // couch between the twin trees
  const couch = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 1.1),
    new THREE.MeshLambertMaterial({ color: 0x8a6a3a, flatShading: true }));
  couch.position.set(c.x, W.groundHeight(c.x, c.z) + 0.22, c.z);
  couch.castShadow = true;
  addProp(couch);
  // the Blessed One reclining on his right side between the twin trees
  const lying = makeBuddha({ handsJoined: false });
  lying.setAnim('lie');
  lying.group.position.set(c.x + 0.9, W.groundHeight(c.x, c.z) + 0.5, c.z);
  addProp(lying.group);
  onUpdate((dt, t) => lying.update(dt, t));
  spawnSangha(W, c, { monks: 30, withQA: false, qaBank: QA_IMPERMANENCE });
  spawnDisciples(W, c);
  // everyone faces the couch, seated
  for (const N of npcs) {
    N.behaviour = 'sit';
    N.person.setAnim('sit');
    N.group.rotation.y = Math.atan2(c.x - N.group.position.x, c.z - N.group.position.z);
  }
  petals(c.clone().setY(4), 16, 60, [[1, 1, 1], [.95, .9, .8]]);
  addInteractable({
    pos: c.clone(), r: 4, markerY: 2.4,
    action(it) {
      it.remove();
      showNarration(NARRATION.act12.map(x => ({ ...x, who: 'The Blessed One' })), async () => {
        maybeFocusReward();
        // passing: light rises, then quiet
        player.frozen = true;
        setDaylight('radiance', 8);
        setAmbient('radiance');
        sfxSwell(10);
        motes(c, 20, 200);
        setTimeout(async () => {
          await ending();
        }, 9000);
      }, { focus: true });
    },
  });
};

async function ending() {
  await fade(true);
  clearStage();
  const title = document.getElementById('title');
  title.classList.remove('gone');
  title.querySelector('h1').textContent = T('endTitle');
  title.querySelector('h2').textContent = T('endSub');
  const btn = document.getElementById('beginBtn');
  btn.textContent = T('returnBtn');
  btn.style.display = '';
  document.getElementById('charPick').style.display = 'none';
  document.getElementById('langStep')?.style.setProperty('display', 'none');
  // a way to support the project, in the reader's language
  let sup = document.getElementById('supportBtn');
  if (!sup) {
    sup = document.createElement('a');
    sup.id = 'supportBtn';
    sup.target = '_blank';
    sup.rel = 'noopener';
    btn.insertAdjacentElement('afterend', sup);
  }
  sup.href = T('supportUrl');
  sup.textContent = T('support');
  // Enter returns to the grove
  const onEnter = (e) => { if (e.code === 'Enter' && !title.classList.contains('gone')) btn.click(); };
  addEventListener('keydown', onEnter);
  await fade(false);
  btn.onclick = async () => {
    removeEventListener('keydown', onEnter);
    title.classList.add('gone');
    // open-ended free roam at sunrise
    const W = await transition(0, 'jeta', 'morning', 'forest');
    setDaylight('day', 60); // slow sunrise into day
    await placeBuddha(W, W.spots.buddha, { ry: -0.6 });
    spawnSangha(W, W.spots.buddha, { monks: 34, bowNear: W.spots.buddha });
    spawnDisciples(W, W.spots.buddha);
    resetQuestions();
    game.act = 99;
  };
}

// ---------- act flow ----------
export async function startAct(i) {
  game.act = i;
  await ACTS[i]();
}
export function nextAct() {
  if (game.act >= 12) { return; }
  startAct(game.act + 1);
}
export function updateActs(dt, t) {
  for (let i = game.updaters.length - 1; i >= 0; i--) game.updaters[i](dt, t);
  // update interactable marker bobbing
  for (const it of game.interactables) {
    if (it.sprite && !it.sprite.parent?.isGroup) {
      // world-space sprite bob
    }
  }
}
