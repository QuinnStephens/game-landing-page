// Tiny Web Audio sound effects, no files needed.
let ctx = null;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* no audio, no problem */ }
}

['keydown', 'pointerdown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlockAudio));

function tone({ type = 'square', from = 440, to = from, dur = 0.15, vol = 0.15, delay = 0 }) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.3, vol = 0.2, delay = 0, freq = 800 }) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

export const sfx = {
  jump: () => tone({ from: 300, to: 700, dur: 0.16, vol: 0.1 }),
  stomp: () => { tone({ type: 'triangle', from: 500, to: 120, dur: 0.18, vol: 0.25 }); noise({ dur: 0.1, vol: 0.15 }); },
  ouch: () => { tone({ type: 'sawtooth', from: 600, to: 150, dur: 0.5, vol: 0.15 }); tone({ type: 'square', from: 300, to: 90, dur: 0.6, vol: 0.08, delay: 0.1 }); },
  flag: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.18, vol: 0.18, delay: i * 0.11 })),
  rocket: () => { noise({ dur: 2.5, vol: 0.3, freq: 400 }); tone({ type: 'sawtooth', from: 60, to: 300, dur: 2.5, vol: 0.06 }); },
  land: () => noise({ dur: 0.5, vol: 0.2, freq: 300 }),
  bump: (n = 0) => tone({ type: 'triangle', from: 330 + n * 70, to: 500 + n * 90, dur: 0.12, vol: 0.18 }),
  boing: () => tone({ type: 'sine', from: 200, to: 600, dur: 0.2, vol: 0.2 }),
  theEnd: () => [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.22, vol: 0.16, delay: i * 0.14 })),
};
