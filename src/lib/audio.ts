let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxEnabled = true;
let musicEnabled = true;

// Music state
let currentDrone: OscillatorNode | null = null;
let currentDroneGain: GainNode | null = null;
let noiseSource: AudioBufferSourceNode | null = null;
let noiseGain: GainNode | null = null;
let melodyInterval: ReturnType<typeof setTimeout> | null = null;
let rhythmInterval: ReturnType<typeof setTimeout> | null = null;
let currentMusicState = 'none';

function getCtx(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.6;
      sfxGain.connect(masterGain);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.3;
      musicGain.connect(masterGain);
    } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function initAudio() { getCtx(); }

export function setMasterVolume(v: number) { if (masterGain) masterGain.gain.value = v; }
export function setSfxEnabled(e: boolean) { sfxEnabled = e; if (sfxGain) sfxGain.gain.value = e ? 0.6 : 0; }
export function setMusicEnabled(e: boolean) {
  musicEnabled = e;
  if (musicGain) musicGain.gain.value = e ? 0.3 : 0;
  if (!e) stopMusic();
}
export function setSfxVolume(v: number) { if (sfxGain) sfxGain.gain.value = sfxEnabled ? v : 0; }
export function setMusicVolume(v: number) { if (musicGain) musicGain.gain.value = musicEnabled ? v : 0; }

// SFX
function playSfx(freq: number, type: OscillatorType, duration: number, vol = 0.3, freqEnd?: number) {
  const c = getCtx();
  if (!c || !sfxGain || !sfxEnabled) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  o.connect(g).connect(sfxGain);
  o.start(); o.stop(c.currentTime + duration);
}

function playNoiseSfx(duration: number, vol = 0.2, filterFreq = 1000) {
  const c = getCtx();
  if (!c || !sfxGain || !sfxEnabled) return;
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  src.connect(filter).connect(g).connect(sfxGain);
  src.start(); src.stop(c.currentTime + duration);
}

export function sfxHit() { playSfx(200, 'sawtooth', 0.15, 0.4, 80); playNoiseSfx(0.08, 0.3, 2000); }
export function sfxMagic() { playSfx(600, 'sine', 0.4, 0.3, 1200); playSfx(800, 'triangle', 0.3, 0.15, 400); }
export function sfxDamage() { playSfx(150, 'square', 0.2, 0.35, 60); playNoiseSfx(0.1, 0.25, 3000); }
export function sfxHeal() { playSfx(400, 'sine', 0.3, 0.25, 800); playSfx(600, 'sine', 0.25, 0.15, 900); }
export function sfxLevelUp() { playSfx(400, 'triangle', 0.15, 0.3); setTimeout(() => playSfx(500, 'triangle', 0.15, 0.3), 100); setTimeout(() => playSfx(600, 'triangle', 0.3, 0.3), 200); }
export function sfxDeath() { playSfx(200, 'sawtooth', 1.5, 0.4, 30); }
export function sfxBossWarning() { playSfx(80, 'square', 0.5, 0.5, 40); setTimeout(() => playSfx(80, 'square', 0.5, 0.5, 40), 600); }
export function sfxEat() { playNoiseSfx(0.15, 0.2, 800); setTimeout(() => playNoiseSfx(0.1, 0.15, 600), 100); }
export function sfxSwap() { playSfx(300, 'triangle', 0.1, 0.2, 500); }
export function sfxAmbush() { playSfx(100, 'sawtooth', 0.3, 0.5, 400); playNoiseSfx(0.2, 0.3, 4000); }
export function sfxObserve() { playSfx(800, 'sine', 0.5, 0.15, 400); }
export function sfxMeditate() { playSfx(200, 'sine', 1.0, 0.1, 200); playSfx(300, 'sine', 1.0, 0.08, 300); }
export function sfxClick() { playSfx(1000, 'square', 0.03, 0.15); }
export function sfxTypewriter() { playNoiseSfx(0.02, 0.08, 5000); }

// MUSIC ENGINE
const SCALE = [261.63, 311.13, 349.23, 392.00, 466.16]; // C minor pentatonic
const DARK_SCALE = [261.63, 293.66, 311.13, 369.99, 415.30]; // diminished-ish

function createDrone(freq: number, vol: number) {
  const c = getCtx();
  if (!c || !musicGain) return;
  if (currentDrone) { try { currentDrone.stop(); } catch {} }
  if (currentDroneGain) { currentDroneGain.disconnect(); }

  const o = c.createOscillator();
  const g = c.createGain();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();

  o.type = 'sine';
  o.frequency.value = freq;
  lfo.type = 'sine';
  lfo.frequency.value = 0.15;
  lfoGain.gain.value = freq * 0.03;
  lfo.connect(lfoGain).connect(o.frequency);

  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + 2);
  o.connect(g).connect(musicGain);
  o.start(); lfo.start();
  currentDrone = o;
  currentDroneGain = g;
}

function createNoiseBed(vol: number) {
  const c = getCtx();
  if (!c || !musicGain) return;
  if (noiseSource) { try { noiseSource.stop(); } catch {} }
  if (noiseGain) noiseGain.disconnect();

  const bufferSize = c.sampleRate * 4;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(filter).connect(g).connect(musicGain);
  src.start();
  noiseSource = src;
  noiseGain = g;
}

function playMelodyNote(scale: number[], vol: number, wavetype: OscillatorType = 'triangle') {
  const c = getCtx();
  if (!c || !musicGain || !musicEnabled) return;
  const freq = scale[Math.floor(Math.random() * scale.length)] * (Math.random() > 0.5 ? 1 : 0.5);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = wavetype;
  o.frequency.value = freq;
  const now = c.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.1);
  g.gain.setValueAtTime(vol * 0.7, now + 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  // Add delay effect
  const delay = c.createDelay();
  delay.delayTime.value = 0.6;
  const fb = c.createGain();
  fb.gain.value = 0.3;
  o.connect(g).connect(musicGain);
  g.connect(delay).connect(fb).connect(delay);
  delay.connect(musicGain);
  o.start();
  o.stop(now + 2);
}

function startMelodyLoop(interval: number, scale: number[], vol: number, wave: OscillatorType = 'triangle') {
  if (melodyInterval) clearInterval(melodyInterval);
  melodyInterval = setInterval(() => {
    if (musicEnabled && Math.random() > 0.3) playMelodyNote(scale, vol, wave);
  }, interval);
}

function startRhythm(bpm: number, vol: number) {
  if (rhythmInterval) clearInterval(rhythmInterval);
  const interval = 60000 / bpm;
  rhythmInterval = setInterval(() => {
    if (!musicEnabled) return;
    const c = getCtx();
    if (!c || !musicGain) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = 55;
    const now = c.currentTime;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    o.connect(g).connect(musicGain);
    o.start();
    o.stop(now + 0.3);
  }, interval);
}

function stopMelody() { if (melodyInterval) { clearInterval(melodyInterval); melodyInterval = null; } }
function stopRhythm() { if (rhythmInterval) { clearInterval(rhythmInterval); rhythmInterval = null; } }

export function stopMusic() {
  if (currentDrone) { try { currentDrone.stop(); } catch {} currentDrone = null; }
  if (currentDroneGain) { currentDroneGain.disconnect(); currentDroneGain = null; }
  if (noiseSource) { try { noiseSource.stop(); } catch {} noiseSource = null; }
  if (noiseGain) { noiseGain.disconnect(); noiseGain = null; }
  stopMelody();
  stopRhythm();
  currentMusicState = 'none';
}

// Pause/resume on visibility change (prevents scary sounds when phone sleeps)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (ctx && ctx.state === 'running') ctx.suspend();
    } else {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    }
  });
}

export function setMusicState(state: string) {
  if (state === currentMusicState || !musicEnabled) return;
  stopMusic();
  currentMusicState = state;

  switch (state) {
    case 'menu':
      createDrone(50, 0.08);
      createNoiseBed(0.02);
      startMelodyLoop(4000, SCALE, 0.06);
      break;
    case 'explore':
      createDrone(45, 0.1);
      createNoiseBed(0.03);
      startMelodyLoop(3000, DARK_SCALE, 0.05, 'triangle');
      break;
    case 'combat':
      createDrone(40, 0.12);
      createNoiseBed(0.04);
      startMelodyLoop(1500, DARK_SCALE, 0.08, 'square');
      startRhythm(70, 0.15);
      break;
    case 'boss':
      createDrone(35, 0.15);
      createNoiseBed(0.06);
      startMelodyLoop(1000, DARK_SCALE, 0.1, 'square');
      startRhythm(90, 0.2);
      break;
    case 'rest':
      createDrone(55, 0.05);
      startMelodyLoop(6000, SCALE, 0.03);
      break;
    case 'death':
      createDrone(30, 0.1);
      if (currentDroneGain) {
        const c = getCtx();
        if (c) currentDroneGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 3);
      }
      break;
    case 'victory':
      createDrone(65, 0.08);
      startMelodyLoop(2000, [261.63, 329.63, 392.00, 523.25], 0.08, 'triangle');
      break;
  }
}
