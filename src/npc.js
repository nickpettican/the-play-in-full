// NPCs: behaviour (idle/sit/wander), talk markers, question dialogues.
import * as THREE from 'three';
import { scene } from './engine.js';
import { makePerson, makeTalkMarker, makeNameLabel } from './characters.js';
import { showChoices, showAnswer, closeBubble } from './dialogue.js';
import { player } from './player.js';
import { T, LANG, tr } from './i18n.js';

export const npcs = [];

// opts: person opts + {name, qa: [{q,a,src}], behaviour: 'sit'|'idle'|'wander', pos, yaw, wanderR}
export function spawnNPC(opts) {
  const P = makePerson(opts);
  const N = {
    person: P, group: P.group,
    name: opts.name || (opts.kind === 'nun' ? 'A nun' : opts.kind === 'deva' || opts.kind === 'devi' ? 'A god' : 'A monk'),
    qa: (opts.qa || []).slice(),
    asked: new Set(),
    behaviour: opts.behaviour || 'idle',
    home: opts.pos.clone(), target: null, waitT: Math.random() * 4,
    wanderR: opts.wanderR || 8,
    avoid: opts.avoid || null,
    bowNear: opts.bowNear || null,   // Vector3: bow in reverence when passing close
    seesWitness: !!opts.seesWitness, // can perceive (and talk to) the translucent witness
    marker: null, interactable: false, custom: opts.onTalk || null,
  };
  P.group.position.copy(opts.pos);
  P.group.rotation.y = opts.yaw || Math.random() * Math.PI * 2;
  if (N.behaviour === 'sit') P.setAnim('sit');
  // named figures (disciples, bodhisattvas) carry a floating name
  if (N.name && !/^(A|An)\s/.test(N.name)) {
    N.label = makeNameLabel(tr(N.name));
    // the label rides inside the scaled group: offset in local, unscaled units
    N.label.position.y = (P.height + 0.28) / (opts.scale || 1);
    P.group.add(N.label);
  }
  refreshMarker(N);
  scene.add(P.group);
  npcs.push(N);
  return N;
}

function refreshMarker(N) {
  const has = N.custom || N.qa.some(x => !N.asked.has(x.q));
  if (has && !N.marker) {
    N.marker = makeTalkMarker();
    N.marker.position.y = (N.person.height + 0.55) / (N.person.opts.scale || 1);
    N.group.add(N.marker);
  } else if (!has && N.marker) {
    N.group.remove(N.marker);
    N.marker = null;
  }
  N.interactable = has;
}

export function clearNPCs() {
  for (const n of npcs) scene.remove(n.group);
  npcs.length = 0;
}

export function updateNPCs(dt, t) {
  const W = player.world;
  for (const N of npcs) {
    const g = N.group;
    if (N.behaviour === 'wander' && !N.talking) {
      if (!N.target) {
        N.waitT -= dt;
        if (N.waitT <= 0) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * N.wanderR;
          const tx = N.home.x + Math.cos(a) * r, tz = N.home.z + Math.sin(a) * r;
          if (N.avoid && N.avoid(tx, tz)) { N.waitT = 0.5; }
          else N.target = new THREE.Vector3(tx, 0, tz);
        }
        N.person.setAnim('idle');
      } else {
        const dx = N.target.x - g.position.x, dz = N.target.z - g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.4) { N.target = null; N.waitT = 2 + Math.random() * 6; N.person.setAnim('idle'); }
        else {
          const sp = 1.1;
          g.position.x += dx / d * sp * dt;
          g.position.z += dz / d * sp * dt;
          g.rotation.y = Math.atan2(dx, dz);
          N.person.setAnim('walk');
          N.person.speed = 0.35;
          // avoid colliders
          if (W) for (const c of W.colliders) {
            const ex = g.position.x - c.x, ez = g.position.z - c.z;
            const d2 = ex * ex + ez * ez, rr = c.r + 0.35;
            if (d2 < rr * rr && d2 > 1e-6) {
              const dd = Math.sqrt(d2);
              g.position.x = c.x + ex / dd * rr; g.position.z = c.z + ez / dd * rr;
              N.target = null; N.waitT = 1;
            }
          }
        }
      }
    }
    if (W && N.behaviour !== 'static') g.position.y = W.groundHeight(g.position.x, g.position.z);
    // reverence: walking close past the Blessed One, they pause and bow
    if (N.bowNear && N.behaviour === 'wander') {
      N._bowCd = (N._bowCd ?? 0) - dt;
      const db = Math.hypot(g.position.x - N.bowNear.x, g.position.z - N.bowNear.z);
      if (N._bowCd <= 0 && db < 6.5) {
        N.person.bow();
        // this reverence is to the Blessed One: turn to him, not the player
        g.rotation.y = Math.atan2(N.bowNear.x - g.position.x, N.bowNear.z - g.position.z);
        N.target = null; N.waitT = 2.5; // stop for the bow
        N._bowCd = 16 + Math.random() * 10;
      }
    }
    // face player when close and idle (a translucent witness goes unnoticed)
    const dp = g.position.distanceTo(player.pos);
    if (dp < 3.5 && N.behaviour !== 'sit' && !N.target && !player.translucent && !(N.person.bowT > 0)) {
      const want = Math.atan2(player.pos.x - g.position.x, player.pos.z - g.position.z);
      let dr = want - g.rotation.y;
      while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
      g.rotation.y += dr * Math.min(1, dt * 4);
    }
    if (N.marker) {
      N.marker.position.y = (N.person.height + 0.55 + Math.sin(t * 2 + N.home.x) * 0.06) / (N.person.opts.scale || 1);
      N.marker.material.opacity = (player.translucent && !N.seesWitness) ? 0 : dp < 12 ? 1 : Math.max(0, 1 - (dp - 12) / 8);
    }
    if (N.label) N.label.material.opacity = dp < 10 ? 0.95 : Math.max(0, 1 - (dp - 10) / 8);
    N.person.update(dt, t);
  }
}

// nearest interactable NPC in front of player within range
export function nearestNPC(range = 2.8) {
  let best = null, bestD = range;
  for (const N of npcs) {
    if (!N.interactable) continue;
    if (player.translucent && !N.seesWitness) continue;
    const d = N.group.position.distanceTo(player.pos);
    if (d < bestD) { bestD = d; best = N; }
  }
  return best;
}

export function talkTo(N) {
  if (N.custom) { N.custom(N); return; }
  openQuestionMenu(N);
}

export function openQuestionMenu(N) {
  const open = N.qa.filter(x => !N.asked.has(x.q));
  if (!open.length) { refreshMarker(N); return; }
  N.talking = true;
  const choices = open.slice(0, 4).map(qa => ({
    label: qa.q,
    action: () => {
      N.asked.add(qa.q);
      showAnswer(N.name, qa, () => {
        N.talking = false;
        refreshMarker(N);
        const remaining = N.qa.some(x => !N.asked.has(x.q));
        if (remaining) openQuestionMenu(N);
      });
    },
  }));
  const prompt = LANG === 'es'
    ? T('regard')
    : 'The ' + (N.name.startsWith('A ') ? N.name.slice(2) : 'venerable one') + ' ' + T('regard');
  showChoices(N.name, prompt, choices,
    () => { N.talking = false; refreshMarker(N); });
}

// Re-arm all NPC questions (used in Act XI).
export function resetQuestions() {
  for (const N of npcs) { N.asked.clear(); refreshMarker(N); }
}
export function allQuestionsExhausted() {
  return npcs.every(N => !N.qa.length || N.qa.every(x => N.asked.has(x.q)));
}
