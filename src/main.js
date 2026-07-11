// Boot: title screen, preload, main loop.
import * as THREE from 'three';
import { renderer, scene, camera, preload, updateDaylight, snapDaylight } from './engine.js';
import { createPlayerAvatar, updatePlayer, player } from './player.js';
import { updateNPCs } from './npc.js';
import { updateParticles } from './particles.js';
import { startAct, updateActs, game } from './acts.js';
import { world } from './world.js';
import { initAudio } from './audio.js';
import { T, LANG, setLang } from './i18n.js';

const MODELS = [
  'banyan', 'oak', 'mango', 'plain-tree', 'willow', 'bodhi-tree', 'bone-pile',
  'palace-temple', 'guanyin', 'heavenly-god', 'heavenly-god-02',
];

const title = document.getElementById('title');
const beginBtn = document.getElementById('beginBtn');
const charPick = document.getElementById('charPick');
const loadNote = document.getElementById('loadNote');

snapDaylight('day');

// ---------- language ----------
const langStep = document.getElementById('langStep');
function applyLang() {
  document.title = T('title');
  title.querySelector('h1').textContent = T('title');
  title.querySelector('h2').textContent = T('subtitle');
  beginBtn.textContent = T('begin');
  document.querySelector('.charCard[data-c="monk"] .nm').textContent = T('monk');
  document.querySelector('.charCard[data-c="nun"] .nm').textContent = T('nun');
  document.getElementById('ctrlHint').textContent = T('hint');
  document.querySelector('#rotateHint').lastChild.textContent = T('rotate');
  document.querySelector('#focusWrap .lbl').textContent = T('mindfulness');
}
applyLang();

let preloadPromise = null;
beginBtn.addEventListener('click', () => {
  initAudio();
  if (game.act >= 0) return; // ending screen re-uses the button with its own handler
  beginBtn.style.display = 'none';
  langStep.style.display = 'flex'; // choose a language first, then a character
  if (!preloadPromise) {
    loadNote.textContent = T('loading');
    preloadPromise = preload(MODELS, (d, n) => {
      loadNote.textContent = `${T('loading')} ${d} / ${n}`;
    }).then(() => { loadNote.textContent = ''; });
  }
});
// Enter on the title screen presses the visible button
addEventListener('keydown', (e) => {
  if (e.code !== 'Enter' || title.classList.contains('gone')) return;
  if (beginBtn.style.display !== 'none') beginBtn.click();
});
for (const card of langStep.querySelectorAll('.charCard:not(.off)')) {
  card.addEventListener('click', () => {
    setLang(card.dataset.l);
    applyLang();
    langStep.style.display = 'none';
    charPick.style.display = 'flex';
  });
}

for (const card of charPick.querySelectorAll('.charCard')) {
  card.addEventListener('click', async () => {
    initAudio();
    charPick.style.display = 'none';
    loadNote.textContent = loadNote.textContent || ' ';
    await preloadPromise;
    createPlayerAvatar(card.dataset.c);
    title.classList.add('gone');
    startAct(0);
  });
}

// debug/e2e hooks
window.__game = game;
window.__player = player;
window.__startAct = startAct;
window.__snapDaylight = snapDaylight;

// ---------- loop ----------
const clock = new THREE.Clock();
let elapsed = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  if (world) {
    player.world = world;
    world.update(dt, elapsed);
  }
  updatePlayer(dt, elapsed);
  updateNPCs(dt, elapsed);
  updateActs(dt, elapsed);
  updateParticles(dt);
  updateDaylight(dt, player.person ? player.pos : camera.position);
  renderer.render(scene, camera);
});
