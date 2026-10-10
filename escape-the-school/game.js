// Escape the School: pick a girl, go to class, and try to sneak out while the
// teacher writes 1000 tests on the chalkboard.
// Plain canvas 2D, no libraries. The characters, cart, lockers and door are cut
// out of Mezzie's drawing (assets/); the hallway and classroom are drawn in
// code with wobbly pencil lines to match.
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Canvas and scaling. The game is laid out in a 720-tall space; the width
  // follows the screen's shape (1280 on a 16:9 screen, 1152 on the Steam Deck).
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const H = 720;
  let W = 1280, scale = 1, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ww = innerWidth, wh = innerHeight;
    W = Math.round(Math.max(960, Math.min(1700, H * ww / wh)));
    scale = Math.min(ww / W, wh / H);
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    canvas.style.width = W * scale + 'px';
    canvas.style.height = H * scale + 'px';
    canvas.style.marginLeft = (ww - W * scale) / 2 + 'px';
    canvas.style.marginTop = (wh - H * scale) / 2 + 'px';
  }
  addEventListener('resize', resize);
  resize();

  const FONT = '"Comic Sans MS", "Chalkboard SE", "Comic Neue", "Marker Felt", cursive, sans-serif';
  const font = (px, weight = 'bold') => `${weight} ${px}px ${FONT}`;
  const INK = '#151515';

  // ---------------------------------------------------------------------------
  // Art
  const IMG = {};
  const ART = ['girl1', 'girl2', 'teacher', 'teacher-back', 'janitor', 'cart', 'lockers', 'sleeper', 'student', 'door'];
  function loadImage(src) {
    return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  }
  const loading = Promise.all(ART.map((n) => loadImage(`assets/${n}.png`).then((i) => { IMG[n] = i; })));

  let save = { sound: true };
  try { const s = JSON.parse(localStorage.getItem('escape-school-v1')); if (s) save = { ...save, ...s }; } catch { /* none */ }
  function writeSave() { try { localStorage.setItem('escape-school-v1', JSON.stringify(save)); } catch { /* ignore */ } }

  // ---------------------------------------------------------------------------
  // Input: keyboard and gamepads, mapped to actions. The last thing the player
  // touched decides which button pictures the prompts show.
  const KEYS = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    confirm: ['KeyE', 'Enter', 'Space'], back: ['Backspace'], pause: ['Escape'], fullscreen: ['KeyF'],
  };
  const KEY_LABEL = { confirm: 'E', back: 'Esc', pause: 'Esc', fullscreen: 'F' };
  // Standard gamepad layout: 0 bottom, 1 right, 2 left, 3 top face button, 9 start.
  const PAD = { left: [14], right: [15], up: [12], down: [13], confirm: [0], back: [1], pause: [9], fullscreen: [3] };
  const PAD_FACE = { confirm: 'south', back: 'east', fullscreen: 'north', pause: 'start' };

  const keysDown = new Set();
  const keysHit = new Set();
  let device = 'keyboard'; // 'keyboard' | 'xbox' | 'ps' | 'nintendo' | 'deck'
  const held = {}, prevHeld = {};
  let moveX = 0, moveY = 0;

  function padFamily(id) {
    if (/054c|playstation|dualshock|dualsense|wireless controller/i.test(id)) return 'ps';
    if (/057e|nintendo|switch|pro controller|joy-con/i.test(id)) return 'nintendo';
    if (/28de|valve|steam/i.test(id)) return 'deck';
    return 'xbox';
  }

  addEventListener('keydown', (e) => {
    if (!keysDown.has(e.code)) keysHit.add(e.code);
    keysDown.add(e.code);
    device = 'keyboard';
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace'].includes(e.code)) e.preventDefault();
    unlockAudio();
  });
  addEventListener('keyup', (e) => keysDown.delete(e.code));
  addEventListener('blur', () => keysDown.clear());

  let tapped = false;
  canvas.addEventListener('pointerdown', () => { tapped = true; unlockAudio(); });

  function pollInput() {
    const padHeld = {};
    let ax = 0, ay = 0;
    for (const gp of navigator.getGamepads ? navigator.getGamepads() : []) {
      if (!gp || !gp.connected) continue;
      const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
      let used = false;
      for (const a in PAD) for (const i of PAD[a]) if (b(i)) { padHeld[a] = true; used = true; }
      const sx = gp.axes[0] || 0, sy = gp.axes[1] || 0;
      if (Math.abs(sx) > 0.25) { ax += sx; used = true; }
      if (Math.abs(sy) > 0.25) { ay += sy; used = true; }
      if (sx < -0.5) padHeld.left = true;
      if (sx > 0.5) padHeld.right = true;
      if (sy < -0.5) padHeld.up = true;
      if (sy > 0.5) padHeld.down = true;
      if (used) { device = padFamily(gp.id); unlockAudio(); }
    }
    for (const a in KEYS) {
      prevHeld[a] = held[a];
      held[a] = !!padHeld[a] || KEYS[a].some((k) => keysDown.has(k));
    }
    // Keys that went down and up again within one frame still count as a press.
    for (const a in KEYS) if (KEYS[a].some((k) => keysHit.has(k))) prevHeld[a] = false, held[a] = true;
    if (tapped) { prevHeld.confirm = false; held.confirm = true; tapped = false; }
    moveX = Math.max(-1, Math.min(1, ax + (held.right ? 1 : 0) - (held.left ? 1 : 0)));
    moveY = Math.max(-1, Math.min(1, ay + (held.down ? 1 : 0) - (held.up ? 1 : 0)));
    keysHit.clear();
  }
  const hit = (a) => held[a] && !prevHeld[a];

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else {
        const p = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        if (p && p.catch) p.catch(() => {});
      }
    } catch { /* not allowed here */ }
  }

  // ---------------------------------------------------------------------------
  // Sound: tiny synth noises, no files.
  let ac = null;
  function unlockAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; }
  }
  function tone(freq, dur, type = 'square', vol = 0.08, slideTo = 0, delay = 0) {
    if (!ac || !save.sound) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
  }
  function noise(dur, vol = 0.2, filterFreq = 3000, type = 'highpass') {
    if (!ac || !save.sound) return;
    const t = ac.currentTime, n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf; f.type = type; f.frequency.value = filterFreq; g.gain.value = vol;
    s.connect(f).connect(g).connect(ac.destination); s.start(t);
  }
  const sfx = {
    move() { tone(660, 0.05, 'triangle', 0.06); },
    blip() { tone(520 + Math.random() * 120, 0.04, 'square', 0.03); },
    ok() { tone(660, 0.08, 'triangle', 0.1); tone(990, 0.12, 'triangle', 0.1, 0, 0.07); },
    step() { noise(0.03, 0.05, 900, 'lowpass'); },
    chalk() { noise(0.09, 0.05, 5000); },
    door() { tone(300, 0.15, 'triangle', 0.08, 500); },
    gasp() { tone(500, 0.25, 'square', 0.07, 900); },
    spin() { tone(300, 0.2, 'sawtooth', 0.06, 900); },
    caught() { tone(400, 0.2, 'square', 0.07); tone(300, 0.2, 'square', 0.07, 0, 0.18); tone(200, 0.4, 'square', 0.07, 0, 0.36); },
    hide() { tone(250, 0.1, 'triangle', 0.1, 120); noise(0.1, 0.08, 1200, 'lowpass'); },
    snore() { tone(110, 0.6, 'sine', 0.05, 160); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, 0, i * 0.13)); },
    locked() { tone(160, 0.08, 'square', 0.08); tone(160, 0.08, 'square', 0.08, 0, 0.12); },
  };

  // ---------------------------------------------------------------------------
  // Little helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function wrap(c, text, maxW) {
    const out = [];
    for (const para of text.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (c.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Pencil drawing. A Sketch is a list of wobbly strokes made once (with a fixed
  // random seed, so they don't jitter) and stroked every frame. This is how the
  // hallway and the classroom are drawn, to look like her black-and-white art.
  class Sketch {
    constructor(seed) { this.r = rng(seed); this.strokes = []; this.fills = []; }
    // A wobbly line that overshoots its ends a little, like a quick pencil line.
    line(x1, y1, x2, y2, w = 4, color = INK) {
      const r = this.r, len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len, nx = -uy, ny = ux;
      const o1 = (r() - 0.3) * Math.min(8, len * 0.05), o2 = (r() - 0.3) * Math.min(8, len * 0.05);
      const ax = x1 - ux * o1, ay = y1 - uy * o1, bx = x2 + ux * o2, by = y2 + uy * o2;
      const n = Math.max(2, Math.ceil(len / 28)), jit = Math.min(2.2, len * 0.02), bend = (r() - 0.5) * Math.min(6, len * 0.012);
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, j = (i === 0 || i === n ? 0.3 : 1) * (r() - 0.5) * jit + Math.sin(t * Math.PI) * bend;
        pts.push([lerp(ax, bx, t) + nx * j, lerp(ay, by, t) + ny * j]);
      }
      this.add(pts, w, color);
      return this;
    }
    poly(points, closed = true, w = 4, color = INK) {
      for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        this.line(a[0], a[1], b[0], b[1], w, color);
      }
      return this;
    }
    rect(x, y, w, h, lw = 4, color = INK) { return this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, lw, color); }
    // A white (or grey) area under the lines, so things in front cover what's behind.
    fill(x, y, w, h, color = '#fff') { this.fills.push({ x, y, w, h, color }); return this; }
    circle(cx, cy, rad, w = 4, color = INK, ry = rad) {
      const r = this.r, n = Math.max(10, Math.ceil(rad / 4)), start = r() * 7, pts = [];
      for (let i = 0; i <= n + 1; i++) {
        const a = start + (i / n) * Math.PI * 2, k = 1 + (r() - 0.5) * 0.06;
        pts.push([cx + Math.cos(a) * rad * k, cy + Math.sin(a) * ry * k]);
      }
      this.add(pts, w, color);
      return this;
    }
    // Diagonal shading lines inside a box, like her scribbled hair.
    hatch(x, y, w, h, gap = 14, lw = 2, color = '#555') {
      for (let d = -h; d < w; d += gap) {
        const x1 = x + Math.max(0, d), y1 = y + Math.max(0, -d);
        const x2 = x + Math.min(w, d + h), y2 = y + Math.min(h, h - (d + h - Math.min(w, d + h)));
        if (x2 - x1 > 4) this.line(x1, y1 + 0, x2, y1 + (x2 - x1), lw, color);
      }
      return this;
    }
    text(str, x, y, size, color = INK, align = 'center', rot = 0) { this.fills.push({ str, x, y, size, color, align, rot }); return this; }
    add(pts, w, color) {
      let x0 = Infinity, x1 = -Infinity;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
      this.strokes.push({ pts, w, color, x0: x0 - w, x1: x1 + w });
    }
    draw(c, viewX0 = -Infinity, viewX1 = Infinity) {
      c.save();
      for (const f of this.fills) {
        if (f.str) {
          c.save(); c.translate(f.x, f.y); c.rotate(f.rot);
          c.font = font(f.size); c.fillStyle = f.color; c.textAlign = f.align; c.textBaseline = 'middle';
          c.fillText(f.str, 0, 0); c.restore();
        } else if (f.x + f.w > viewX0 && f.x < viewX1) { c.fillStyle = f.color; c.fillRect(f.x, f.y, f.w, f.h); }
      }
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const s of this.strokes) {
        if (s.x1 < viewX0 || s.x0 > viewX1) continue;
        c.strokeStyle = s.color; c.lineWidth = s.w;
        const p = s.pts;
        c.beginPath(); c.moveTo(p[0][0], p[0][1]);
        for (let i = 1; i < p.length - 1; i++) c.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
        c.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
        c.stroke();
      }
      c.restore();
    }
  }

  // Draws one of her cut-out drawings standing with its feet at (x, feetY).
  function drawSprite(c, img, x, feetY, h, { flip = false, bob = 0, tilt = 0, alpha = 1, sx = 1 } = {}) {
    if (!img) return;
    const w = img.width * h / img.height;
    c.save();
    c.globalAlpha *= alpha;
    c.translate(x, feetY - bob);
    c.rotate(tilt);
    c.scale((flip ? -1 : 1) * sx, 1);
    c.drawImage(img, -w / 2, -h, w, h);
    c.restore();
  }
  // A hand-drawn highlight ring, pulsing, for "go here".
  function drawRing(c, x, y, rx, ry, t) {
    const k = 1 + Math.sin(t * 5) * 0.06;
    c.save(); c.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass ? '#fff' : INK; c.lineWidth = pass ? 3 : 9;
      c.setLineDash([18, 12]); c.lineDashOffset = -t * 40;
      c.beginPath(); c.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Button pictures. Each action is drawn as the button on whatever the player
  // last used: keyboard keys, Xbox, PlayStation, Nintendo or Steam Deck.
  const FACE = {
    xbox: { south: ['A', '#3cb043'], east: ['B', '#e53935'], west: ['X', '#1e88e5'], north: ['Y', '#fbc02d'] },
    deck: { south: ['A', '#fff'], east: ['B', '#fff'], west: ['X', '#fff'], north: ['Y', '#fff'] },
    nintendo: { south: ['B', '#fff'], east: ['A', '#fff'], west: ['Y', '#fff'], north: ['X', '#fff'] },
    ps: { south: ['cross', '#7cb2e8'], east: ['circle', '#ff6666'], west: ['square', '#e88ad8'], north: ['triangle', '#40e0b0'] },
  };
  const START = { xbox: 'menu', deck: 'menu', nintendo: '+', ps: 'OPTIONS' };

  function keyCap(c, label, x, y, size) {
    c.font = font(size * 0.42);
    const w = Math.max(size, c.measureText(label).width + 18);
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 3;
    roundRect(c, x, y - size / 2, w, size, 7); c.fill(); c.stroke();
    c.fillStyle = INK; c.fillRect(x + 4, y + size / 2 - 2, w - 8, 2);
    c.fillText(label, x + w / 2, y);
    return w;
  }
  // Returns the width drawn. (x, y) is the left middle.
  function drawButton(c, action, x, y, size = 34) {
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const r = size / 2;
    if (device === 'keyboard') {
      if (action === 'move') {
        let w = 0;
        for (const k of ['←', '↑', '↓', '→']) w += keyCap(c, k, x + w, y, size) + 3;
        c.restore(); return w - 3;
      }
      if (action === 'leftright') {
        let w = 0;
        for (const k of ['←', '→']) w += keyCap(c, k, x + w, y, size) + 3;
        c.restore(); return w - 3;
      }
      const w = keyCap(c, KEY_LABEL[action] || '?', x, y, size);
      c.restore(); return w;
    }
    if (action === 'move' || action === 'leftright') {
      c.fillStyle = '#333'; c.beginPath(); c.arc(x + r, y, r, 0, 7); c.fill();
      c.fillStyle = '#666'; c.beginPath(); c.arc(x + r, y, r * 0.62, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = font(size * 0.4); c.fillText('L', x + r, y + 1);
      c.restore(); return size;
    }
    if (action === 'pause') {
      const label = START[device];
      c.font = font(size * 0.36);
      const w = label === 'menu' ? size * 1.1 : Math.max(size * 1.1, c.measureText(label).width + 16);
      c.fillStyle = '#333'; roundRect(c, x, y - size * 0.32, w, size * 0.64, size * 0.32); c.fill();
      c.fillStyle = '#fff';
      if (label === 'menu') for (let i = -1; i <= 1; i++) c.fillRect(x + w * 0.3, y + i * size * 0.13 - 1.5, w * 0.4, 3);
      else c.fillText(label, x + w / 2, y + 1);
      c.restore(); return w;
    }
    const [label, color] = FACE[device][PAD_FACE[action]];
    c.fillStyle = device === 'nintendo' ? '#3a3a3a' : '#222';
    c.beginPath(); c.arc(x + r, y, r, 0, 7); c.fill();
    if (device === 'ps') {
      c.strokeStyle = color; c.lineWidth = size * 0.09; c.lineCap = 'round';
      const s = r * 0.42, cx = x + r;
      c.beginPath();
      if (label === 'cross') { c.moveTo(cx - s, y - s); c.lineTo(cx + s, y + s); c.moveTo(cx + s, y - s); c.lineTo(cx - s, y + s); }
      if (label === 'circle') c.arc(cx, y, s, 0, 7);
      if (label === 'square') c.rect(cx - s, y - s, s * 2, s * 2);
      if (label === 'triangle') { c.moveTo(cx, y - s * 1.1); c.lineTo(cx + s * 1.1, y + s * 0.8); c.lineTo(cx - s * 1.1, y + s * 0.8); c.closePath(); }
      c.stroke();
    } else {
      c.fillStyle = color; c.font = font(size * 0.55); c.fillText(label, x + r, y + 1);
    }
    c.restore(); return size;
  }
  const measureCanvas = document.createElement('canvas').getContext('2d');
  function measureButton(a, size) { return drawButton(measureCanvas, a, -9999, -9999, size); }
  // A row of [action, words] prompts. align: 'left' | 'right' | 'center'.
  function drawPrompts(c, list, x, y, align = 'left', size = 34) {
    c.save();
    c.font = font(size * 0.62);
    const widths = list.map(([a, t]) => measureButton(a, size) + 10 + c.measureText(t).width);
    const total = widths.reduce((s, w) => s + w, 0) + 28 * (list.length - 1);
    let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    list.forEach(([a, t], i) => {
      const bw = drawButton(c, a, cx, y, size);
      c.font = font(size * 0.62); c.textAlign = 'left'; c.textBaseline = 'middle';
      c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,.9)'; c.strokeText(t, cx + bw + 10, y + 1);
      c.fillStyle = INK; c.fillText(t, cx + bw + 10, y + 1);
      cx += widths[i] + 28;
    });
    c.restore();
  }
  // "Hide" with a button under it, floating over a hiding spot, like in her drawing.
  function drawHideTag(c, x, y, word, t) {
    const b = Math.sin(t * 4) * 4;
    c.save();
    c.font = font(30, 'normal'); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 7; c.strokeStyle = '#fff'; c.strokeText(word, x, y - 28 + b);
    c.fillStyle = INK; c.fillText(word, x, y - 28 + b);
    const bw = measureButton('confirm', 36);
    drawButton(c, 'confirm', x - bw / 2, y + 12 + b, 36);
    c.restore();
  }

  // Speech bubble over someone's head. (x, y) is where the tail points.
  function drawBubble(c, x, y, text, size = 26) {
    c.save();
    c.font = font(size);
    const lines = wrap(c, text, 360);
    const w = Math.max(...lines.map((l) => c.measureText(l).width)) + 36, h = lines.length * size * 1.25 + 24;
    let bx = clamp(x - w / 2, 10, W - w - 10), by = y - 24 - h;
    if (by < 8) by = 8;
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 4; c.lineJoin = 'round';
    roundRect(c, bx, by, w, h, 22); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(clamp(x - 14, bx + 20, bx + w - 40), by + h - 2); c.lineTo(x, Math.max(y, by + h + 14)); c.lineTo(clamp(x + 10, bx + 34, bx + w - 20), by + h - 2);
    c.fill(); c.stroke();
    c.fillRect(clamp(x - 12, bx + 22, bx + w - 38), by + h - 6, 22, 6);
    c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((l, i) => c.fillText(l, bx + w / 2, by + 12 + size * 0.65 + i * size * 1.25));
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Game state
  let mode = 'loading'; // loading | title | pick | hall | class | chase | won
  let paused = false, pauseSel = 0;
  let t = 0;            // seconds since the page started
  let hero = 'girl1';
  let pickSel = 0;

  // Fades to white and back, calling fn in the middle.
  let fade = 0, fadeDir = 0, fadeFn = null;
  function fadeTo(fn) { if (fadeDir) return; fadeDir = 1; fadeFn = fn; }
  function updateFade(dt) {
    if (fadeDir > 0) { fade += dt * 3.2; if (fade >= 1) { fade = 1; fadeDir = -1; const f = fadeFn; fadeFn = null; f && f(); } }
    else if (fadeDir < 0) { fade -= dt * 2.6; if (fade <= 0) { fade = 0; fadeDir = 0; } }
  }

  // Talking: a box at the bottom with pages of text, and sometimes a choice.
  let dialog = null; // { who, pages, page, shown, choices, sel, done }
  function say(who, pages, done) { dialog = { who, pages: [].concat(pages), page: 0, shown: 0, done }; }
  function ask(who, question, choices, done) { dialog = { who, pages: [question], page: 0, shown: 0, choices, sel: 0, done }; }
  function updateDialog(dt) {
    const d = dialog, text = d.pages[d.page];
    const before = Math.floor(d.shown);
    d.shown = Math.min(text.length, d.shown + dt * 45);
    if (Math.floor(d.shown) !== before && Math.floor(d.shown) % 3 === 0) sfx.blip();
    const full = d.shown >= text.length;
    if (d.choices && full) {
      if (hit('up') || hit('down')) { d.sel = 1 - d.sel; sfx.move(); }
    }
    if (hit('confirm')) {
      if (!full) { d.shown = text.length; return; }
      if (d.page < d.pages.length - 1) { d.page++; d.shown = 0; sfx.blip(); return; }
      dialog = null; sfx.ok();
      d.done && d.done(d.choices ? d.sel : undefined);
    }
  }
  function drawDialog(c) {
    const d = dialog, text = d.pages[d.page].slice(0, Math.floor(d.shown));
    const bw = Math.min(1000, W - 60), bx = (W - bw) / 2;
    const bh = d.choices ? 250 : 170, by = H - bh - 20;
    c.save();
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 5;
    roundRect(c, bx, by, bw, bh, 22); c.fill(); c.stroke();
    if (d.who) {
      c.font = font(26); const nw = c.measureText(d.who).width + 34;
      roundRect(c, bx + 26, by - 22, nw, 44, 14); c.fill(); c.stroke();
      c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d.who, bx + 26 + nw / 2, by);
    }
    c.font = font(30, 'normal'); c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'top';
    wrap(c, d.pages[d.page], bw - 70).reduce((left, line, i) => {
      c.fillText(line.slice(0, Math.max(0, left)), bx + 34, by + 34 + i * 40);
      return left - line.length - 1;
    }, text.length);
    const full = d.shown >= d.pages[d.page].length;
    if (d.choices && full) {
      d.choices.forEach((ch, i) => {
        const y = by + 120 + i * 58;
        c.font = font(30);
        if (i === d.sel) {
          c.fillStyle = '#eee'; roundRect(c, bx + 30, y - 6, c.measureText(ch).width + 80, 50, 14); c.fill();
          c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
          c.fillStyle = INK; c.fillText('▶', bx + 44, y + 4);
        }
        c.fillStyle = INK; c.fillText(ch, bx + 84, y + 4);
      });
    }
    if (full) drawPrompts(c, [['confirm', d.choices ? 'Pick' : 'OK']], bx + bw - 24, by + bh - 30, 'right', 32);
    c.restore();
  }

  // Short-lived words over someone's head.
  const barks = []; // { who, text, t, dur }
  function bark(who, text, dur = 2.2) {
    for (let i = barks.length - 1; i >= 0; i--) if (barks[i].who === who) barks.splice(i, 1);
    barks.push({ who, text, t: 0, dur });
  }

  // ---------------------------------------------------------------------------
  // Title and character pick
  function updateTitle() {
    if (hit('fullscreen')) toggleFullscreen();
    if (hit('confirm')) { sfx.ok(); mode = 'pick'; }
  }
  const titleSketch = new Sketch(7);
  {
    // Underline like her "Girl options" heading.
    titleSketch.line(330, 205, 950, 200, 5).line(360, 216, 920, 214, 3);
  }
  function drawTitle(c) {
    c.save();
    c.translate((W - 1280) / 2, 0);
    c.font = font(96, 'normal'); c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.save(); c.translate(640, 130); c.rotate(-0.02); c.fillText('Escape the School', 0, 0); c.restore();
    titleSketch.draw(c);
    drawSprite(c, IMG.teacher, 210, 690, 470, { bob: Math.abs(Math.sin(t * 1.3)) * 3 });
    drawSprite(c, IMG.girl1, 900, 680, 380, { tilt: Math.sin(t * 2) * 0.02 });
    drawSprite(c, IMG.girl2, 1080, 680, 360, { tilt: Math.sin(t * 2 + 1) * 0.02 });
    c.font = font(30, 'normal'); c.fillText('by Mezzie', 640, 250);
    c.restore();
    drawPrompts(c, [['confirm', 'Start'], ['fullscreen', 'Fullscreen']], W / 2, 600, 'center', 40);
  }

  function updatePick() {
    if (hit('left') || hit('right')) { pickSel = 1 - pickSel; sfx.move(); }
    if (hit('back')) mode = 'title';
    if (hit('confirm')) {
      hero = pickSel ? 'girl2' : 'girl1';
      sfx.ok();
      fadeTo(startHall);
    }
  }
  function drawPick(c) {
    const cx = W / 2;
    c.save();
    c.font = font(64, 'normal'); c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('Pick your girl', cx - 60, 80);
    pickSketch.draw(c);
    const xs = [cx - 260, cx + 20];
    xs.forEach((x, i) => {
      const sel = i === pickSel;
      if (sel) drawRing(c, x, 635, 130, 34, t);
      drawSprite(c, IMG[i ? 'girl2' : 'girl1'], x, 640, sel ? 450 : 410, { bob: sel ? Math.abs(Math.sin(t * 6)) * 8 : 0 });
    });
    // The janitor stands on their right, like in her drawing.
    drawSprite(c, IMG.janitor, cx + 300, 640, 380, { alpha: 0.9 });
    c.restore();
    drawPrompts(c, [['leftright', 'Choose'], ['confirm', 'Go to school']], W / 2, H - 34, 'center', 36);
  }
  const pickSketch = new Sketch(11);
  pickSketch.line(400 - 120, 120, 900 - 120, 116, 5);
  function rebuildPickSketch() {
    pickSketch.strokes = []; pickSketch.r = rng(11);
    pickSketch.line(W / 2 - 300, 122, W / 2 + 180, 118, 5);
  }

  // ---------------------------------------------------------------------------
  // The hallway, side on. One long hallway is used twice: walking to class at the
  // start, and running away from the teacher in the chase.
  const FLOOR = 640;           // where feet stand
  const HALL_W = 3800;
  const DOOR_X = 700;          // the classroom door
  const EXIT_X = 3520;         // locked doors at the end
  const JAN_HOME = 1450;       // the janitor mops here, facing the classroom
  const SPOTS = [              // hiding spots, all past the janitor
    { kind: 'cart', x: 1930, half: 150 },
    { kind: 'lockers', x: 2560, half: 130 },
    { kind: 'lockers', x: 3090, half: 130 },
  ];
  const H_GIRL = 330, H_TEACHER = 420, H_JANITOR = 380, H_LOCKERS = 440, H_CART = 250;

  const hallSketch = new Sketch(21);
  {
    const s = hallSketch;
    // Ceiling, walls, floor
    s.line(0, 46, HALL_W, 46, 5);
    s.line(0, 548, HALL_W, 548, 4);          // baseboard top
    s.line(0, 572, HALL_W, 572, 5);          // wall meets floor
    s.line(0, 330, HALL_W, 330, 3, '#444');  // stripe along the wall
    s.line(0, 344, HALL_W, 344, 3, '#444');
    for (let x = 80; x < HALL_W; x += 190) s.line(x, 572, x - 120, 720, 2.5, '#666'); // floor tiles
    s.line(0, 690, HALL_W, 690, 2.5, '#666');
    // Ceiling lights
    for (let x = 300; x < HALL_W; x += 620) {
      s.line(x - 70, 46, x - 70, 62, 3).line(x + 70, 46, x + 70, 62, 3).rect(x - 90, 62, 180, 22, 4);
      for (let i = -2; i <= 2; i++) s.line(x + i * 40, 98, x + i * 52, 116, 2.5, '#777');
    }
    // Left end of the hallway
    s.line(40, 46, 40, 572, 5).line(40, 572, 0, 720, 5).hatch(0, 46, 40, 526, 16, 2, '#888');
    // Bulletin board with drawings pinned on it
    s.rect(170, 180, 280, 170, 5);
    s.rect(190, 200, 90, 70, 3).circle(235, 230, 20, 3); // a sun
    for (let a = 0; a < 6.28; a += 0.8) s.line(235 + Math.cos(a) * 25, 230 + Math.sin(a) * 25, 235 + Math.cos(a) * 33, 230 + Math.sin(a) * 33, 2);
    s.rect(300, 196, 120, 80, 3).circle(330, 220, 10, 2.5).line(330, 230, 330, 255, 2.5).line(330, 255, 320, 270, 2.5).line(330, 255, 340, 270, 2.5); // stick person
    s.circle(380, 225, 10, 2.5).line(380, 235, 380, 255, 2.5).line(380, 255, 370, 270, 2.5).line(380, 255, 390, 270, 2.5);
    s.rect(210, 284, 200, 52, 3).text('Art Show!', 310, 311, 30, INK);
    // The classroom door: frame, dark room inside, and the door swung open
    s.fill(DOOR_X - 100, 170, 200, 402, '#fff');
    s.rect(DOOR_X - 100, 170, 200, 402, 6);
    s.hatch(DOOR_X - 92, 178, 184, 394, 12, 2.2, '#555');
    s.poly([[DOOR_X + 100, 170], [DOOR_X + 170, 196], [DOOR_X + 170, 600], [DOOR_X + 100, 572]], true, 6);
    s.rect(DOOR_X + 116, 230, 38, 90, 3).line(DOOR_X + 112, 400, DOOR_X + 122, 404, 6);
    s.rect(DOOR_X - 70, 110, 140, 44, 4).text('Room 9', DOOR_X, 133, 26, INK);
    // Water fountain
    s.rect(960, 400, 110, 60, 4).line(975, 400, 985, 380, 3).line(985, 380, 1005, 382, 3).rect(990, 460, 30, 88, 3);
    // Windows
    for (const wx of [1150, 2250]) {
      s.rect(wx, 150, 260, 160, 5).line(wx + 130, 150, wx + 130, 310, 4).line(wx, 230, wx + 260, 230, 4);
      s.line(wx + 30, 175, wx + 70, 205, 2, '#888').line(wx + 160, 255, wx + 200, 285, 2, '#888');
    }
    // A clock
    s.circle(1760, 200, 42, 5).line(1760, 200, 1760, 172, 4).line(1760, 200, 1782, 210, 4);
    // Posters
    s.rect(2900, 160, 140, 180, 4).text('READ!', 2970, 200, 30, INK).circle(2970, 270, 34, 3).line(2950, 270, 2990, 270, 3).line(2970, 236, 2970, 304, 3);
    s.rect(1600, 380, 120, 100, 4).text('No', 1660, 410, 26, INK).text('running', 1660, 446, 24, INK);
    // Locked doors at the end with an exit sign
    s.rect(EXIT_X - 130, 190, 130, 382, 6).rect(EXIT_X, 190, 130, 382, 6);
    s.rect(EXIT_X - 110, 230, 90, 110, 3).rect(EXIT_X + 20, 230, 90, 110, 3);
    s.line(EXIT_X - 110, 400, EXIT_X - 10, 400, 7).line(EXIT_X + 10, 400, EXIT_X + 110, 400, 7);
    s.rect(EXIT_X - 70, 110, 140, 50, 4).text('EXIT', EXIT_X, 136, 30, INK);
    // Chain and padlock
    for (let i = -3; i <= 3; i++) s.circle(EXIT_X + i * 18, 410 + Math.abs(i) * 4, 10, 3, INK, 7);
    s.rect(EXIT_X - 18, 432, 36, 32, 4).circle(EXIT_X, 432, 12, 4);
    // Right end
    s.line(HALL_W - 40, 46, HALL_W - 40, 572, 5).line(HALL_W - 40, 572, HALL_W, 720, 5).hatch(HALL_W - 40, 46, 40, 526, 16, 2, '#888');
  }

  // Everyone in the hallway
  const P = { x: 200, vx: 0, face: 1, walkT: 0, hidden: null, frozen: false };
  const teacherH = { x: DOOR_X, face: 1, state: 'off', timer: 0, alpha: 0, walkT: 0 };
  // The janitor always faces the classroom. He mostly looks down at his mop, but
  // every few seconds he looks up (with a "?" first as a warning), and if you're
  // in front of him and not hiding, he sees you. Behind him you're safe.
  const jan = { x: JAN_HOME, face: -1, looking: false, next: 3, warn: 0, mopT: 0, saw: false, talked: false };
  let camX = 0;
  let hallMode = 'walk'; // walk (going to class) | chase
  let chase = null;      // { state, timer, hints }

  function startHall() {
    mode = 'hall'; hallMode = 'walk';
    P.x = 180; P.face = 1; P.hidden = null; P.frozen = false;
    jan.x = JAN_HOME; jan.looking = false; jan.talked = false; jan.saw = false; jan.warn = 0;
    teacherH.state = 'off'; teacherH.alpha = 0;
    camX = 0; barks.length = 0; dialog = null;
  }
  function startChase() {
    mode = 'hall'; hallMode = 'chase';
    P.x = DOOR_X + 150; P.face = 1; P.hidden = null; P.frozen = false;
    jan.x = JAN_HOME; jan.looking = false; jan.next = 3.4; jan.warn = 0; jan.saw = false;
    teacherH.x = DOOR_X; teacherH.face = 1; teacherH.state = 'coming'; teacherH.timer = 1.9; teacherH.alpha = 0;
    chase = { state: 'run', timer: 0 };
    camX = clamp(P.x - W * 0.35, 0, HALL_W - W);
    barks.length = 0; dialog = null;
    banner('Run and hide! Only move when the janitor is looking down!', 4);
  }

  function nearSpot() {
    return SPOTS.find((s) => Math.abs(P.x - s.x) < s.half);
  }
  // The janitor sees you if he's facing you, you're close enough, and you're not hiding.
  const JAN_SIGHT = 520;
  function janitorSees() {
    if (P.hidden || !jan.looking) return false;
    const dx = P.x - jan.x;
    return dx < -10 && dx > -JAN_SIGHT;
  }

  function updateHall(dt) {
    const speed = 340;
    if (!P.frozen && !dialog && !P.hidden) {
      P.vx = moveX * speed;
      if (Math.abs(moveX) > 0.1) P.face = Math.sign(moveX);
    } else P.vx = 0;
    const before = P.x;
    P.x = clamp(P.x + P.vx * dt, 90, EXIT_X - 150);
    if (Math.abs(P.x - before) > 0.1) {
      const was = Math.floor(P.walkT * 4);
      P.walkT += dt;
      if (Math.floor(P.walkT * 4) !== was) sfx.step();
    }

    // Mopping janitor
    if (!jan.looking) jan.mopT += dt;
    camX = lerp(camX, clamp(P.x - W * 0.4, 0, HALL_W - W), Math.min(1, dt * 6));

    if (hallMode === 'walk') {
      if (!dialog) {
        if (Math.abs(P.x - DOOR_X) < 90 && hit('confirm')) { sfx.door(); fadeTo(startClass); }
        if (!jan.talked && Math.abs(P.x - jan.x) < 220) { jan.talked = true; bark('jan', 'Shouldn\'t you be in class?', 2.6); }
        if (P.x >= EXIT_X - 160 && hit('confirm')) { sfx.locked(); bark('you', 'It\'s locked. It\'s not home time yet!'); }
      }
      return;
    }

    // --- Chase ---
    const ch = chase;
    if (ch.state === 'run' || ch.state === 'hidden') {
      // Janitor looks up now and then, with a "?" first so you get a warning.
      jan.next -= dt;
      jan.warn = !jan.looking && jan.next < 0.9;
      if (jan.next <= 0) {
        jan.looking = !jan.looking;
        jan.next = jan.looking ? 1.8 + Math.random() * 0.8 : 2.6 + Math.random() * 1.6;
      }

      // Hiding
      const spot = nearSpot();
      if (hit('confirm')) {
        if (P.hidden) { P.hidden = null; sfx.hide(); }
        else if (spot) { P.hidden = spot; P.x = spot.x; sfx.hide(); }
        else if (P.x >= EXIT_X - 170) { sfx.locked(); bark('you', 'Locked! I need to hide!'); }
      }
      if (janitorSees()) {
        jan.saw = true; sfx.gasp();
        bark('jan', 'Hey! What are you doing out of class?', 3);
        caught('jan');
        return;
      }
    }
    if (ch.state === 'run' && P.hidden) ch.state = 'hidden';
    if (ch.state === 'hidden' && !P.hidden) {
      ch.state = 'run';
      if (teacherH.state === 'search' || teacherH.state === 'leaving') { teacherH.state = 'chase'; bark('teacher', 'There you are!'); }
    }

    // Teacher
    const T = teacherH;
    if (T.state === 'coming') {
      T.timer -= dt; T.alpha = clamp(1 - T.timer / 0.5, 0, 1);
      if (T.timer <= 0) { T.state = P.hidden ? 'search' : 'chase'; T.alpha = 1; bark('teacher', 'Get back here!'); }
    } else if (T.state === 'chase') {
      const dx = P.x - T.x;
      T.face = Math.sign(dx) || T.face;
      T.x += T.face * 175 * dt; T.walkT += dt;
      if (P.hidden) { T.state = 'search'; }
      else if (Math.abs(dx) < 70) { sfx.caught(); bark('teacher', 'Gotcha!', 3); caught('teacher'); return; }
    } else if (T.state === 'search') {
      // Walks over to about where you hid, looks around, then gives up.
      const target = P.hidden ? P.hidden.x - 210 * Math.sign(P.hidden.x - DOOR_X) : P.x;
      const dx = target - T.x;
      if (Math.abs(dx) > 8) { T.face = Math.sign(dx); T.x += T.face * 175 * dt; T.walkT += dt; T.timer = 0; }
      else {
        T.timer += dt;
        if (T.timer > 0.2 && T.timer - dt <= 0.2) bark('teacher', 'Hmm... where did she go?', 2.6);
        T.face = Math.floor(T.timer * 1.4) % 2 ? 1 : -1;
        if (T.timer > 3.2) { T.state = 'leaving'; bark('teacher', 'Kids these days.', 2); }
      }
    } else if (T.state === 'leaving') {
      T.face = -1; T.x -= 175 * dt; T.walkT += dt;
      if (T.x <= DOOR_X + 4) { T.state = 'gone'; T.timer = 0; sfx.door(); }
    } else if (T.state === 'gone') {
      T.alpha = Math.max(0, T.alpha - dt * 3);
      T.timer += dt;
      if (T.timer > 1.2 && ch.state !== 'won') { ch.state = 'won'; sfx.win(); setTimeout(() => fadeTo(() => { mode = 'won'; wonSel = 0; }), 1200); }
    }
  }

  // Caught in the hallway: back to class you go.
  function caught(by) {
    chase.state = 'caught';
    P.frozen = true;
    teacherH.state = 'stop';
    setTimeout(() => fadeTo(() => backToClass(by)), 2200);
  }

  function drawHall(c) {
    c.save();
    c.translate(-Math.round(camX), 0);
    hallSketch.draw(c, camX - 20, camX + W + 20);

    // Hiding spots
    for (const s of SPOTS) {
      if (s.x < camX - 300 || s.x > camX + W + 300) continue;
      if (s.kind === 'lockers') {
        drawSprite(c, IMG.lockers, s.x, FLOOR - 40, H_LOCKERS);
        if (P.hidden === s) drawPeekEyes(c, s.x + 60, FLOOR - 340);
      } else {
        if (P.hidden === s) {
          // Crouched behind the cart with just the top of her head showing.
          c.save(); c.beginPath(); c.rect(s.x - 200, 0, 400, FLOOR - H_CART + 70); c.clip();
          drawSprite(c, IMG[hero], s.x + 20, FLOOR + 36 + Math.sin(t * 3) * 3, H_GIRL);
          c.restore();
        }
        drawSprite(c, IMG.cart, s.x, FLOOR + 6, H_CART);
      }
    }

    // Janitor and his mop
    const jb = Math.sin(jan.mopT * 4);
    if (hallMode === 'chase' && jan.looking && chase.state !== 'won') drawSight(c);
    drawSprite(c, IMG.janitor, jan.x, FLOOR, H_JANITOR, { flip: jan.face > 0, tilt: jan.looking ? 0 : 0.06 + jb * 0.015 });
    drawMop(c, jan.x + jan.face * 36, FLOOR - 170, jan.x + jan.face * (90 + jb * 30), FLOOR + 4);
    if (hallMode === 'chase') {
      if (jan.saw) drawMark(c, jan.x, FLOOR - H_JANITOR - 30, '!');
      else if (jan.warn) drawMark(c, jan.x, FLOOR - H_JANITOR - 30, '?');
      else if (jan.looking) drawPeekEyes(c, jan.x, FLOOR - H_JANITOR - 30);
    }

    // Teacher
    const T = teacherH;
    if (T.state !== 'off' && T.alpha > 0) {
      const moving = ['chase', 'search', 'leaving'].includes(T.state);
      drawSprite(c, IMG.teacher, T.x, FLOOR + 4, H_TEACHER, {
        flip: T.face < 0, alpha: T.alpha,
        bob: moving ? Math.abs(Math.sin(T.walkT * 8)) * 8 : 0, tilt: moving ? Math.sin(T.walkT * 8) * 0.04 : 0,
      });
    }

    // You
    if (!P.hidden) {
      const walking = Math.abs(P.vx) > 1;
      drawSprite(c, IMG[hero], P.x, FLOOR, H_GIRL, {
        flip: P.face < 0, bob: walking ? Math.abs(Math.sin(P.walkT * 11)) * 10 : 0, tilt: walking ? Math.sin(P.walkT * 11) * 0.05 : 0,
      });
    }

    // Prompts in the world
    if (!dialog && !fadeDir) {
      if (hallMode === 'walk') {
        if (Math.abs(P.x - DOOR_X) < 260) drawRing(c, DOOR_X, FLOOR - 10, 120, 30, t);
        if (Math.abs(P.x - DOOR_X) < 90) drawHideTag(c, DOOR_X, FLOOR - H_GIRL - 70, 'Go in', t);
      } else if (chase.state === 'run' || chase.state === 'hidden') {
        const s = nearSpot();
        if (s) drawHideTag(c, s.x + (s.kind === 'cart' ? -40 : 0), FLOOR - (s.kind === 'cart' ? H_CART : H_LOCKERS) - 110, P.hidden ? 'Come out' : 'Hide', t);
      }
    }

    c.restore();
    // Speech, in screen space so bubbles stay on screen.
    for (const b of barks) {
      const who = b.who === 'jan' ? [jan.x, FLOOR - H_JANITOR - 10] : b.who === 'teacher' ? [T.x, FLOOR - H_TEACHER - 10]
        : [P.x, P.hidden ? FLOOR - 300 : FLOOR - H_GIRL - 10];
      drawBubble(c, who[0] - camX, who[1], b.text);
    }
  }
  // Two little eyes peeking out of the locker slits.
  function drawPeekEyes(c, x, y) {
    const look = Math.sin(t * 1.5) * 3;
    c.save(); c.fillStyle = INK;
    for (const dx of [-10, 10]) {
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x + dx, y, 8, 6, 0, 0, 7); c.fill();
      c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(x + dx + look, y, 3, 0, 7); c.fill();
    }
    c.restore();
  }
  function drawMop(c, x1, y1, x2, y2) {
    c.save(); c.strokeStyle = INK; c.lineCap = 'round';
    c.lineWidth = 5; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2 - 20); c.stroke();
    c.lineWidth = 3;
    for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(x2, y2 - 22); c.quadraticCurveTo(x2 + i * 6, y2 - 10, x2 + i * 8, y2); c.stroke(); }
    c.restore();
  }
  // Where the janitor is looking: dotted lines like her "looking" marks.
  function drawSight(c) {
    const ex = jan.x + jan.face * 20, ey = FLOOR - H_JANITOR + 70;
    const fx = jan.x + jan.face * JAN_SIGHT;
    c.save();
    c.fillStyle = jan.saw ? 'rgba(0,0,0,.14)' : 'rgba(0,0,0,.06)';
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(fx, FLOOR - 170); c.lineTo(fx, FLOOR + 30); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 3; c.setLineDash([10, 12]); c.lineDashOffset = -t * 30 * jan.face;
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(fx, FLOOR - 170); c.moveTo(ex, ey); c.lineTo(fx, FLOOR + 30); c.stroke();
    c.restore();
  }
  function drawMark(c, x, y, ch) {
    c.save(); c.font = font(64); c.textAlign = 'center'; c.textBaseline = 'middle';
    const b = Math.sin(t * 10) * 4;
    c.lineWidth = 8; c.strokeStyle = '#fff'; c.strokeText(ch, x, y + b);
    c.fillStyle = INK; c.fillText(ch, x, y + b); c.restore();
  }

  // ---------------------------------------------------------------------------
  // The classroom, seen from above like Zelda.
  const C = {};          // layout, rebuilt when the screen width changes
  const me = { x: 0, y: 0, face: 1, walkT: 0, seated: false, moving: false };
  const teach = { x: 0, y: 0, back: false, spin: 0, walkT: 0, moving: false };
  let cls = { phase: 'enter', timer: 0, asleep: false, writing: 0, prompt: false, tries: 0 };
  const H_KID = 148, H_TEACH = 180, H_TEACH_BACK = 172;

  function layoutClass() {
    if (C.W === W) return;
    C.W = W;
    C.left = 70; C.right = W - 70; C.top = 170; C.bottom = 685;
    C.board = { x: 120, y: 34, w: 470, h: 100 };
    C.teacherHome = { x: 200, y: 300 };
    C.teacherBoard = { x: 330, y: 230 };
    C.teacherDesk = { x: 290, y: 232, w: 190, h: 70 };
    const cx = Math.round((C.left + C.right) / 2 + 40);
    C.desks = [];
    for (const y of [400, 575]) for (const dx of [-210, 0, 210]) C.desks.push({ x: cx + dx, y });
    C.student = C.desks[1];
    C.seat = C.desks[2];
    C.door = { x: C.right, y: 525, half: 70 };
    C.sketch = buildClassSketch();
  }

  function deskStrokes(s, x, y) {
    // Chair behind (above) the desk, desk top, front, legs.
    s.fill(x - 26, y - 64, 52, 40).rect(x - 24, y - 66, 48, 16, 3).rect(x - 26, y - 48, 52, 24, 3);
  }
  function buildClassSketch() {
    const s = new Sketch(33);
    const { left: L, right: R, top: T, bottom: B } = C;
    // Top wall face
    s.line(30, 18, W - 30, 18, 5).line(L, T, R, T, 5);
    s.line(30, 18, L, T, 4).line(W - 30, 18, R, T, 4);
    // Side and bottom walls (thick, two lines)
    s.line(30, 18, 30, 705, 5).line(L, T, L, B, 5);
    s.line(W - 30, 18, W - 30, 705, 5);
    s.line(R, T, R, C.door.y - C.door.half, 5).line(R, C.door.y + C.door.half, R, B, 5);
    s.line(W - 30, C.door.y - C.door.half, R, C.door.y - C.door.half, 4).line(W - 30, C.door.y + C.door.half, R, C.door.y + C.door.half, 4);
    s.line(30, 705, W - 30, 705, 5).line(L, B, R, B, 5);
    s.hatch(31, 19, L - 32, 686, 14, 1.6, '#999');
    s.hatch(R + 2, 19, W - 32 - R, C.door.y - C.door.half - 20, 14, 1.6, '#999');
    s.hatch(R + 2, C.door.y + C.door.half + 2, W - 32 - R, 705 - C.door.y - C.door.half - 2, 14, 1.6, '#999');
    // Floor tiles, light
    for (let x = L + 90; x < R; x += 90) s.line(x, T + 4, x, B - 4, 1.5, '#c8c8c8');
    for (let y = T + 90; y < B; y += 90) s.line(L + 4, y, R - 4, y, 1.5, '#c8c8c8');
    // Chalkboard on the top wall
    const b = C.board;
    s.fill(b.x, b.y, b.w, b.h, '#fff').rect(b.x, b.y, b.w, b.h, 6).rect(b.x + 8, b.y + 8, b.w - 16, b.h - 16, 2.5);
    s.line(b.x - 6, b.y + b.h + 8, b.x + b.w + 6, b.y + b.h + 8, 5);
    // Clock, windows and a flag on the top wall
    s.circle(700, 80, 30, 4).line(700, 80, 700, 60, 3).line(700, 80, 715, 86, 3);
    for (let wx = 800; wx + 170 < W - 80; wx += 210) s.rect(wx, 40, 170, 90, 4).line(wx + 85, 40, wx + 85, 130, 3).line(wx, 85, wx + 170, 85, 3);
    // Teacher's desk with papers and an apple
    const d = C.teacherDesk;
    s.fill(d.x, d.y, d.w, d.h + 20).rect(d.x, d.y, d.w, d.h, 4).rect(d.x, d.y + d.h, d.w, 20, 4);
    s.rect(d.x + 20, d.y + 14, 50, 36, 2.5).rect(d.x + 30, d.y + 8, 50, 36, 2.5).circle(d.x + 150, d.y + 32, 14, 3).line(d.x + 150, d.y + 18, d.x + 154, d.y + 8, 3);
    // Bin by the door, bookshelf on the left wall
    s.rect(L + 10, 520, 50, 150, 4); for (let y = 545; y < 670; y += 28) s.line(L + 10, y, L + 60, y, 3);
    return s;
  }
  function drawDesk(c, x, y) {
    // Desk top and front, white so it covers a kid's legs.
    c.save();
    c.fillStyle = '#fff'; c.fillRect(x - 50, y - 20, 100, 58);
    c.restore();
    deskSketch(x, y).draw(c);
  }
  const deskCache = new Map();
  function deskSketch(x, y) {
    const k = x + ',' + y;
    if (!deskCache.has(k)) {
      const s = new Sketch(x * 7 + y);
      s.rect(x - 50, y - 20, 100, 42, 4).rect(x - 50, y + 22, 100, 16, 4);
      s.line(x - 44, y + 38, x - 44, y + 52, 4).line(x + 44, y + 38, x + 44, y + 52, 4);
      s.line(x - 30, y - 6, x + 10, y - 8, 2.5, '#666');
      deskCache.set(k, s);
    }
    return deskCache.get(k);
  }
  const chairCache = new Map();
  function drawChair(c, x, y) {
    const k = x + ',' + y;
    if (!chairCache.has(k)) { const s = new Sketch(x + y * 3); deskStrokes(s, x, y); chairCache.set(k, s); }
    chairCache.get(k).draw(c);
  }

  function startClass() {
    layoutClass();
    mode = 'class';
    me.x = C.right - 50; me.y = C.door.y; me.face = -1; me.seated = false;
    teach.x = C.teacherHome.x; teach.y = C.teacherHome.y; teach.back = false; teach.spin = 0;
    cls = { phase: 'enter', timer: 0, asleep: false, writing: 0, prompt: false, tries: 0 };
    barks.length = 0; dialog = null;
    setTimeout(() => { if (mode === 'class' && cls.phase === 'enter') bark('teacher', 'Come in! Take a seat.', 2.6); }, 600);
  }
  // Back to class after getting caught in the hallway.
  function backToClass(by) {
    layoutClass();
    mode = 'class';
    sitDown();
    teach.x = C.teacherBoard.x; teach.y = C.teacherBoard.y + 30; teach.back = false; teach.spin = 0;
    cls.phase = 'talk'; cls.asleep = true; cls.prompt = false; cls.tries++;
    barks.length = 0;
    const lines = by === 'jan'
      ? ['The janitor told me all about it. Back in your seat, young lady.', 'Now, where was I...']
      : ['Nice try. Back in your seat, young lady.', 'Now, where was I...'];
    say('Teacher', lines, startWriting);
  }
  function sitDown() { me.seated = true; me.x = C.seat.x; me.y = C.seat.y + 14; me.face = 1; }
  function standUp() { me.seated = false; me.x = C.seat.x + 92; me.y = C.seat.y + 20; me.face = 1; }
  function startWriting() {
    cls.phase = 'turning'; cls.timer = 0;
  }

  function blocked(x, y) {
    if (x < C.left + 22 || x > C.right - 22 || y < C.top + 50 || y > C.bottom - 8) return true;
    const boxes = C.desks.map((d) => [d.x - 56, d.y - 70, 112, 116]);
    const td = C.teacherDesk; boxes.push([td.x - 10, td.y - 30, td.w + 20, td.h + 40]);
    boxes.push([C.left, 500, 80, 180]); // bookshelf
    boxes.push([teach.x - 30, teach.y - 30, 60, 40]);
    for (const [bx, by, bw, bh] of boxes) if (x > bx && x < bx + bw && y > by && y < by + bh) return true;
    return false;
  }

  function updateClass(dt) {
    layoutClass();
    cls.timer += dt;
    const free = !dialog && !me.seated && ['enter', 'escape', 'writing'].includes(cls.phase);
    me.moving = false;
    if (free) {
      const sp = 250;
      const len = Math.hypot(moveX, moveY);
      if (len > 0.15) {
        const nx = me.x + moveX / Math.max(1, len) * sp * dt, ny = me.y + moveY / Math.max(1, len) * sp * dt;
        if (!blocked(nx, me.y)) me.x = nx;
        if (!blocked(me.x, ny)) me.y = ny;
        if (Math.abs(moveX) > 0.2) me.face = Math.sign(moveX);
        me.moving = true;
        const was = Math.floor(me.walkT * 4); me.walkT += dt; if (Math.floor(me.walkT * 4) !== was) sfx.step();
      }
    }
    const nearSeat = !me.seated && Math.hypot(me.x - C.seat.x, me.y - (C.seat.y + 14)) < 120;

    switch (cls.phase) {
      case 'enter':
        if (nearSeat && hit('confirm')) {
          sitDown(); sfx.ok();
          cls.phase = 'talk';
          setTimeout(() => say('Teacher', [
            'All right, since there\'s only two of you today—sounds like there\'s some diarrhea going around—we\'ll just get started.',
            'I\'m going to give you 1000 tests.',
            'Let me just write this on the chalkboard.',
          ], startWriting), 500);
        }
        break;
      case 'turning': {
        // Walk over to the board, then turn around to write.
        const tx = C.teacherBoard.x, ty = C.teacherBoard.y, dx = tx - teach.x, dy = ty - teach.y, dist = Math.hypot(dx, dy);
        teach.moving = dist > 4;
        if (teach.moving) { teach.x += dx / dist * Math.min(dist, 160 * dt); teach.y += dy / dist * Math.min(dist, 160 * dt); teach.walkT += dt; }
        else { teach.back = true; cls.phase = 'writing'; cls.timer = 0; }
        break;
      }
      case 'writing':
      case 'escape':
        cls.writing += dt;
        if (Math.floor(cls.writing * 6) !== Math.floor((cls.writing - dt) * 6) && Math.random() < 0.6) sfx.chalk();
        if (!cls.asleep && cls.timer > 2) { cls.asleep = true; sfx.snore(); }
        if (cls.phase === 'writing' && cls.timer > (cls.tries || cls.sorry ? 2 : 3.6)) {
          cls.phase = 'escape'; cls.prompt = true;
          banner('The teacher\'s not looking! Escape the school!', 4);
        }
        if (cls.phase === 'escape') {
          if (me.seated && (hit('confirm') || Math.hypot(moveX, moveY) > 0.5)) { standUp(); sfx.move(); }
          if (!me.seated && me.x > C.right - 140 && Math.abs(me.y - C.door.y) < 110) {
            // Always caught, just before the door.
            cls.phase = 'spin'; cls.timer = 0; teach.spin = 1; teach.back = false; sfx.spin();
          }
        }
        if (cls.asleep && Math.floor(cls.timer / 3) !== Math.floor((cls.timer - dt) / 3)) sfx.snore();
        break;
      case 'spin':
        teach.spin = Math.max(0, 1 - cls.timer / 0.35);
        if (cls.timer > 0.5) {
          cls.phase = 'question';
          ask('Teacher', 'Where do you think you\'re going?', ['Sorry, sir, I\'ll sit back down.', 'I\'m escaping!'], (i) => {
            if (i === 0) {
              say('Teacher', 'Good.', () => fadeTo(() => { sitDown(); cls.sorry = true; startWriting(); }));
            } else {
              sfx.door();
              fadeTo(startChase);
            }
          });
        }
        break;
    }
    if (cls.phase === 'enter' && me.x > C.right - 60 && Math.abs(me.y - C.door.y) < 80 && hit('confirm')) bark('teacher', 'Class is about to start!');
  }

  function drawClass(c) {
    layoutClass();
    C.sketch.draw(c);
    const b = C.board;
    // Chalk writing appears as the teacher writes.
    drawChalk(c, b, cls.writing);
    // Door, swung open against the wall above the doorway
    drawSprite(c, IMG.door, C.right - 30, C.door.y - C.door.half - 4, 150);

    // Things sorted by how far down the screen they are, so nearer ones overlap.
    const items = [];
    for (const d of C.desks) {
      if (d === C.student) items.push([d.y + 40, () => drawSprite(c, IMG[cls.asleep ? 'sleeper' : 'student'], d.x - (cls.asleep ? 16 : 0), d.y + 50, cls.asleep ? 178 : 150)]);
      else {
        items.push([d.y - 30, () => drawChair(c, d.x, d.y)]);
        items.push([d.y + 30, () => drawDesk(c, d.x, d.y)]);
      }
    }
    // Me
    items.push([me.seated ? me.y - 1 : me.y, () => {
      drawSprite(c, IMG[hero], me.x, me.y, H_KID, {
        flip: me.face < 0, bob: me.moving ? Math.abs(Math.sin(me.walkT * 11)) * 5 : 0, tilt: me.moving ? Math.sin(me.walkT * 11) * 0.05 : 0,
      });
    }]);
    // Teacher
    items.push([teach.y, () => {
      if (teach.back) drawSprite(c, IMG['teacher-back'], teach.x, teach.y, H_TEACH_BACK, { tilt: Math.sin(cls.writing * 9) * 0.02 });
      else drawSprite(c, IMG.teacher, teach.x, teach.y, H_TEACH, {
        sx: teach.spin ? Math.cos(teach.spin * Math.PI) : 1,
        bob: teach.moving ? Math.abs(Math.sin(teach.walkT * 9)) * 5 : 0,
      });
    }]);
    items.sort((a, z) => a[0] - z[0]);
    for (const [, f] of items) f();

    if (cls.asleep) drawZzz(c, C.student.x + 30, C.student.y - 105);

    // Rings and prompts
    if (!dialog && !fadeDir) {
      if (cls.phase === 'enter') {
        drawRing(c, C.seat.x, C.seat.y - 10, 80, 66, t);
        if (Math.hypot(me.x - C.seat.x, me.y - (C.seat.y + 14)) < 120) drawHideTag(c, C.seat.x, C.seat.y - 150, 'Sit', t);
      }
      if (cls.phase === 'escape' && cls.prompt) {
        drawRing(c, C.door.x - 10, C.door.y, 60, 95, t);
        if (me.seated) drawHideTag(c, me.x, me.y - 190, 'Stand up', t);
      }
      if (cls.phase === 'spin' || cls.phase === 'question') drawMark(c, teach.x, teach.y - H_TEACH - 30, '!');
    }
    for (const bk of barks) {
      const p = bk.who === 'teacher' ? [teach.x, teach.y - H_TEACH] : [me.x, me.y - H_KID];
      drawBubble(c, p[0], p[1], bk.text);
    }
  }
  // "1000 TESTS" and tally marks, chalked a stroke at a time.
  function drawChalk(c, b, time) {
    if (time <= 0) return;
    c.save();
    c.beginPath(); c.rect(b.x + 10, b.y + 10, b.w - 20, b.h - 20); c.clip();
    c.font = font(40, 'normal'); c.fillStyle = '#444'; c.textBaseline = 'middle';
    const title = '1000 TESTS';
    const n = Math.min(title.length, Math.floor(time * 3));
    c.fillText(title.slice(0, n), b.x + 22, b.y + 38);
    const tallies = Math.max(0, Math.floor((time - 4) * 3));
    c.strokeStyle = '#444'; c.lineWidth = 3; c.lineCap = 'round';
    for (let i = 0; i < Math.min(tallies, 120); i++) {
      const group = Math.floor(i / 5), k = i % 5;
      const gx = b.x + 26 + (group % 12) * 36, gy = b.y + 68 + Math.floor(group / 12) * 30;
      c.beginPath();
      if (k < 4) { c.moveTo(gx + k * 6, gy - 12); c.lineTo(gx + k * 6 + 1, gy + 10); }
      else { c.moveTo(gx - 4, gy + 6); c.lineTo(gx + 24, gy - 8); }
      c.stroke();
    }
    c.restore();
  }
  function drawZzz(c, x, y) {
    c.save(); c.fillStyle = INK; c.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i / 3) % 1;
      c.globalAlpha = 1 - k; c.font = font(18 + k * 22);
      c.fillText('z', x + 30 + k * 40 + Math.sin(k * 8) * 6, y - k * 70);
    }
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Banner across the top, for "Escape!" moments.
  let bannerText = '', bannerT = 0, bannerDur = 0;
  function banner(text, dur) { bannerText = text; bannerT = 0; bannerDur = dur; }
  function drawBanner(c) {
    if (bannerT >= bannerDur) return;
    const k = Math.min(1, bannerT * 4, (bannerDur - bannerT) * 3);
    c.save();
    c.globalAlpha = k;
    c.font = font(42, 'normal');
    const lines = wrap(c, bannerText, W - 160);
    const w = Math.max(...lines.map((l) => c.measureText(l).width)) + 70, h = lines.length * 52 + 30;
    const x = (W - w) / 2, y = 24 + (1 - k) * -30;
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 6;
    c.save(); c.translate(W / 2, y + h / 2); c.rotate(-0.012); c.translate(-W / 2, -(y + h / 2));
    roundRect(c, x, y, w, h, 18); c.fill(); c.stroke();
    c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((l, i) => c.fillText(l, W / 2, y + 15 + 26 + i * 52));
    c.restore();
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // You got away!
  let wonSel = 0;
  const WON_ITEMS = [
    ['Play again', () => fadeTo(startHall)],
    ['Pick the other girl', () => { pickSel = hero === 'girl1' ? 1 : 0; mode = 'pick'; }],
    ['All games', () => { location.href = '/'; }],
  ];
  function updateWon() {
    if (hit('up')) { wonSel = (wonSel + WON_ITEMS.length - 1) % WON_ITEMS.length; sfx.move(); }
    if (hit('down')) { wonSel = (wonSel + 1) % WON_ITEMS.length; sfx.move(); }
    if (hit('confirm')) { sfx.ok(); WON_ITEMS[wonSel][1](); }
  }
  function drawWon(c) {
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK;
    c.font = font(84, 'normal'); c.fillText('You got away!', W / 2, 110);
    c.font = font(34, 'normal'); c.fillText('The teacher walked right past you. ...for now.', W / 2, 190);
    c.font = font(30, 'normal'); c.fillText('To be continued!', W / 2, 240);
    drawSprite(c, IMG[hero], W / 2 - 330, 640, 380, { bob: Math.abs(Math.sin(t * 7)) * 18 });
    drawSprite(c, IMG.cart, W / 2 + 340, 640, 220);
    drawMenu(c, WON_ITEMS.map((i) => i[0]), wonSel, W / 2, 360);
    c.restore();
  }
  function drawMenu(c, labels, sel, cx, y) {
    c.save();
    c.font = font(36); c.textAlign = 'center'; c.textBaseline = 'middle';
    labels.forEach((l, i) => {
      const yy = y + i * 70;
      if (i === sel) {
        const w = c.measureText(l).width + 70;
        c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 5;
        roundRect(c, cx - w / 2, yy - 30, w, 60, 18); c.fill(); c.stroke();
      }
      c.fillStyle = i === sel ? INK : '#555'; c.fillText(l, cx, yy + 2);
    });
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Pause menu
  function pauseItems() {
    return [
      ['Keep playing', () => { paused = false; }],
      [document.fullscreenElement ? 'Leave fullscreen' : 'Fullscreen', toggleFullscreen],
      [`Sound: ${save.sound ? 'on' : 'off'}`, () => { save.sound = !save.sound; writeSave(); }],
      ['Start over', () => { paused = false; mode = 'title'; dialog = null; barks.length = 0; }],
      ['All games', () => { location.href = '/'; }],
    ];
  }
  function updatePause() {
    const items = pauseItems();
    if (hit('up')) { pauseSel = (pauseSel + items.length - 1) % items.length; sfx.move(); }
    if (hit('down')) { pauseSel = (pauseSel + 1) % items.length; sfx.move(); }
    if (hit('confirm')) { sfx.blip(); items[pauseSel][1](); }
    else if (hit('back') || hit('pause')) paused = false;
  }
  function drawPause(c) {
    c.save();
    c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(0, 0, W, H);
    c.font = font(64, 'normal'); c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('Paused', W / 2, 110);
    drawMenu(c, pauseItems().map((i) => i[0]), pauseSel, W / 2, 230);
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Main loop
  function update(dt) {
    t += dt;
    pollInput();
    updateFade(dt);
    bannerT += dt;
    for (let i = barks.length - 1; i >= 0; i--) { barks[i].t += dt; if (barks[i].t > barks[i].dur) barks.splice(i, 1); }
    if (fadeDir > 0) return;
    if (paused) { updatePause(); return; }
    if (hit('pause') && ['hall', 'class'].includes(mode) && !dialog) { paused = true; pauseSel = 0; sfx.blip(); return; }
    if (dialog) { updateDialog(dt); if (mode === 'class') updateClass(dt); return; }
    if (mode === 'title') updateTitle();
    else if (mode === 'pick') updatePick();
    else if (mode === 'hall') updateHall(dt);
    else if (mode === 'class') updateClass(dt);
    else if (mode === 'won') updateWon();
  }

  let pickW = 0;
  function render() {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    if (mode === 'loading') {
      ctx.font = font(40, 'normal'); ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText('Loading...', W / 2, H / 2);
      return;
    }
    if (mode === 'title') drawTitle(ctx);
    else if (mode === 'pick') { if (pickW !== W) { rebuildPickSketch(); pickW = W; } drawPick(ctx); }
    else if (mode === 'hall') {
      drawHall(ctx);
      if (!dialog && !paused) {
        const list = hallMode === 'walk' ? [['leftright', 'Walk'], ['pause', 'Menu']] : [['leftright', 'Run'], ['confirm', 'Hide'], ['pause', 'Menu']];
        drawPrompts(ctx, list, W - 24, H - 30, 'right', 30);
      }
    } else if (mode === 'class') {
      drawClass(ctx);
      if (!dialog && !paused && (cls.phase === 'enter' || (cls.phase === 'escape' && !me.seated))) drawPrompts(ctx, [['move', 'Walk'], ['pause', 'Menu']], W - 24, H - 30, 'right', 30);
    } else if (mode === 'won') drawWon(ctx);
    drawBanner(ctx);
    if (dialog) drawDialog(ctx);
    if (paused) drawPause(ctx);
    if (fade > 0) { ctx.fillStyle = `rgba(255,255,255,${fade})`; ctx.fillRect(0, 0, W, H); }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode !== 'loading') update(dt);
    render();
    requestAnimationFrame(frame);
  }
  loading.then(() => { mode = 'title'; });
  requestAnimationFrame(frame);

  // For testing from the browser console.
  window.escapeSchool = {
    get state() { return { mode, hallMode, hero, P: { ...P, hidden: P.hidden && P.hidden.kind }, me: { ...me }, cls: { ...cls }, chase: chase && { ...chase }, teacher: { ...teacherH }, jan: { ...jan }, dialog: dialog && dialog.pages[dialog.page], device }; },
    startHall, startClass, startChase, setHero(h) { hero = h; },
  };
})();
