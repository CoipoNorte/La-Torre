// Text-to-Speech narrator using Web Speech API
let enabled = false;
let volume = 0.8;
let rate = 0.85;
let voicePref: 'male' | 'female' = 'female';
let selectedVoiceIdx = -1; // -1 = auto, >=0 = specific voice

export function setNarratorEnabled(e: boolean) { enabled = e; if (!e) stopNarrator(); }
export function setNarratorVolume(v: number) { volume = v; }
export function setNarratorRate(r: number) { rate = r; }
export function setNarratorVoice(v: 'male' | 'female') { voicePref = v; }
export function setNarratorVoiceIdx(idx: number) { selectedVoiceIdx = idx; }

export function getAvailableVoices(): { name: string; lang: string; idx: number }[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const all = window.speechSynthesis.getVoices();
  // Spanish voices only; if none, fallback to all
  const esVoices = all.filter(v => v.lang.startsWith('es'));
  const pool = esVoices.length > 0 ? esVoices : all;
  return pool.map((v, i) => ({ name: v.name.replace(/Microsoft |Google /g, ''), lang: v.lang, idx: i }));
}

function getVoice(): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) return null;
  const allVoices = window.speechSynthesis.getVoices();
  const filtered = allVoices.filter(v => v.lang.startsWith('es') || v.lang.startsWith('en'));

  // If specific voice selected
  if (selectedVoiceIdx >= 0 && filtered[selectedVoiceIdx]) return filtered[selectedVoiceIdx];

  // Auto-select by gender preference
  const esVoices = allVoices.filter(v => v.lang.startsWith('es'));
  if (esVoices.length > 0) {
    const genderHint = voicePref === 'female'
      ? /female|femenin|mujer|monica|lucia|elena|paulina/i
      : /male|masculin|hombre|jorge|carlos|diego|andres/i;
    const matched = esVoices.find(v => genderHint.test(v.name));
    if (matched) return matched;
    return esVoices[0];
  }
  return allVoices[0] || null;
}

export function speak(text: string) {
  if (!enabled || !window.speechSynthesis || !text) return;
  stopNarrator();
  const u = new SpeechSynthesisUtterance(text);
  u.volume = volume;
  u.rate = rate;
  u.pitch = voicePref === 'female' ? 1.05 : 0.85;
  u.lang = 'es-ES';
  const voice = getVoice();
  if (voice) { u.voice = voice; u.lang = voice.lang; }
  window.speechSynthesis.speak(u);
}

export function stopNarrator() {
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

// Preload voices
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => { /* voices loaded */ };
}
