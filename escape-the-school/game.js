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
  const ART = ['girl1', 'girl2', 'girl1-seated', 'girl2-seated', 'teacher', 'teacher-back', 'janitor', 'cart', 'lockers', 'sleeper', 'student', 'door',
    'room11', 'friend', 'lounge-woman', 'lounge-man', 'lounge-table'];
  function loadImage(src) {
    return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  }
  const loading = Promise.all(ART.map((n) => loadImage(`assets/${n}.png`).then((i) => { IMG[n] = i; })));

  let save = { sound: true, pad: 'auto' };
  try { const s = JSON.parse(localStorage.getItem('escape-school-v1')); if (s) save = { ...save, ...s }; } catch { /* none */ }
  if (!['auto', 'xbox', 'ps', 'nintendo'].includes(save.pad)) save.pad = 'auto';
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
  let device = 'keyboard'; // 'keyboard' | 'touch' | 'xbox' | 'ps' | 'nintendo' | 'deck'
  let padId = '';           // the last controller used, shown in the menu
  // Some setups hide the real controller (Steam Input turns everything into a
  // virtual Xbox pad), so the menu lets you pick the button pictures yourself.
  const PAD_STYLES = [['auto', 'Auto'], ['xbox', 'Xbox'], ['ps', 'PlayStation'], ['nintendo', 'Switch']];
  const held = {}, prevHeld = {};
  let moveX = 0, moveY = 0;

  function padFamily(id) {
    if (/054c|playstation|dualshock|dualsense|wireless controller/i.test(id)) return 'ps';
    if (/057e|nintendo|switch|pro controller|joy-con|joycon/i.test(id)) return 'nintendo';
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

  // Touch (and mouse): taps are kept in game coordinates and handled by each
  // screen: tap a spot to walk there, tap a thing to use it, tap a menu item.
  let tap = null, tapNext = null;
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    tapNext = { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    if (e.pointerType !== 'mouse') device = 'touch';
    unlockAudio();
  });
  // Set for one frame when a tap-walk arrives at something to use (a door, a seat, a hiding spot).
  let actNow = false;

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
      if (used) { padId = gp.id; device = save.pad !== 'auto' ? save.pad : padFamily(gp.id); unlockAudio(); }
    }
    for (const a in KEYS) {
      prevHeld[a] = held[a];
      held[a] = !!padHeld[a] || KEYS[a].some((k) => keysDown.has(k));
    }
    // Keys that went down and up again within one frame still count as a press.
    for (const a in KEYS) if (KEYS[a].some((k) => keysHit.has(k))) prevHeld[a] = false, held[a] = true;
    tap = tapNext; tapNext = null; actNow = false;
    moveX = Math.max(-1, Math.min(1, ax + (held.right ? 1 : 0) - (held.left ? 1 : 0)));
    moveY = Math.max(-1, Math.min(1, ay + (held.down ? 1 : 0) - (held.up ? 1 : 0)));
    keysHit.clear();
  }
  const hit = (a) => held[a] && !prevHeld[a];
  const use = () => hit('confirm') || actNow;
  const tapIn = (x, y, w, h) => tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;
  // Which row of a drawMenu() list was tapped, or -1.
  function menuTap(y0, n) {
    if (!tap) return -1;
    for (let i = 0; i < n; i++) if (Math.abs(tap.y - (y0 + i * 70)) < 34) return i;
    return -1;
  }

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
    item() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.06, 0, i * 0.09)); },
    spray() { noise(0.7, 0.16, 2500); },
    fart() { tone(95, 0.8, 'sawtooth', 0.12, 45); noise(0.8, 0.18, 260, 'lowpass'); },
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
    if (device === 'touch') {
      c.strokeStyle = INK; c.fillStyle = '#fff'; c.lineWidth = 3;
      c.beginPath(); c.arc(x + r, y, r - 2, 0, 7); c.fill(); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(x + r, y, r * 0.3, 0, 7); c.fill();
      c.restore(); return size;
    }
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
  let mode = 'loading'; // loading | title | pick | hall | class | room11 | lounge | won
  let paused = false, pauseSel = 0;
  let t = 0;            // seconds since the page started
  let hero = 'girl1';
  // Which way each drawing already faces (1 right, -1 left), so walking flips
  // them the right way round. The blond girl's feet point left.
  const FACES = { girl1: 1, girl2: -1 };
  const heroFlip = (face) => face !== FACES[hero];
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
    let ok = hit('confirm');
    if (tap) {
      if (d.choices && full) {
        // Tap an answer to pick it.
        const by = H - 250 - 20;
        d.choices.forEach((ch, i) => { if (tap.y > by + 108 + i * 58 && tap.y < by + 166 + i * 58) { d.sel = i; ok = true; } });
      } else ok = true;
    }
    if (ok) {
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
  // Once you've reached chapter 2, the title lets you jump straight to it.
  let titleSel = 0, startCh = 1;
  const TITLE_ITEMS = ['Start', 'Chapter 2'];
  function updateTitle() {
    if (hit('fullscreen')) toggleFullscreen();
    let go = hit('confirm');
    if (save.ch2) {
      if (hit('up') || hit('down')) { titleSel = 1 - titleSel; sfx.move(); }
      const tapped = menuTap(330, 2);
      if (tapped >= 0) { titleSel = tapped; go = true; }
    } else if (tap) go = true;
    if (go) { sfx.ok(); startCh = save.ch2 ? titleSel + 1 : 1; mode = 'pick'; }
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
    c.restore();
    if (save.ch2) drawMenu(c, TITLE_ITEMS, titleSel, W / 2, 330);
    drawPrompts(c, [['confirm', save.ch2 ? 'Pick' : 'Start'], ['fullscreen', 'Fullscreen']], W / 2, 600, 'center', 40);
  }

  function updatePick() {
    if (hit('left') || hit('right')) { pickSel = 1 - pickSel; sfx.move(); }
    if (hit('back')) mode = 'title';
    let go = hit('confirm');
    if (tap) [W / 2 - 170, W / 2 + 170].forEach((x, i) => { if (Math.abs(tap.x - x) < 170) { pickSel = i; go = true; } });
    if (go) {
      hero = pickSel ? 'girl2' : 'girl1';
      sfx.ok();
      fadeTo(startCh === 2 ? startChapter2 : startHall);
    }
  }
  function drawPick(c) {
    const cx = W / 2;
    c.save();
    c.font = font(64, 'normal'); c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('Pick your girl', cx, 80);
    pickSketch.draw(c);
    const xs = [cx - 170, cx + 170];
    xs.forEach((x, i) => {
      const sel = i === pickSel;
      if (sel) drawRing(c, x, 635, 130, 34, t);
      drawSprite(c, IMG[i ? 'girl2' : 'girl1'], x, 640, sel ? 450 : 410, { bob: sel ? Math.abs(Math.sin(t * 6)) * 8 : 0 });
    });
    c.restore();
    drawPrompts(c, [['leftright', 'Choose'], ['confirm', 'Go to school']], W / 2, H - 34, 'center', 36);
  }
  const pickSketch = new Sketch(11);
  pickSketch.line(400 - 120, 120, 900 - 120, 116, 5);
  function rebuildPickSketch() {
    pickSketch.strokes = []; pickSketch.r = rng(11);
    pickSketch.line(W / 2 - 240, 122, W / 2 + 240, 118, 5);
  }

  // ---------------------------------------------------------------------------
  // The hallway, side on. One long hallway is used twice: walking to class at the
  // start, and running away from the teacher in the chase.
  const FLOOR = 640;           // where feet stand
  const HALL_W = 5000;
  const DOOR_X = 700;          // the classroom door
  const EXIT_X = 4220;         // locked doors at the end
  const JAN_HOME = 1450;       // the janitor mops here, facing the classroom
  const ROOM11_X = 3880;       // where your best friend's class is
  const LOUNGE_X = 4680;       // the teachers' lounge, past the exit
  const SPOTS = [              // hiding spots, all past the janitor
    { kind: 'cart', x: 1930, half: 150 },
    { kind: 'closet', x: 2320, half: 95, label: 'Janitor' },
    { kind: 'lockers', x: 2700, half: 130 },
    { kind: 'room', x: 3100, half: 95, label: 'Room 10' },
    { kind: 'lockers', x: 3480, half: 130 },
    { kind: 'room', x: 3880, half: 95, label: 'Room 11' },
  ];
  const isDoor = (s) => s.kind === 'closet' || s.kind === 'room';
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
    for (const wx of [1150]) {
      s.rect(wx, 150, 260, 160, 5).line(wx + 130, 150, wx + 130, 310, 4).line(wx, 230, wx + 260, 230, 4);
      s.line(wx + 30, 175, wx + 70, 205, 2, '#888').line(wx + 160, 255, wx + 200, 285, 2, '#888');
    }
    // A clock
    s.circle(1760, 200, 42, 5).line(1760, 200, 1760, 172, 4).line(1760, 200, 1782, 210, 4);
    // Posters
    s.rect(4010, 160, 110, 150, 4).text('READ!', 4065, 195, 26, INK).circle(4065, 255, 28, 3).line(4045, 255, 4085, 255, 3).line(4065, 227, 4065, 283, 3);
    // Closed doors you can hide behind: the janitor's closet and other classrooms
    for (const d of SPOTS.filter(isDoor)) {
      const x = d.x;
      s.fill(x - 90, 180, 180, 392).rect(x - 90, 180, 180, 392, 6).rect(x - 78, 192, 156, 380, 3);
      s.rect(x - 38, 222, 76, 92, 3.5).line(x + 52, 390, x + 66, 390, 7);
      s.rect(x - 70, 120, 140, 44, 4).text(d.label, x, 143, d.label.length > 7 ? 24 : 26, INK);
      if (d.kind === 'closet') { // a bucket by the closet door
        s.poly([[x + 104, 500], [x + 156, 500], [x + 150, 572], [x + 110, 572]], true, 4).circle(x + 130, 488, 26, 3, INK, 12);
      }
    }
    s.rect(1600, 380, 120, 100, 4).text('No', 1660, 410, 26, INK).text('running', 1660, 446, 24, INK);
    // Locked doors at the end with an exit sign
    s.rect(EXIT_X - 130, 190, 130, 382, 6).rect(EXIT_X, 190, 130, 382, 6);
    s.rect(EXIT_X - 110, 230, 90, 110, 3).rect(EXIT_X + 20, 230, 90, 110, 3);
    s.line(EXIT_X - 110, 400, EXIT_X - 10, 400, 7).line(EXIT_X + 10, 400, EXIT_X + 110, 400, 7);
    s.rect(EXIT_X - 70, 110, 140, 50, 4).text('EXIT', EXIT_X, 136, 30, INK);
    // Chain and padlock
    for (let i = -3; i <= 3; i++) s.circle(EXIT_X + i * 18, 410 + Math.abs(i) * 4, 10, 3, INK, 7);
    s.rect(EXIT_X - 18, 432, 36, 32, 4).circle(EXIT_X, 432, 12, 4);
    // The teachers' lounge door, with a coffee cup in its window
    s.fill(LOUNGE_X - 90, 180, 180, 392).rect(LOUNGE_X - 90, 180, 180, 392, 6).rect(LOUNGE_X - 78, 192, 156, 380, 3);
    s.rect(LOUNGE_X - 38, 222, 76, 92, 3.5).line(LOUNGE_X + 52, 390, LOUNGE_X + 66, 390, 7);
    s.rect(LOUNGE_X - 16, 252, 26, 34, 3).circle(LOUNGE_X + 16, 268, 9, 3).line(LOUNGE_X - 8, 244, LOUNGE_X - 4, 232, 2.5).line(LOUNGE_X + 2, 244, LOUNGE_X + 6, 232, 2.5);
    s.rect(LOUNGE_X - 120, 104, 240, 62, 4).text('Teachers\'', LOUNGE_X, 122, 22, INK).text('Lounge', LOUNGE_X, 148, 22, INK);
    s.rect(LOUNGE_X + 110, 380, 120, 70, 3).text('Teachers', LOUNGE_X + 170, 402, 20, INK).text('only!', LOUNGE_X + 170, 428, 20, INK);
    // Right end
    s.line(HALL_W - 40, 46, HALL_W - 40, 572, 5).line(HALL_W - 40, 572, HALL_W, 720, 5).hatch(HALL_W - 40, 46, 40, 526, 16, 2, '#888');
  }

  // Everyone in the hallway
  const P = { x: 200, vx: 0, face: 1, walkT: 0, hidden: null, frozen: false, target: null };
  const teacherH = { x: DOOR_X, face: 1, state: 'off', timer: 0, alpha: 0, walkT: 0 };
  // The janitor always faces the classroom. He mostly looks down at his mop, but
  // every few seconds he looks up (with a "?" first as a warning), and if you're
  // in front of him and not hiding, he sees you. Behind him you're safe.
  const jan = { x: JAN_HOME, face: -1, looking: false, next: 3, warn: 0, mopT: 0, saw: false, talked: false };
  let camX = 0;
  let hallMode = 'walk'; // walk (going to class) | chase | free (the teacher's gone, chapter 2)
  let chase = null;      // { state, timer, hints }

  function startHall() {
    mode = 'hall'; hallMode = 'walk';
    story.step = 'class'; story.spray = false; story.sprayed = false;
    P.x = 180; P.face = 1; P.hidden = null; P.frozen = false; P.target = null;
    jan.x = JAN_HOME; jan.looking = false; jan.talked = false; jan.saw = false; jan.warn = 0;
    teacherH.state = 'off'; teacherH.alpha = 0;
    camX = 0; barks.length = 0; dialog = null;
  }
  function startChase() {
    mode = 'hall'; hallMode = 'chase';
    P.x = DOOR_X + 150; P.face = 1; P.hidden = null; P.frozen = false; P.target = null;
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

  // Where a tap in the hallway sends you, and whether to use what's there.
  function hallTap() {
    const wx = tap.x + camX;
    if (P.hidden) { actNow = true; return; } // tap anywhere to come out
    const chasing = hallMode === 'chase';
    const spot = chasing && SPOTS.find((sp) => Math.abs(wx - sp.x) < sp.half);
    const doorAt = [DOOR_X, ROOM11_X, LOUNGE_X, EXIT_X].find((x) => Math.abs(wx - x) < (x === EXIT_X ? 150 : 110));
    if (spot) P.target = { x: spot.x, act: true };
    else if (doorAt && !(chasing && doorAt === DOOR_X)) P.target = { x: doorAt, act: true };
    else P.target = { x: clamp(wx, 90, HALL_W - 150), act: false };
  }

  function updateHall(dt) {
    const speed = 340;
    if (tap && !P.frozen && !dialog) hallTap();
    let mx = moveX;
    if (Math.abs(mx) > 0.1 || P.hidden || P.frozen) P.target = null;
    else if (P.target) {
      const dx = P.target.x - P.x;
      if (Math.abs(dx) < 8) { if (P.target.act) actNow = true; P.target = null; }
      else mx = Math.sign(dx) * Math.min(1, Math.abs(dx) / 30);
    }
    if (!P.frozen && !dialog && !P.hidden) {
      P.vx = mx * speed;
      if (Math.abs(mx) > 0.1) P.face = Math.sign(mx);
    } else P.vx = 0;
    const before = P.x;
    P.x = clamp(P.x + P.vx * dt, 90, HALL_W - 150);
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
        if (Math.abs(P.x - DOOR_X) < 90 && use()) { sfx.door(); fadeTo(startClass); }
        if (!jan.talked && Math.abs(P.x - jan.x) < 220) { jan.talked = true; bark('jan', 'Shouldn\'t you be in class?', 2.6); }
        if (Math.abs(P.x - EXIT_X) < 150 && use()) { sfx.locked(); bark('you', 'It\'s locked. It\'s not home time yet!'); }
        if (Math.abs(P.x - LOUNGE_X) < 90 && use()) { sfx.locked(); bark('you', 'The teachers\' lounge. Kids aren\'t allowed in there!'); }
      }
      return;
    }

    if (hallMode === 'free') {
      if (!dialog) {
        if (Math.abs(P.x - ROOM11_X) < 90 && use()) { sfx.door(); fadeTo(startRoom11); }
        else if (Math.abs(P.x - LOUNGE_X) < 90 && use()) {
          if (story.spray) { sfx.door(); fadeTo(startLounge); }
          else { sfx.locked(); bark('you', 'The teachers\' lounge! I should find my best friend in Room 11 first.', 3); }
        } else if (Math.abs(P.x - EXIT_X) < 150 && use()) { sfx.locked(); bark('you', 'It\'s locked. It\'s not home time yet!'); }
        else if (Math.abs(P.x - DOOR_X) < 90 && use()) bark('you', 'No way am I going back in there!');
        if (!jan.talked && Math.abs(P.x - jan.x) < 220) { jan.talked = true; bark('jan', 'Shouldn\'t you be in class?', 2.6); }
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
      if (use()) {
        if (P.hidden) { P.hidden = null; sfx.hide(); }
        else if (spot) { P.hidden = spot; P.x = spot.x; sfx.hide(); }
        else if (Math.abs(P.x - EXIT_X) < 150) { sfx.locked(); bark('you', 'Locked! I need to hide!'); }
        else if (Math.abs(P.x - LOUNGE_X) < 90) { sfx.locked(); bark('you', 'Teachers only! I need to hide!'); }
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
        if (T.timer > 3.2) { T.state = 'leaving'; bark('teacher', 'I need a break, I\'m going to the teachers\' lounge.', 3.6); }
      }
    } else if (T.state === 'leaving') {
      // Off down the hall to the teachers' lounge.
      const dx = LOUNGE_X - T.x;
      T.face = Math.sign(dx) || 1; T.x += T.face * Math.min(Math.abs(dx), 175 * dt); T.walkT += dt;
      if (Math.abs(dx) < 4) { T.state = 'gone'; T.timer = 0; sfx.door(); }
    } else if (T.state === 'gone') {
      T.alpha = Math.max(0, T.alpha - dt * 3);
      T.timer += dt;
      if (T.timer > 1 && ch.state !== 'free') {
        // Chapter 2 starts here.
        ch.state = 'free'; hallMode = 'free'; story.step = 'friend';
        if (P.hidden) { P.hidden = null; sfx.hide(); }
        jan.looking = false; jan.warn = false;
        sfx.win();
        banner('He\'s gone! Go find your best friend in Room 11.', 5);
        if (!save.ch2) { save.ch2 = true; writeSave(); }
      }
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
      } else if (isDoor(s)) {
        if (P.hidden === s) drawPeekEyes(c, s.x, 268);
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
        flip: heroFlip(P.face), bob: walking ? Math.abs(Math.sin(P.walkT * 11)) * 10 : 0, tilt: walking ? Math.sin(P.walkT * 11) * 0.05 : 0,
      });
    }

    // Prompts in the world
    if (!dialog && !fadeDir) {
      if (hallMode === 'walk') {
        if (Math.abs(P.x - DOOR_X) < 260) drawRing(c, DOOR_X, FLOOR - 10, 120, 30, t);
        if (Math.abs(P.x - DOOR_X) < 90) drawHideTag(c, DOOR_X, FLOOR - H_GIRL - 70, 'Go in', t);
      } else if (hallMode === 'free') {
        const goal = hallGoal();
        drawRing(c, goal, FLOOR - 10, 120, 30, t);
        if (Math.abs(P.x - goal) < 90) drawHideTag(c, goal, FLOOR - H_GIRL - 70, 'Go in', t);
        else if (Math.abs(P.x - ROOM11_X) < 90) drawHideTag(c, ROOM11_X, FLOOR - H_GIRL - 70, 'Go in', t);
      } else if (chase.state === 'run' || chase.state === 'hidden') {
        const s = nearSpot();
        if (s) {
          const top = s.kind === 'cart' ? FLOOR - H_CART : FLOOR - H_LOCKERS;
          drawHideTag(c, s.x + (s.kind === 'cart' ? -40 : 0), isDoor(s) ? 360 : top - 110, P.hidden ? 'Come out' : 'Hide', t);
        }
      }
    }

    c.restore();
    // An arrow at the edge of the screen pointing the way.
    if (hallMode === 'free' && !dialog) {
      const goal = hallGoal(), sx = goal - camX;
      if (sx > W - 40) drawEdgeArrow(c, W - 70, 1, story.step === 'friend' ? 'Room 11' : 'Lounge');
      else if (sx < 40) drawEdgeArrow(c, 70, -1, story.step === 'friend' ? 'Room 11' : 'Lounge');
    }
    // Speech, in screen space so bubbles stay on screen.
    for (const b of barks) {
      const who = b.who === 'jan' ? [jan.x, FLOOR - H_JANITOR - 10] : b.who === 'teacher' ? [T.x, FLOOR - H_TEACHER - 10]
        : [P.x, P.hidden ? FLOOR - 300 : FLOOR - H_GIRL - 10];
      drawBubble(c, who[0] - camX, who[1], b.text);
    }
  }
  const hallGoal = () => (story.step === 'friend' ? ROOM11_X : LOUNGE_X);
  function drawEdgeArrow(c, x, dir, label) {
    const b = Math.sin(t * 6) * 8 * dir, y = 430;
    c.save(); c.translate(x + b, y);
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 6; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-36 * dir, -18); c.lineTo(4 * dir, -18); c.lineTo(4 * dir, -38); c.lineTo(44 * dir, 0);
    c.lineTo(4 * dir, 38); c.lineTo(4 * dir, 18); c.lineTo(-36 * dir, 18); c.closePath(); c.fill(); c.stroke();
    c.font = font(26); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 7; c.strokeStyle = '#fff'; c.strokeText(label, -10 * dir, -66); c.fillStyle = INK; c.fillText(label, -10 * dir, -66);
    c.restore();
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
  const me = { x: 0, y: 0, face: 1, walkT: 0, seated: false, moving: false, path: null, act: null, stuck: 0 };
  const teach = { x: 0, y: 0, back: false, spin: 0, walkT: 0, moving: false, route: null };
  let cls = { phase: 'enter', timer: 0, asleep: false, writing: 0, prompt: false, tries: 0 };
  const H_KID = 148, H_SEATED = 150, H_TEACH = 180, H_TEACH_BACK = 172;

  function layoutClass() {
    if (C.W === W) return;
    C.W = W;
    C.left = 70; C.right = W - 70; C.top = 170; C.bottom = 685;
    C.board = { x: 120, y: 34, w: 470, h: 100 };
    C.teacherHome = { x: 200, y: 300 };
    C.teacherBoard = { x: 530, y: 230 };
    C.teacherDesk = { x: 290, y: 232, w: 190, h: 70 };
    const cx = Math.round((C.left + C.right) / 2 + 40);
    C.desks = [];
    for (const y of [355, 525]) for (const dx of [-210, 0, 210]) C.desks.push({ x: cx + dx, y });
    C.student = C.desks[1];
    C.seat = C.desks[2];
    C.door = { x: C.right, y: 525, half: 70 };
    C.sketch = buildClassSketch();
    layoutRooms();
  }

  // Desks face the chalkboard, so you see each chair from behind, below its
  // desk, like in her drawing of the two girls sitting down.
  const SEAT_Y = 108; // how far below a desk's middle a seated kid's feet are
  function chairStrokes(s, x, y) {
    s.fill(x - 26, y + 46, 52, 34).rect(x - 26, y + 46, 52, 34, 3.5).line(x - 26, y + 62, x + 26, y + 62, 2.5);
    s.line(x - 22, y + 80, x - 22, y + 104, 3.5).line(x + 22, y + 80, x + 22, y + 104, 3.5);
  }
  // Walls and floor of a room seen from above, with the door on the right.
  function roomShell(s) {
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
    return s;
  }
  function buildClassSketch() {
    const s = roomShell(new Sketch(33));
    const L = C.left;
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
    if (!chairCache.has(k)) { const s = new Sketch(x + y * 3); chairStrokes(s, x, y); chairCache.set(k, s); }
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
    say('Mr. Richards', lines, startWriting);
  }
  function sitDown() { me.path = null; me.seated = true; me.x = C.seat.x; me.y = C.seat.y + SEAT_Y; me.face = 1; }
  function standUp() { me.seated = false; me.x = C.seat.x + 92; me.y = C.seat.y + SEAT_Y; me.face = 1; }
  const seatDist = () => Math.hypot(me.x - C.seat.x, me.y - (C.seat.y + 80));
  function startWriting() {
    cls.phase = 'turning'; cls.timer = 0;
    // From his spot by the desk he walks around the front of it, not through it.
    const b = C.teacherBoard, front = C.teacherDesk.y + C.teacherDesk.h + 24;
    teach.route = teach.x < C.teacherDesk.x ? [[teach.x, front], [b.x, front], [b.x, b.y]] : [[b.x, b.y]];
  }

  const deskBox = (d) => [d.x - 56, d.y - 30, 112, SEAT_Y + 4];
  function blocked(x, y) {
    if (x < C.left + 22 || x > C.right - 22 || y < C.top + 50 || y > C.bottom - 8) return true;
    let boxes;
    if (mode === 'room11') boxes = R11.boxes;
    else if (mode === 'lounge') boxes = LG.boxes.concat([[LG.rich.x - 30, LG.rich.y - 30, 60, 40]]);
    else {
      boxes = C.desks.map(deskBox);
      const td = C.teacherDesk; boxes.push([td.x - 10, td.y - 30, td.w + 20, td.h + 40]);
      boxes.push([C.left, 500, 80, 180]); // bookshelf
      boxes.push([teach.x - 30, teach.y - 30, 60, 40]);
    }
    for (const [bx, by, bw, bh] of boxes) if (x > bx && x < bx + bw && y > by && y < by + bh) return true;
    return false;
  }

  // Finds a way around the desks to a tapped spot (A* on a 20px grid).
  function findPath(tx, ty) {
    const G = 20, x0 = C.left, y0 = C.top, cols = Math.ceil((C.right - x0) / G), rows = Math.ceil((C.bottom - y0) / G);
    const cx = (i) => x0 + i * G + G / 2, cy = (j) => y0 + j * G + G / 2;
    const ok = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) ok[j * cols + i] = !blocked(cx(i), cy(j));
    const cellOf = (x, y) => [clamp(Math.floor((x - x0) / G), 0, cols - 1), clamp(Math.floor((y - y0) / G), 0, rows - 1)];
    const [si, sj] = cellOf(me.x, me.y);
    // The nearest open cell to the tap (it might be on a desk).
    let goal = -1, best = Infinity;
    for (let k = 0; k < ok.length; k++) if (ok[k]) {
      const d = Math.hypot(cx(k % cols) - tx, cy(Math.floor(k / cols)) - ty);
      if (d < best) { best = d; goal = k; }
    }
    if (goal < 0) return null;
    const start = sj * cols + si, gx = goal % cols, gy = Math.floor(goal / cols);
    const g = new Map([[start, 0]]), from = new Map(), open = [start], closed = new Set();
    const h = (k) => Math.hypot(k % cols - gx, Math.floor(k / cols) - gy);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (g.get(open[i]) + h(open[i]) < g.get(open[bi]) + h(open[bi])) bi = i;
      const k = open.splice(bi, 1)[0];
      if (k === goal) break;
      closed.add(k);
      const ki = k % cols, kj = Math.floor(k / cols);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ki + di, nj = kj + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const n = nj * cols + ni;
        if (!ok[n] || closed.has(n)) continue;
        if (di && dj && (!ok[kj * cols + ni] || !ok[nj * cols + ki])) continue; // no cutting corners
        const ng = g.get(k) + (di && dj ? 1.414 : 1);
        if (ng < (g.has(n) ? g.get(n) : Infinity)) { g.set(n, ng); from.set(n, k); if (!open.includes(n)) open.push(n); }
      }
    }
    if (!from.has(goal) && goal !== start) return null;
    const path = [];
    for (let k = goal; k !== start; k = from.get(k)) path.unshift([cx(k % cols), cy(Math.floor(k / cols))]);
    if (!blocked(tx, ty)) path.push([tx, ty]);
    return path;
  }
  function classTap() {
    if (me.seated) {
      if (cls.phase !== 'escape') return;
      standUp(); sfx.move();
    }
    const chairX = C.seat.x, chairY = C.seat.y + 70;
    if (cls.phase === 'enter' && Math.hypot(tap.x - chairX, tap.y - chairY) < 100) {
      me.path = findPath(C.seat.x + 92, C.seat.y + 80); me.act = 'sit';
    } else { me.path = findPath(tap.x, tap.y); me.act = null; }
    me.stuck = 0;
  }

  // Walking around a room from above: stick, keys, or following a tapped path.
  function walkMe(dt, free) {
    me.moving = false;
    let mx = moveX, my = moveY;
    if (Math.hypot(mx, my) > 0.15 || !free) me.path = null;
    else if (me.path) {
      const [wx, wy] = me.path[0], d = Math.hypot(wx - me.x, wy - me.y);
      if (d < 6) {
        me.path.shift();
        if (!me.path.length) { me.path = null; if (me.act) actNow = true; }
      } else { mx = (wx - me.x) / d * Math.min(1, d / 20); my = (wy - me.y) / d * Math.min(1, d / 20); }
    }
    if (free) {
      const sp = 250;
      const len = Math.hypot(mx, my);
      if (len > 0.15) {
        const bx = me.x, by = me.y;
        const nx = me.x + mx / Math.max(1, len) * sp * dt, ny = me.y + my / Math.max(1, len) * sp * dt;
        if (!blocked(nx, me.y)) me.x = nx;
        if (!blocked(me.x, ny)) me.y = ny;
        // Give up on a tap-walk that's stuck against something.
        if (me.path && Math.hypot(me.x - bx, me.y - by) < 0.5) { me.stuck += dt; if (me.stuck > 0.4) me.path = null; } else me.stuck = 0;
        if (Math.abs(mx) > 0.2) me.face = Math.sign(mx);
        me.moving = true;
        const was = Math.floor(me.walkT * 4); me.walkT += dt; if (Math.floor(me.walkT * 4) !== was) sfx.step();
      }
    }
  }

  function updateClass(dt) {
    layoutClass();
    cls.timer += dt;
    if (tap && !dialog && ['enter', 'escape', 'writing'].includes(cls.phase)) classTap();
    walkMe(dt, !dialog && !me.seated && ['enter', 'escape', 'writing'].includes(cls.phase));
    const nearSeat = !me.seated && seatDist() < 130;

    switch (cls.phase) {
      case 'enter':
        if (nearSeat && use()) {
          sitDown(); sfx.ok();
          cls.phase = 'talk';
          setTimeout(() => say('Mr. Richards', [
            'All right, since there\'s only two of you today—sounds like there\'s some diarrhea going around—we\'ll just get started.',
            'I\'m going to give you 1000 tests.',
            'Let me just write this on the chalkboard.',
          ], startWriting), 500);
        }
        break;
      case 'turning': {
        // Walk over to the board, then turn around to write.
        if (!teach.route || !teach.route.length) teach.route = [[C.teacherBoard.x, C.teacherBoard.y]];
        const [tx, ty] = teach.route[0], dx = tx - teach.x, dy = ty - teach.y, dist = Math.hypot(dx, dy);
        teach.moving = true; teach.walkT += dt;
        if (dist > 160 * dt) { teach.x += dx / dist * 160 * dt; teach.y += dy / dist * 160 * dt; }
        else {
          teach.x = tx; teach.y = ty; teach.route.shift();
          if (!teach.route.length) { teach.moving = false; teach.route = null; teach.back = true; cls.phase = 'writing'; cls.timer = 0; }
        }
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
          ask('Mr. Richards', 'Where do you think you\'re going?', ['Sorry, sir, I\'ll sit back down.', 'I\'m escaping!'], (i) => {
            if (i === 0) {
              say('Mr. Richards', 'Good.', () => fadeTo(() => { sitDown(); cls.sorry = true; startWriting(); }));
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
      if (d === C.student) items.push([d.y + SEAT_Y, () => drawSprite(c, IMG[cls.asleep ? 'sleeper' : 'student'], d.x - (cls.asleep ? 16 : 0), d.y + SEAT_Y, cls.asleep ? 178 : 150)]);
      else {
        items.push([d.y, () => drawDesk(c, d.x, d.y)]);
        if (!(d === C.seat && me.seated)) items.push([d.y + SEAT_Y - 2, () => drawChair(c, d.x, d.y)]);
      }
    }
    // Me
    items.push([me.y, () => {
      // Sitting: her drawing of the girl on her chair, from behind.
      if (me.seated) { drawSprite(c, IMG[hero + '-seated'], me.x, me.y, H_SEATED); return; }
      drawSprite(c, IMG[hero], me.x, me.y, H_KID, {
        flip: heroFlip(me.face), bob: me.moving ? Math.abs(Math.sin(me.walkT * 11)) * 5 : 0, tilt: me.moving ? Math.sin(me.walkT * 11) * 0.05 : 0,
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

    if (cls.asleep) drawZzz(c, C.student.x + 30, C.student.y - 40);

    // Rings and prompts
    if (!dialog && !fadeDir) {
      if (cls.phase === 'enter') {
        drawRing(c, C.seat.x, C.seat.y + 60, 76, 70, t);
        if (seatDist() < 130) drawHideTag(c, C.seat.x, C.seat.y - 90, 'Sit', t);
      }
      if (cls.phase === 'escape' && cls.prompt) {
        drawRing(c, C.door.x - 10, C.door.y, 60, 95, t);
        if (me.seated) drawHideTag(c, me.x, me.y - 230, 'Stand up', t);
      }
      if (cls.phase === 'spin' || cls.phase === 'question') drawMark(c, teach.x, teach.y - H_TEACH - 30, '!');
    }
    for (const bk of barks) {
      const p = bk.who === 'teacher' ? [teach.x, teach.y - H_TEACH] : [me.x, me.y - H_KID];
      drawBubble(c, p[0], p[1], bk.text);
    }
  }
  // "1000 TESTS" and tally marks, chalked a stroke at a time.
  const BOARD_TALLIES = 50; // tally marks that fit on the board in one row
  function drawChalk(c, b, time) {
    if (time <= 0) return;
    c.save();
    c.beginPath(); c.rect(b.x + 10, b.y + 10, b.w - 20, b.h - 20); c.clip();
    c.font = font(34, 'normal'); c.fillStyle = '#444'; c.textBaseline = 'middle'; c.textAlign = 'left';
    const title = '1000 TESTS';
    const tw = c.measureText(title).width, maxW = b.w - 50;
    const n = Math.min(title.length, Math.floor(time * 3));
    c.save(); c.translate(b.x + 24, b.y + 34); if (tw > maxW) c.scale(maxW / tw, 1);
    c.fillText(title.slice(0, n), 0, 0); c.restore();
    // Tally marks, one row; when it's full he wipes them and starts a new row.
    const total = Math.max(0, Math.floor((time - 4) * 3));
    const tallies = total % (BOARD_TALLIES + 6); // a short pause on a full board
    c.strokeStyle = '#444'; c.lineWidth = 3; c.lineCap = 'round';
    const gap = (b.w - 60) / (BOARD_TALLIES / 5);
    for (let i = 0; i < Math.min(tallies, BOARD_TALLIES); i++) {
      const group = Math.floor(i / 5), k = i % 5;
      const gx = b.x + 28 + group * gap, gy = b.y + 70;
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
  // Chapter 2: Room 11 (your best friend's class) and the teachers' lounge.
  // More rooms from above, built like the classroom, with the door on the right.
  const story = { step: 'class', spray: false, sprayed: false };
  const R11 = {}, LG = {};
  const H_FRIEND = 215, H_LOUNGE = 205;
  const LOOK_R = 165; // how far a lounge teacher can see when they look up

  function layoutRooms() {
    const L = C.left, rw = C.right - C.left;
    // Room 11: her drawing of the sleeping teacher at her desk and the sleeping
    // kid goes in the top left; your friend sits in the middle.
    R11.group = { x: L + 215, y: 478, h: 340 };
    R11.friend = { x: L + Math.round(rw * 0.62), y: 455 };
    R11.desks = [{ x: L + Math.round(rw * 0.42), y: 590 }, { x: L + Math.round(rw * 0.74), y: 590 }];
    R11.boxes = [[L, 160, 410, 320], [R11.friend.x - 115, R11.friend.y - 80, 230, 92], ...R11.desks.map(deskBox)];
    R11.sketch = roomShell(new Sketch(44));
    {
      const s = R11.sketch;
      s.circle(W - 330, 80, 30, 4).line(W - 330, 80, W - 330, 60, 3).line(W - 330, 80, W - 315, 86, 3);
      s.rect(W - 260, 40, 170, 90, 4).line(W - 175, 40, W - 175, 130, 3).line(W - 260, 85, W - 90, 85, 3);
      s.rect(560, 46, 150, 70, 4).text('Room 11', 635, 81, 28, INK);
    }

    // The lounge: a coffee counter where Mr. Richards stands with his back to
    // you, his comfy chair, and three teachers drinking coffee.
    LG.counter = { x: L + 12, y: 168, w: 400, h: 56 };
    LG.richHome = { x: L + 250, y: 296 };
    LG.chair = { x: L + 165, y: 446 };
    LG.watchers = [
      { id: 'w0', img: 'lounge-table', x: L + Math.round(rw * 0.42), y: 458, h: 255, zy: -70, face: -1, markX: 56 },
      { id: 'w1', img: 'lounge-woman', x: L + Math.round(rw * 0.69), y: 345, h: H_LOUNGE, zy: -10, face: 1, markX: 0 },
      { id: 'w2', img: 'lounge-man', x: L + Math.round(rw * 0.53), y: 650, h: H_LOUNGE, zy: -20, face: 1, markX: 0 },
    ];
    const ch = LG.chair, [t0, w1, w2] = LG.watchers;
    LG.boxes = [
      [L, 160, LG.counter.w + 20, 82],
      [ch.x - 58, ch.y - 52, 116, 112],
      [t0.x - 95, t0.y - 120, 190, 128],
      [w1.x - 30, w1.y - 34, 60, 42],
      [w2.x - 30, w2.y - 34, 60, 42],
      [L, 598, 250, 90], // sofa
    ];
    LG.sketch = roomShell(new Sketch(55));
    {
      const s = LG.sketch, k = LG.counter;
      s.rect(560, 46, 220, 70, 4).text('Teachers\' Lounge', 670, 81, 26, INK);
      s.rect(W - 260, 40, 170, 90, 4).line(W - 175, 40, W - 175, 130, 3).line(W - 260, 85, W - 90, 85, 3);
      // Coffee counter with a coffee maker and mugs
      s.fill(k.x, k.y - 40, k.w, k.h + 40).rect(k.x, k.y - 40, k.w, 40, 4).rect(k.x, k.y, k.w, k.h, 4);
      s.rect(k.x + 30, k.y - 96, 70, 84, 4).rect(k.x + 44, k.y - 50, 42, 34, 3).line(k.x + 40, k.y - 70, k.x + 90, k.y - 70, 3);
      s.rect(k.x + 300, k.y - 34, 26, 26, 3).circle(k.x + 333, k.y - 21, 7, 2.5).rect(k.x + 344, k.y - 34, 26, 26, 3);
      s.text('COFFEE', k.x + 65, k.y - 110, 18, INK);
      // Sofa in the corner
      s.fill(C.left + 4, 604, 240, 78).rect(C.left + 4, 604, 240, 78, 4).rect(C.left + 4, 604, 240, 26, 4);
      s.line(C.left + 84, 630, C.left + 84, 682, 3).line(C.left + 164, 630, C.left + 164, 682, 3);
      // A plant by the door
      s.poly([[C.right - 90, 640], [C.right - 40, 640], [C.right - 48, 682], [C.right - 82, 682]], true, 4);
      for (let a = -1.1; a <= 1.1; a += 0.45) s.line(C.right - 65, 640, C.right - 65 + Math.sin(a) * 60, 640 - Math.cos(a) * 70, 3);
    }
    // His chair, seen from behind like the desk chairs: the seat, then the back
    // drawn over whoever sits in it.
    LG.seat = new Sketch(66).fill(ch.x - 48, ch.y - 48, 96, 46).rect(ch.x - 48, ch.y - 48, 96, 46, 4)
      .rect(ch.x - 62, ch.y - 40, 14, 60, 3.5).rect(ch.x + 48, ch.y - 40, 14, 60, 3.5);
    LG.back = new Sketch(67).fill(ch.x - 54, ch.y - 4, 108, 52).rect(ch.x - 54, ch.y - 4, 108, 52, 4.5)
      .line(ch.x - 46, ch.y + 48, ch.x - 46, ch.y + 72, 4).line(ch.x + 46, ch.y + 48, ch.x + 46, ch.y + 72, 4)
      .text('Mr. R', ch.x, ch.y + 22, 22, INK);
  }

  function enterRoom() {
    layoutClass();
    me.x = C.right - 80; me.y = C.door.y; me.face = -1; me.seated = false; me.path = null; me.act = null;
    barks.length = 0; dialog = null;
  }
  function startRoom11() {
    mode = 'room11'; enterRoom();
    R11.leaving = false;
    if (!story.spray) setTimeout(() => { if (mode === 'room11' && !story.spray) bark('friend', 'Psst! Over here!', 2.4); }, 700);
  }
  function startLounge() {
    mode = 'lounge'; enterRoom();
    LG.phase = story.sprayed ? 'out' : 'sneak'; LG.leaving = false; LG.t = 0; LG.tries = 0;
    LG.rich = { x: LG.richHome.x, y: LG.richHome.y, seated: false, walkT: 0, moving: false };
    resetLookers();
    banner(story.sprayed ? 'Now sneak back out!' : 'Sneak past the teachers to Mr. Richards\' chair!', 4);
    setTimeout(() => { if (mode === 'lounge' && LG.phase === 'sneak') bark('rich', 'Mmm, coffee.', 2); }, 900);
  }
  function resetLookers() {
    for (const w of LG.watchers) { w.look = false; w.warn = false; }
    LG.look = { who: -1, last: -1, phase: 'quiet', timer: 2.2 };
  }
  // Back to the hallway, outside a door, with the teacher gone.
  function startFree(x) {
    mode = 'hall'; hallMode = 'free';
    P.x = x; P.face = -1; P.hidden = null; P.frozen = false; P.target = null; P.vx = 0;
    jan.x = JAN_HOME; jan.looking = false; jan.warn = false; jan.saw = false;
    teacherH.state = 'gone'; teacherH.alpha = 0;
    chase = { state: 'free', timer: 0 };
    camX = clamp(P.x - W * 0.4, 0, HALL_W - W);
    barks.length = 0; dialog = null;
  }
  // Chapter 2 from the title screen.
  function startChapter2() {
    story.step = 'friend'; story.spray = false; story.sprayed = false;
    startFree(DOOR_X + 150); P.face = 1;
    banner('Mr. Richards went to the teachers\' lounge! Go find your best friend in Room 11.', 5);
  }

  // Leaving through the door on the right.
  const atDoor = () => me.x > C.right - 62 && Math.abs(me.y - C.door.y) < C.door.half;
  // Tap to walk; tap a person or thing to walk over and use it.
  function roomTap(things) {
    for (const th of things) if (Math.hypot(tap.x - th.x, tap.y - th.y) < th.r) { me.path = findPath(th.go[0], th.go[1]); me.act = th.act; me.stuck = 0; return; }
    me.path = findPath(tap.x, tap.y); me.act = null; me.stuck = 0;
  }

  // --- Room 11
  const friendSpot = () => [R11.friend.x - 150, R11.friend.y - 10];
  const nearFriend = () => Math.hypot(me.x - R11.friend.x, (me.y - R11.friend.y) * 1.3) < 200;
  function updateRoom11(dt) {
    layoutClass();
    if (gotItem) return;
    if (tap && !dialog) roomTap([{ x: R11.friend.x, y: R11.friend.y - 100, r: 130, go: friendSpot(), act: 'talk' }]);
    walkMe(dt, !dialog && !R11.leaving);
    if (Math.floor(t / 3) !== Math.floor((t - dt) / 3)) sfx.snore();
    if (dialog || R11.leaving) return;
    if (nearFriend() && use()) {
      if (story.spray) { bark('friend', 'Go get him!'); return; }
      me.face = me.x < R11.friend.x ? 1 : -1;
      say('Best friend', [
        'Oh, you have Mr. Richards? He\'s the absolute worst.',
        'I have Mr. Ben, he\'s pretty much as bad as Mr. Richards.',
        'Anyway, here\'s something I want to give you so you can finally get revenge on Mr. Richards.',
        'I hear he\'s going to give you 1000 tests!',
      ], () => {
        story.spray = true; story.step = 'lounge'; sfx.item();
        gotItem = { t: 0, done() { banner('Go to the Teachers\' Lounge!', 4); bark('friend', 'Go get him!'); } };
      });
    }
    if (atDoor()) { R11.leaving = true; sfx.door(); fadeTo(() => { startFree(ROOM11_X); if (story.spray) banner('Go to the Teachers\' Lounge!', 4); }); }
  }
  function drawRoom11(c) {
    layoutClass();
    R11.sketch.draw(c);
    drawSprite(c, IMG.door, C.right - 30, C.door.y - C.door.half - 4, 150);
    const items = [];
    const g = R11.group, f = R11.friend;
    items.push([g.y - 60, () => drawSprite(c, IMG.room11, g.x, g.y, g.h)]);
    items.push([f.y, () => drawSprite(c, IMG.friend, f.x, f.y, H_FRIEND, { bob: Math.abs(Math.sin(t * 1.6)) * 2 })]);
    for (const d of R11.desks) { items.push([d.y, () => drawDesk(c, d.x, d.y)]); items.push([d.y + SEAT_Y - 2, () => drawChair(c, d.x, d.y)]); }
    items.push([me.y, () => drawMe(c)]);
    items.sort((a, z) => a[0] - z[0]);
    for (const [, fn] of items) fn();
    // The teacher's asleep too.
    const gw = IMG.room11 ? IMG.room11.width * g.h / IMG.room11.height : 340;
    drawZzz(c, g.x - gw * 0.3, g.y - g.h * 0.72);
    if (!dialog && !fadeDir && !gotItem) {
      if (!story.spray) {
        drawRing(c, f.x, f.y - 10, 130, 44, t);
        if (nearFriend()) drawHideTag(c, f.x - 20, f.y - H_FRIEND - 50, 'Talk', t);
      } else drawRing(c, C.door.x - 10, C.door.y, 60, 95, t);
    }
    drawRoomBarks(c, (who) => (who === 'friend' ? [f.x, f.y - H_FRIEND + 10] : [me.x, me.y - H_KID]));
  }
  function drawMe(c) {
    drawSprite(c, IMG[hero], me.x, me.y, H_KID, {
      flip: heroFlip(me.face), bob: me.moving ? Math.abs(Math.sin(me.walkT * 11)) * 5 : 0, tilt: me.moving ? Math.sin(me.walkT * 11) * 0.05 : 0,
    });
  }
  function drawRoomBarks(c, pos) {
    for (const bk of barks) { const p = pos(bk.who); drawBubble(c, p[0], p[1], bk.text); }
  }

  // --- The lounge
  const nearChair = () => Math.hypot(me.x - LG.chair.x, me.y - (LG.chair.y + 30)) < 150;
  function inSight(w) {
    const dx = (me.x - w.x) / LOOK_R, dy = (me.y - (w.y + w.zy)) / (LOOK_R * 0.75);
    return dx * dx + dy * dy < 1;
  }
  function updateLounge(dt) {
    layoutClass();
    LG.t += dt;
    const sneaking = LG.phase === 'sneak' || LG.phase === 'out';
    if (tap && !dialog && sneaking) {
      roomTap(LG.phase === 'sneak' ? [{ x: LG.chair.x, y: LG.chair.y, r: 90, go: [LG.chair.x + 20, LG.chair.y + 96], act: 'spray' }] : []);
    }
    walkMe(dt, sneaking && !dialog && !LG.leaving);

    // The teachers take turns looking up from their coffee, one at a time, with
    // a "?" first so you know to get out of the way.
    if (sneaking) {
      const L = LG.look;
      L.timer -= dt;
      if (L.timer <= 0) {
        if (L.phase === 'quiet') {
          let i; do i = Math.floor(Math.random() * LG.watchers.length); while (i === L.last && LG.watchers.length > 1);
          L.who = i; L.phase = 'warn'; L.timer = 0.9; LG.watchers[i].warn = true;
        } else if (L.phase === 'warn') {
          const w = LG.watchers[L.who]; w.warn = false; w.look = true; L.phase = 'look'; L.timer = 1.7 + Math.random() * 0.6;
        } else {
          LG.watchers[L.who].look = false; L.last = L.who; L.who = -1; L.phase = 'quiet'; L.timer = 1.8 + Math.random() * 1.2;
        }
      }
      const seer = LG.watchers.find((w) => w.look && inSight(w));
      if (seer && !LG.leaving) {
        LG.phase = 'caught'; LG.tries++; sfx.gasp(); me.path = null;
        bark(seer.id, 'Hey! No kids in the teachers\' lounge!', 2.4);
        const after = story.sprayed ? 'out' : 'sneak';
        setTimeout(() => fadeTo(() => {
          // Back to the door, or back by the chair if you'd already sprayed it.
          if (after === 'out') { me.x = LG.chair.x + 20; me.y = LG.chair.y + 96; } else { me.x = C.right - 80; me.y = C.door.y; }
          me.path = null; LG.phase = after; barks.length = 0; resetLookers();
        }), 1600);
        return;
      }
    }

    if (LG.phase === 'sneak' && nearChair() && use()) {
      story.sprayed = true; LG.phase = 'out'; LG.sprayT = 0; sfx.spray(); me.path = null;
      me.face = me.x < LG.chair.x ? 1 : -1;
      banner('Pssssst! Now sneak back out!', 3.5);
    }
    if (LG.sprayT !== undefined) LG.sprayT += dt;
    if (sneaking && !LG.leaving && atDoor()) {
      if (LG.phase === 'out') startEnding();
      else { LG.leaving = true; sfx.door(); fadeTo(() => startFree(LOUNGE_X)); }
    }
    if (LG.phase === 'ending') updateEnding(dt);
  }

  // You made it out: peek back in through the door and watch.
  function startEnding() {
    LG.phase = 'ending'; LG.t = 0; LG.step = 0;
    me.x = C.right - 34; me.y = C.door.y; me.face = -1; me.path = null; me.moving = false;
    for (const w of LG.watchers) { w.look = false; w.warn = false; }
    sfx.door();
  }
  function updateEnding(dt) {
    const R = LG.rich, ch = LG.chair, T = LG.t;
    const at = (k, s) => { if (LG.step === k && T >= s) { LG.step++; return true; } return false; };
    if (at(0, 0.8)) bark('rich', 'Ahh. Time to sit down with my coffee.', 2.4);
    at(1, 2.6); // then he heads for his chair
    if (LG.step >= 2 && !R.seated) {
      const tx = ch.x, ty = ch.y - 20, dx = tx - R.x, dy = ty - R.y, d = Math.hypot(dx, dy);
      R.moving = true; R.walkT += dt;
      if (d > 130 * dt) { R.x += dx / d * 130 * dt; R.y += dy / d * 130 * dt; }
      else { R.seated = true; R.moving = false; R.x = ch.x; R.y = ch.y + 26; LG.sitT = T; }
    }
    if (R.seated) {
      if (at(2, LG.sitT + 0.5)) { sfx.fart(); LG.stinkT = 0; }
      if (at(3, LG.sitT + 1.6)) { bark('w1', 'P.U.! You stink!', 3.2); bark('w2', 'P.U.! You stink!', 3.2); sfx.gasp(); }
      if (at(4, LG.sitT + 2.4)) bark('w0', 'P.U.!', 2.6);
      if (at(5, LG.sitT + 5.4)) fadeTo(() => { mode = 'won'; wonSel = 0; sfx.win(); });
    }
    if (LG.stinkT !== undefined) LG.stinkT += dt;
  }

  function drawLounge(c) {
    layoutClass();
    LG.sketch.draw(c);
    drawSprite(c, IMG.door, C.right - 30, C.door.y - C.door.half - 4, 150);
    const R = LG.rich, ch = LG.chair, ending = LG.phase === 'ending';
    const items = [];
    for (const w of LG.watchers) {
      // In the ending they all turn to look at Mr. Richards.
      const face = ending && R.seated ? Math.sign(ch.x - w.x) : w.face;
      items.push([w.y, () => drawSprite(c, IMG[w.img], w.x, w.y, w.h, { flip: w.img !== 'lounge-table' && face < 0, tilt: w.look ? 0 : Math.sin(t * 1.5 + w.x) * 0.015 })]);
    }
    items.push([ch.y, () => {
      LG.seat.draw(c);
      if (R.seated) drawSprite(c, IMG['teacher-back'], R.x, R.y, H_TEACH_BACK);
      LG.back.draw(c);
    }]);
    if (!R.seated) items.push([R.y, () => {
      if (R.moving) drawSprite(c, IMG.teacher, R.x, R.y, H_TEACH, { bob: Math.abs(Math.sin(R.walkT * 9)) * 5 });
      else drawSprite(c, IMG['teacher-back'], R.x, R.y, H_TEACH_BACK, { tilt: Math.sin(t * 2) * 0.02 });
    }]);
    items.push([me.y, () => drawMe(c)]);
    items.sort((a, z) => a[0] - z[0]);
    // Where a teacher who's looking up can see, drawn on the floor under everyone.
    for (const w of LG.watchers) if (w.look || w.warn) drawLookZone(c, w);
    for (const [, fn] of items) fn();

    // Fart spray on the chair, and the stink once he sits down.
    if (story.sprayed && mode === 'lounge') drawStink(c, ch.x, R.seated ? ch.y - 40 : ch.y - 10, LG.stinkT !== undefined ? 1 : 0.35, LG.stinkT || t, R.seated ? 70 : 30);
    for (const w of LG.watchers) {
      const mx = w.x + w.markX, my = w.y - w.h - 24;
      if (LG.phase === 'caught' && w.look) drawMark(c, mx, my, '!');
      else if (w.warn) drawMark(c, mx, my, '?');
      else if (w.look) drawPeekEyes(c, mx, my);
      else if (ending && LG.step >= 4) drawMark(c, mx, my, '!');
    }
    if (!dialog && !fadeDir) {
      if (LG.phase === 'sneak') {
        drawRing(c, ch.x, ch.y + 10, 90, 70, t);
        if (nearChair()) drawHideTag(c, ch.x, ch.y - 120, 'Spray', t);
      } else if (LG.phase === 'out') drawRing(c, C.door.x - 10, C.door.y, 60, 95, t);
    }
    drawRoomBarks(c, (who) => {
      if (who === 'rich') return [R.x, R.y - H_TEACH + 10];
      const w = LG.watchers.find((v) => v.id === who);
      return w ? [w.x + w.markX, w.y - w.h + 10] : [me.x, me.y - H_KID];
    });
  }
  function drawLookZone(c, w) {
    c.save();
    c.fillStyle = w.look ? (LG.phase === 'caught' ? 'rgba(0,0,0,.16)' : 'rgba(0,0,0,.08)') : 'rgba(0,0,0,.03)';
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 3; c.setLineDash([12, 12]); c.lineDashOffset = -t * 30;
    c.beginPath(); c.ellipse(w.x, w.y + w.zy, LOOK_R, LOOK_R * 0.75, 0, 0, 7); c.fill(); if (w.look) c.stroke();
    c.restore();
  }
  // Green stink lines wiggling up, like a cartoon.
  function drawStink(c, x, y, k, time, spread = 30) {
    c.save(); c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const p = (time * 0.5 + i / 3) % 1, h = 60 + k * 70;
      c.globalAlpha = (1 - p) * (0.4 + k * 0.6);
      c.strokeStyle = '#5c9a2a'; c.lineWidth = 4 + k * 2;
      c.beginPath();
      const bx = x + (i - 1) * spread;
      for (let s = 0; s <= 10; s++) { const yy = y - p * h - s * (6 + k * 4); const xx = bx + Math.sin(s * 0.9 + time * 4 + i) * (6 + k * 6); s ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
      c.stroke();
    }
    c.restore();
  }
  // The fart spray can, drawn like a marker doodle.
  function drawSprayCan(c, x, y, s = 1) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.lineWidth = 4; c.strokeStyle = INK; c.lineJoin = 'round';
    c.fillStyle = '#b7e07a'; roundRect(c, -22, -40, 44, 80, 8); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(-14, -48, 28, 10); c.strokeRect(-14, -48, 28, 10);
    c.fillStyle = INK; c.fillRect(-4, -58, 10, 10); c.fillRect(6, -55, 8, 4);
    c.font = font(11); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FART', 0, -10); c.fillText('SPRAY', 0, 6);
    c.restore();
  }

  // "You got the Fart Spray!"
  let gotItem = null; // { t, done }
  function updateGotItem(dt) {
    gotItem.t += dt;
    if (gotItem.t > 0.7 && (hit('confirm') || tap)) { const g = gotItem; gotItem = null; sfx.ok(); g.done && g.done(); }
  }
  function drawGotItem(c) {
    const k = Math.min(1, gotItem.t * 4);
    c.save();
    c.fillStyle = `rgba(255,255,255,${0.7 * k})`; c.fillRect(0, 0, W, H);
    c.globalAlpha = k;
    const bw = 620, bh = 330, bx = (W - bw) / 2, by = 150;
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 6;
    roundRect(c, bx, by, bw, bh, 26); c.fill(); c.stroke();
    drawSprayCan(c, W / 2, by + 120 + Math.sin(t * 4) * 6, 1.4);
    drawStink(c, W / 2 + 34, by + 64, 0.3, t);
    c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = font(42, 'normal'); c.fillText('You got the Fart Spray!', W / 2, by + 230);
    c.font = font(26, 'normal'); c.fillText('Spray it on Mr. Richards\' chair.', W / 2, by + 280);
    c.restore();
    if (gotItem.t > 0.7) drawPrompts(c, [['confirm', 'OK']], W / 2, by + bh + 50, 'center', 36);
  }
  // A little box in the corner showing what you're carrying.
  function drawInventory(c) {
    if (!story.spray || story.sprayed && mode !== 'lounge') return;
    c.save();
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 4;
    roundRect(c, 16, 14, 70, 86, 14); c.fill(); c.stroke();
    c.restore();
    drawSprayCan(c, 51, 64, 0.75);
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
    ['Play chapter 2 again', () => fadeTo(startChapter2)],
    ['Pick the other girl', () => { pickSel = hero === 'girl1' ? 1 : 0; mode = 'pick'; }],
    ['All games', () => { location.href = '/'; }],
  ];
  function updateWon() {
    if (hit('up')) { wonSel = (wonSel + WON_ITEMS.length - 1) % WON_ITEMS.length; sfx.move(); }
    if (hit('down')) { wonSel = (wonSel + 1) % WON_ITEMS.length; sfx.move(); }
    const tapped = menuTap(330, WON_ITEMS.length);
    if (tapped >= 0) wonSel = tapped;
    if (hit('confirm') || tapped >= 0) { sfx.ok(); WON_ITEMS[wonSel][1](); }
  }
  function drawWon(c) {
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK;
    c.font = font(84, 'normal'); c.fillText('You got revenge!', W / 2, 100);
    c.font = font(34, 'normal'); c.fillText('Mr. Richards sat right in the Fart Spray. P.U.!', W / 2, 180);
    c.font = font(30, 'normal'); c.fillText('To be continued!', W / 2, 230);
    drawSprite(c, IMG[hero], W / 2 - 360, 640, 380, { bob: Math.abs(Math.sin(t * 7)) * 18 });
    drawSprite(c, IMG.teacher, W / 2 + 370, 660, 400);
    drawStink(c, W / 2 + 370, 250, 1, t);
    drawMenu(c, WON_ITEMS.map((i) => i[0]), wonSel, W / 2, 330);
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
      [`Buttons: ${PAD_STYLES.find((p) => p[0] === save.pad)[1]}`, () => {
        const i = PAD_STYLES.findIndex((p) => p[0] === save.pad);
        save.pad = PAD_STYLES[(i + 1) % PAD_STYLES.length][0]; writeSave();
        if (device !== 'keyboard') device = save.pad !== 'auto' ? save.pad : padFamily(padId);
      }],
      ['Start over', () => { paused = false; mode = 'title'; dialog = null; barks.length = 0; }],
      ['All games', () => { location.href = '/'; }],
    ];
  }
  function updatePause() {
    const items = pauseItems();
    if (hit('up')) { pauseSel = (pauseSel + items.length - 1) % items.length; sfx.move(); }
    if (hit('down')) { pauseSel = (pauseSel + 1) % items.length; sfx.move(); }
    const tapped = menuTap(210, items.length);
    if (tapped >= 0) pauseSel = tapped;
    if (hit('confirm') || tapped >= 0) { sfx.blip(); items[pauseSel][1](); }
    else if (hit('back') || hit('pause')) paused = false;
  }
  // A menu button in the corner for touch screens.
  function drawPauseButton(c) {
    c.save();
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 4;
    roundRect(c, W - 72, 14, 56, 56, 14); c.fill(); c.stroke();
    c.fillStyle = INK; c.fillRect(W - 54, 30, 7, 24); c.fillRect(W - 41, 30, 7, 24);
    c.restore();
  }
  function drawPause(c) {
    c.save();
    c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(0, 0, W, H);
    c.font = font(64, 'normal'); c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('Paused', W / 2, 110);
    drawMenu(c, pauseItems().map((i) => i[0]), pauseSel, W / 2, 210);
    if (padId) {
      c.font = font(18, 'normal'); c.fillStyle = '#666';
      c.fillText(`Controller: ${padId.slice(0, 90)}`, W / 2, H - 30);
    }
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
    const playing = ['hall', 'class', 'room11', 'lounge'].includes(mode);
    const pauseTap = tapIn(W - 84, 0, 84, 84) && playing;
    if ((hit('pause') || pauseTap) && playing && !dialog && !gotItem) { paused = true; pauseSel = 0; sfx.blip(); return; }
    if (pauseTap) tap = null;
    if (gotItem) { updateGotItem(dt); return; }
    if (dialog) { updateDialog(dt); tap = null; if (mode === 'class') updateClass(dt); return; }
    if (mode === 'title') updateTitle();
    else if (mode === 'pick') updatePick();
    else if (mode === 'hall') updateHall(dt);
    else if (mode === 'class') updateClass(dt);
    else if (mode === 'room11') updateRoom11(dt);
    else if (mode === 'lounge') updateLounge(dt);
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
      if (!dialog && !paused && device !== 'touch') {
        const list = hallMode !== 'chase' ? [['leftright', 'Walk'], ['pause', 'Menu']] : [['leftright', 'Run'], ['confirm', 'Hide'], ['pause', 'Menu']];
        drawPrompts(ctx, list, W - 24, H - 30, 'right', 30);
      }
    } else if (mode === 'class') {
      drawClass(ctx);
      if (!dialog && !paused && device !== 'touch' && (cls.phase === 'enter' || (cls.phase === 'escape' && !me.seated))) drawPrompts(ctx, [['move', 'Walk'], ['pause', 'Menu']], W - 24, H - 30, 'right', 30);
    } else if (mode === 'room11' || mode === 'lounge') {
      if (mode === 'room11') drawRoom11(ctx); else drawLounge(ctx);
      const walking = mode === 'room11' || LG.phase === 'sneak' || LG.phase === 'out';
      if (!dialog && !paused && !gotItem && device !== 'touch' && walking) drawPrompts(ctx, [['move', 'Walk'], ['pause', 'Menu']], W - 24, H - 30, 'right', 30);
    } else if (mode === 'won') drawWon(ctx);
    if (['hall', 'room11', 'lounge'].includes(mode)) drawInventory(ctx);
    if (device === 'touch' && ['hall', 'class', 'room11', 'lounge'].includes(mode) && !paused) drawPauseButton(ctx);
    drawBanner(ctx);
    if (dialog) drawDialog(ctx);
    if (gotItem) drawGotItem(ctx);
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
    get state() { return { mode, hallMode, hero, story: { ...story }, lounge: { phase: LG.phase, step: LG.step, rich: LG.rich && { ...LG.rich } }, teach: { ...teach }, P: { ...P, hidden: P.hidden && P.hidden.kind }, me: { ...me }, cls: { ...cls }, chase: chase && { ...chase }, teacher: { ...teacherH }, jan: { ...jan }, dialog: dialog && dialog.pages[dialog.page], device }; },
    startHall, startClass, startChase, startChapter2, startRoom11, startLounge, startFree, setHero(h) { hero = h; },
    layout: () => ({ C, R11, LG }), get W() { return W; }, setMe(x, y) { me.x = x; me.y = y; },
    giveSpray() { story.spray = true; story.step = 'lounge'; },
    hide(i) { P.hidden = SPOTS[i]; P.x = SPOTS[i].x; chase.state = 'hidden'; },
    calm() { for (const w of LG.watchers) { w.look = false; w.warn = false; } LG.look.phase = 'quiet'; LG.look.timer = 99; },
  };
})();
