// Tiny synthesized sound kit: no audio assets, everything is generated with
// WebAudio so the static build stays small. Safe to call before any user
// gesture; sounds simply do not play until the context can be resumed.
import type { Event } from './game';

const KEY = 'polar-bbq-muted';
let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked */ }

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function isMuted() { return muted; }
export function setMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* storage blocked */ }
}
/** Call from a click handler so browsers allow audio for the session. */
export function unlock() { context(); }

type Wave = OscillatorType;
function tone(c: AudioContext, freq: number, start: number, length: number, gain = .18, wave: Wave = 'sine', slide = 0) {
  const osc = c.createOscillator(); const amp = c.createGain();
  osc.type = wave; osc.frequency.setValueAtTime(freq, start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), start + length);
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + .012);
  amp.gain.exponentialRampToValueAtTime(.0001, start + length);
  osc.connect(amp).connect(c.destination);
  osc.start(start); osc.stop(start + length + .02);
}
function noise(c: AudioContext, start: number, length: number, gain = .12, cutoff = 2400) {
  const frames = Math.floor(c.sampleRate * length);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource(); src.buffer = buffer;
  const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = cutoff; filter.Q.value = .8;
  const amp = c.createGain(); amp.gain.value = gain;
  src.connect(filter).connect(amp).connect(c.destination);
  src.start(start);
}

export function play(kind: Event['kind']) {
  if (muted) return;
  const c = context(); if (!c || c.state !== 'running') return;
  const t = c.currentTime;
  switch (kind) {
    case 'start': [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + i * .09, .22, .14, 'triangle')); break;
    case 'place': noise(c, t, .28, .16, 3200); tone(c, 180, t, .12, .05, 'sawtooth', -60); break;
    case 'ready': tone(c, 1245, t, .16, .12, 'sine'); tone(c, 1661, t + .1, .28, .12, 'sine'); break;
    case 'collect': tone(c, 660, t, .09, .1, 'triangle'); tone(c, 880, t + .07, .14, .1, 'triangle'); break;
    case 'serve': [880, 1175, 1568].forEach((f, i) => tone(c, f, t + i * .06, .18, .12, 'square')); break;
    case 'combo': [784, 988, 1175, 1568, 2093].forEach((f, i) => tone(c, f, t + i * .05, .2, .1, 'triangle')); break;
    case 'burn': tone(c, 160, t, .35, .14, 'sawtooth', -90); noise(c, t, .25, .08, 900); break;
    case 'miss': tone(c, 440, t, .18, .1, 'triangle'); tone(c, 330, t + .16, .3, .1, 'triangle'); break;
    case 'over': [784, 659, 523, 392].forEach((f, i) => tone(c, f, t + i * .14, .3, .12, 'triangle')); break;
  }
}
