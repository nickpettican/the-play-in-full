// Bubble UI, choice menus, mindfulness/focus meter.
import { sfxBlip, sfxChime, duckAmbient } from './audio.js';
import { T } from './i18n.js';

const bubble = document.getElementById('bubble');
const whoEl = bubble.querySelector('.who');
const txtEl = bubble.querySelector('.txt');
const srcEl = bubble.querySelector('.src');
const nextEl = bubble.querySelector('.next');
const choicesEl = document.getElementById('choices');
const focusWrap = document.getElementById('focusWrap');
const focusFill = document.getElementById('focusFill');

export const dialogue = {
  open: false,
  focus: 0.4,         // 0..1 mindfulness — read attentively and sit quietly to raise it
  focusTracked: false,
};

let queue = [], onDone = null, shownAt = 0, minReadMs = 0;
let typeTimer = null, typing = false, fullText = '';

function minRead(text) {
  // ~200 wpm reading pace; require at least 60% of that before a "mindful" continue
  const words = text.split(/\s+/).length;
  return Math.max(900, words / 200 * 60000 * 0.6);
}

function typeIn(text) {
  clearInterval(typeTimer);
  let i = 0;
  fullText = text;
  typing = true;
  txtEl.textContent = '';
  typeTimer = setInterval(() => {
    i = Math.min(text.length, i + 3);
    txtEl.textContent = text.slice(0, i);
    if (i >= text.length) { clearInterval(typeTimer); typing = false; }
  }, 16);
}

function showPage(page) {
  // the Lalitavistara is recited by Ānanda ("Thus did I hear…")
  whoEl.textContent = page.who || (page.src?.includes('Lalitavistara') ? 'Ānanda' : 'Narrator');
  typeIn(page.q);
  srcEl.textContent = page.src ? '— ' + page.src : '';
  srcEl.style.display = page.src ? '' : 'none';
  choicesEl.innerHTML = '';
  choiceEls = [];
  nextEl.style.display = '';
  nextEl.textContent = queue.length ? T('cont') : T('close');
  shownAt = performance.now();
  minReadMs = minRead(page.q);
  page.onShow?.(); // lets acts stage things timed to a specific page
}

// pages: [{q, src?, who?}], opts: {focus: bool} — mindfulness tracked unless focus: false
export function showNarration(pages, done, opts = {}) {
  queue = pages.slice(1);
  dialogue.open = true;
  dialogue.focusTracked = opts.focus !== false;
  if (dialogue.focusTracked) {
    focusWrap.classList.add('show');
    focusFill.style.width = (dialogue.focus * 100) + '%';
  }
  onDone = done || null;
  bubble.style.display = 'block';
  document.exitPointerLock?.();
  duckAmbient(0.45, 0.6);
  showPage(pages[0]);
}

function advance() {
  if (typing) {
    // interrupting the words as they come is rushing; it costs mindfulness,
    // and an empty mind has none left to spend
    if (dialogue.focusTracked) {
      if (dialogue.focus <= 0) return;
      dialogue.focus = Math.max(0, dialogue.focus - 0.18);
      focusFill.style.width = (dialogue.focus * 100) + '%';
    }
    clearInterval(typeTimer);
    txtEl.textContent = fullText;
    typing = false;
    return;
  }
  // a patient read earns a little; simply continuing costs nothing
  if (dialogue.focusTracked && performance.now() - shownAt >= minReadMs) {
    dialogue.focus = Math.min(1, dialogue.focus + 0.08);
    focusFill.style.width = (dialogue.focus * 100) + '%';
  }
  sfxBlip();
  if (queue.length) showPage(queue.shift());
  else closeBubble();
}

export function closeBubble() {
  clearInterval(typeTimer);
  bubble.style.display = 'none';
  dialogue.open = false;
  focusWrap.classList.remove('show');
  duckAmbient(1, 1.2);
  const cb = onDone; onDone = null;
  if (cb) cb();
}

// choices: [{label, action}] — navigable with arrow keys + Enter, Esc leaves
let choiceEls = [], choiceSel = -1;
function selectChoice(i) {
  if (!choiceEls.length) return;
  choiceSel = ((i % choiceEls.length) + choiceEls.length) % choiceEls.length;
  choiceEls.forEach((el, j) => el.classList.toggle('sel', j === choiceSel));
}
export function showChoices(who, prompt, choices, onClose) {
  dialogue.open = true;
  dialogue.focusTracked = false;
  onDone = onClose || null;
  bubble.style.display = 'block';
  document.exitPointerLock?.();
  whoEl.textContent = who;
  typeIn(prompt);
  srcEl.style.display = 'none';
  nextEl.style.display = 'none';
  choicesEl.innerHTML = '';
  choiceEls = []; choiceSel = -1;
  duckAmbient(0.45, 0.6);
  for (const c of choices) {
    const d = document.createElement('div');
    d.className = 'choice';
    d.textContent = c.label;
    d.onclick = (e) => { e.stopPropagation(); sfxBlip(); c.action(); };
    choicesEl.appendChild(d);
    choiceEls.push(d);
  }
  const leave = document.createElement('div');
  leave.className = 'choice';
  leave.style.opacity = '0.65';
  leave.textContent = T('silent');
  leave.onclick = (e) => { e.stopPropagation(); closeBubble(); };
  choicesEl.appendChild(leave);
  choiceEls.push(leave);
  selectChoice(0);
}

// Show a single Q->A exchange, then return to browsing via onBack.
export function showAnswer(who, qa, onBack) {
  showNarration([{ q: qa.a, src: qa.src, who }], onBack);
}

nextEl.addEventListener('click', (e) => { e.stopPropagation(); advance(); });
bubble.addEventListener('click', (e) => e.stopPropagation());

// keyboard: E/Enter advance narration; arrows + Enter navigate choices; Esc leaves
addEventListener('keydown', (e) => {
  if (!dialogue.open) return;
  if (e.code === 'Escape') { closeBubble(); return; }
  const choicesOpen = nextEl.style.display === 'none' && choiceEls.length;
  if (choicesOpen) {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); selectChoice(choiceSel + 1); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); selectChoice(choiceSel - 1); }
    else if (e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); choiceEls[choiceSel]?.click(); }
    return;
  }
  if (e.code === 'KeyE' || e.code === 'Enter') advance();
});

// show/refresh the mindfulness bar outside narration (e.g. while sitting)
export function focusHud(on) {
  if (dialogue.open && dialogue.focusTracked) return; // narration owns the bar
  focusWrap.classList.toggle('show', on);
  if (on) focusFill.style.width = (dialogue.focus * 100) + '%';
}

// ---------- act title card ----------
const actCard = document.getElementById('actCard');
const veil = document.getElementById('veil');
export function showActCard(num, name, holdMs = 2600) {
  return new Promise(res => {
    actCard.querySelector('.actNum').textContent = num;
    actCard.querySelector('.actName').textContent = name;
    actCard.classList.add('show');
    sfxChime();
    setTimeout(() => { actCard.classList.remove('show'); setTimeout(res, 900); }, holdMs);
  });
}
export function fade(showVeil) {
  veil.classList.toggle('show', showVeil);
  return new Promise(res => setTimeout(res, 1250));
}
