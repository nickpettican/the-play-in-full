// Procedural audio: ambient beds per world + SFX. All Web Audio, no assets.
let ctx = null, master = null, ambBus = null, sfxBus = null;
let ambientNodes = [];
let birdTimer = null, bowlTimer = null, currentAmbient = null, pendingAmbient = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
  // an ambient requested before the first user gesture starts now
  if (pendingAmbient) { const n = pendingAmbient; pendingAmbient = null; setAmbient(n); }
}
const now = () => ctx.currentTime;

function noiseBuffer(sec = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
let _noise;
const getNoise = () => (_noise ||= noiseBuffer());

// ---------- ambient beds ----------
function stopAmbient(fade = 2) {
  for (const n of ambientNodes) {
    try {
      if (n.gain) n.gain.gain.linearRampToValueAtTime(0.0001, now() + fade);
      setTimeout(() => { try { n.src.stop(); } catch (e) {} }, fade * 1000 + 100);
    } catch (e) {}
  }
  ambientNodes = [];
  if (birdTimer) { clearTimeout(birdTimer); birdTimer = null; }
  if (bowlTimer) { clearTimeout(bowlTimer); bowlTimer = null; }
}

// a distant singing bowl, struck softly every so often — the heartbeat of the soundscape
function scheduleBowl(freqs = [196, 220, 261.6]) {
  const strike = () => {
    const f = freqs[(Math.random() * freqs.length) | 0];
    const t = now() + 0.05;
    for (const [ratio, amp] of [[1, 1], [2.76, 0.35], [5.4, 0.12]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035 * amp, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0004, t + 8 / Math.sqrt(ratio));
      o.connect(g); g.connect(ambBus);
      o.start(t); o.stop(t + 9);
    }
    bowlTimer = setTimeout(strike, (18 + Math.random() * 24) * 1000);
  };
  bowlTimer = setTimeout(strike, (6 + Math.random() * 10) * 1000);
}

function addDrone(freq, gainV, type = 'sine', detune = 3, fade = 3) {
  const g = ctx.createGain(); g.gain.value = 0.0001;
  g.gain.linearRampToValueAtTime(gainV, now() + fade);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 4;
  f.connect(g); g.connect(ambBus);
  for (const d of [-detune, detune]) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = d;
    o.connect(f); o.start();
    ambientNodes.push({ src: o, gain: g });
  }
}
function addWind(gainV, cutoff = 400, fade = 3) {
  const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = 0.0001;
  g.gain.linearRampToValueAtTime(gainV, now() + fade);
  // slow wind swell
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.05;
  const lg = ctx.createGain(); lg.gain.value = cutoff * 0.5;
  lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  src.connect(f); f.connect(g); g.connect(ambBus); src.start();
  ambientNodes.push({ src, gain: g }, { src: lfo, gain: null });
}
function birdChirp() {
  const o = ctx.createOscillator(); o.type = 'sine';
  const g = ctx.createGain(); g.gain.value = 0;
  o.connect(g); g.connect(ambBus);
  const t0 = now() + 0.02;
  const base = 1700 + Math.random() * 1400; // lower, softer birdsong
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const t = t0 + i * (0.11 + Math.random() * 0.07);
    o.frequency.setValueAtTime(base + Math.random() * 400, t);
    o.frequency.exponentialRampToValueAtTime(base * (1.15 + Math.random() * 0.3), t + 0.06);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.028 + Math.random() * 0.02, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  }
  o.start(t0); o.stop(t0 + n * 0.16 + 0.2);
}
function scheduleBirds(density) {
  const loop = () => {
    birdChirp();
    birdTimer = setTimeout(loop, (1.2 + Math.random() * 5) * 1000 / density);
  };
  birdTimer = setTimeout(loop, 800);
}
function addShimmer(fade = 4) { // celestial bell-ish sparkles for heaven
  const loop = () => {
    if (currentAmbient !== 'heaven' && currentAmbient !== 'radiance') return;
    const f = 700 + Math.random() * 1600;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g); g.connect(ambBus);
    const t = now() + 0.02;
    g.gain.linearRampToValueAtTime(0.03, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 2.5);
    o.start(t); o.stop(t + 2.7);
    setTimeout(loop, (0.8 + Math.random() * 2.4) * 1000);
  };
  setTimeout(loop, fade * 300);
}

// Indian wedding music: tanpura drones, a dholak cycle, and a shehnai-like
// lead improvising short ornamented phrases on the Bhūpālī scale.
function addWedding() {
  addDrone(130.8, 0.018); addDrone(196, 0.012); addDrone(261.6, 0.007); // tanpura: sa–pa–sa
  const SCALE = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];   // C D E G A, two octaves
  const dhol = (t, f, amp) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.3);
    o.connect(g); g.connect(ambBus); o.start(t); o.stop(t + 0.4);
  };
  (function beat() {
    if (currentAmbient !== 'wedding') return;
    const t = now() + 0.05; // dha – ge – na – ti: a light dholak cycle
    dhol(t, 80, 0.085); dhol(t + 0.4, 150, 0.04); dhol(t + 0.8, 80, 0.06);
    dhol(t + 1.0, 150, 0.04); dhol(t + 1.2, 110, 0.05);
    setTimeout(beat, 1600);
  })();
  (function phrase() {
    if (currentAmbient !== 'wedding') return;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.2;
    const g = ctx.createGain(); g.gain.value = 0;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.5;   // gamak: gentle vibrato
    const vg = ctx.createGain(); vg.gain.value = 4;
    vib.connect(vg); vg.connect(o.frequency); vib.start();
    o.connect(f); f.connect(g); g.connect(ambBus);
    let t = now() + 0.1;
    let idx = 2 + ((Math.random() * (SCALE.length - 2)) | 0);
    let freq = SCALE[idx];
    o.frequency.setValueAtTime(freq, t);
    const n = 4 + (Math.random() * 4 | 0);
    for (let i = 0; i < n; i++) {
      idx = Math.max(0, Math.min(SCALE.length - 1, idx + ((Math.random() * 5) | 0) - 2));
      const dur = [0.35, 0.35, 0.7, 1.05][(Math.random() * 4) | 0];
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(SCALE[idx], t + 0.09); // meend: slide into the note
      freq = SCALE[idx];
      f.frequency.setValueAtTime(freq * 2.5, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.08);
      g.gain.linearRampToValueAtTime(0.028, t + dur);
      t += dur;
    }
    g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
    o.start(); o.stop(t + 0.7); vib.stop(t + 0.7);
    setTimeout(phrase, (t - now()) * 1000 + 1200 + Math.random() * 2500);
  })();
}

// name: forest | palace | night | heaven | ascetic | radiance | sorrow | wedding
export function setAmbient(name) {
  if (!ctx) { pendingAmbient = name; return; } // audio unlocks on the first gesture
  if (name === currentAmbient) return;
  currentAmbient = name;
  stopAmbient(2.5);
  switch (name) {
    case 'forest':
      addWind(0.06, 380); addDrone(110, 0.020, 'sine'); addDrone(165, 0.012, 'sine');
      scheduleBirds(0.8); scheduleBowl([196, 220, 261.6]);
      break;
    case 'garden':
      addWind(0.05, 460); addDrone(146.8, 0.018); addDrone(220, 0.010);
      scheduleBirds(1.2); scheduleBowl([220, 261.6, 293.7]);
      break;
    case 'palace':
      addWind(0.04, 260); addDrone(98, 0.02); addDrone(147, 0.014); addDrone(196, 0.008);
      scheduleBowl([147, 196]);
      break;
    case 'night':
      addWind(0.05, 200); addDrone(65.4, 0.024); addDrone(98, 0.010);
      scheduleBowl([130.8, 164.8]);
      // crickets
      (function cricket() {
        if (currentAmbient !== 'night') return;
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 4200 + Math.random() * 400;
        const g = ctx.createGain(); g.gain.value = 0;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4300; f.Q.value = 8;
        o.connect(f); f.connect(g); g.connect(ambBus);
        const t = now();
        for (let i = 0; i < 6; i++) {
          g.gain.setValueAtTime(0.007, t + i * 0.07);
          g.gain.setValueAtTime(0.0001, t + i * 0.07 + 0.035);
        }
        o.start(t); o.stop(t + 0.5);
        setTimeout(cricket, 900 + Math.random() * 2200);
      })();
      break;
    case 'heaven':
      addDrone(130.8, 0.022); addDrone(196, 0.016); addDrone(261.6, 0.012); addDrone(392, 0.007);
      addWind(0.03, 700); addShimmer(); scheduleBowl([261.6, 329.6, 392]);
      break;
    case 'radiance':
      addDrone(130.8, 0.026); addDrone(164.8, 0.02); addDrone(196, 0.018); addDrone(246.9, 0.012); addDrone(329.6, 0.008);
      addShimmer(); scheduleBowl([261.6, 329.6]);
      break;
    case 'ascetic':
      addWind(0.07, 300); addDrone(87.3, 0.02); addDrone(130.8, 0.008);
      scheduleBirds(0.4); scheduleBowl([174.6, 220]);
      break;
    case 'wedding':
      addWind(0.03, 300); addWedding();
      break;
    case 'sorrow':
      addWind(0.05, 220); addDrone(110, 0.02, 'sine'); addDrone(130.8, 0.014); addDrone(174.6, 0.008);
      scheduleBowl([130.8, 174.6]);
      break;
  }
}

// ---------- SFX ----------
export function sfxStep(run = false) {
  if (!ctx) return;
  const src = ctx.createBufferSource(); src.buffer = getNoise();
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = run ? 900 : 600;
  const g = ctx.createGain();
  const t = now();
  g.gain.setValueAtTime(run ? 0.09 : 0.055, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t); src.stop(t + 0.12);
}
export function sfxBlip() {
  if (!ctx) return;
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 660;
  const g = ctx.createGain(); const t = now();
  o.frequency.exponentialRampToValueAtTime(880, t + 0.07);
  g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.2);
}
export function sfxBell(freq = 320, gain = 0.22, dur = 5) { // singing bowl / temple bell
  if (!ctx) return;
  const t = now();
  for (const [ratio, amp] of [[1, 1], [2.76, 0.5], [5.4, 0.24], [8.9, 0.12]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * amp, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur / Math.sqrt(ratio));
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.5);
  }
}
export function sfxChime() { sfxBell(880 + Math.random() * 300, 0.06, 2.2); }
export function sfxDrum(freq = 70, gain = 0.3) {
  if (!ctx) return;
  const o = ctx.createOscillator(); o.type = 'sine';
  const g = ctx.createGain(); const t = now();
  o.frequency.setValueAtTime(freq * 2.2, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.09);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.6);
  const src = ctx.createBufferSource(); src.buffer = getNoise();
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(gain * 0.4, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(f); f.connect(g2); g2.connect(sfxBus); src.start(t); src.stop(t + 0.2);
}
export function sfxWhoosh() {
  if (!ctx) return;
  const src = ctx.createBufferSource(); src.buffer = getNoise();
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5;
  const g = ctx.createGain(); const t = now();
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.35);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 0.5);
}
export function sfxSparkle() { // projectile turning to flowers
  if (!ctx) return;
  const t = now();
  for (let i = 0; i < 4; i++) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = 900 + Math.random() * 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + i * 0.03);
    g.gain.linearRampToValueAtTime(0.035, t + i * 0.03 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, t + i * 0.03 + 0.7);
    o.connect(g); g.connect(sfxBus); o.start(t + i * 0.03); o.stop(t + i * 0.03 + 0.8);
  }
}
export function sfxSwell(dur = 6) { // rising chord pad: voices enter one by one, no glissando
  if (!ctx) return;
  const t = now();
  [130.8, 164.8, 196, 261.6, 329.6, 392].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.45);
    g.gain.linearRampToValueAtTime(0.05, t + i * 0.45 + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.2);
  });
  sfxBell(196, 0.2, 9);
}
export function sfxTwinkle(n = 10, dur = 1.6) { // pentatonic sparkle, like gathering light
  if (!ctx) return;
  const t = now();
  const scale = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349.3, 2637];
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = scale[(Math.random() * scale.length) | 0];
    const g = ctx.createGain();
    const at = t + (i / n) * dur + Math.random() * 0.05;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.055, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0006, at + 0.5);
    o.connect(g); g.connect(sfxBus); o.start(at); o.stop(at + 0.6);
  }
}
export function sfxHorse() {
  if (!ctx) return; // soft muffled clop
  const t = now();
  for (const dt of [0, 0.28]) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(160, t + dt);
    o.frequency.exponentialRampToValueAtTime(90, t + dt + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t + dt); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.1);
    o.connect(g); g.connect(sfxBus); o.start(t + dt); o.stop(t + dt + 0.15);
  }
}
// play a provided audio file (the few hand-picked stingers)
export function sfxFile(path, vol = 0.65) {
  const a = new Audio(path);
  a.volume = vol;
  a.play().catch(() => {});
}
export function duckAmbient(v, dur = 1) {
  if (!ctx) return;
  ambBus.gain.linearRampToValueAtTime(v, now() + dur);
}
