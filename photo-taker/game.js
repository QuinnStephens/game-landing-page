// Photo Taker: walk around with a camera and take pictures. Don't wake the bears!
// Plain canvas 2D, no libraries. All art is cut out of Violeta's drawings in assets/;
// including the clothes in the shops (see ITEMS).
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

  // ---------------------------------------------------------------------------
  // Art
  const IMG = {};
  const ART = ['boy', 'girl', 'dog', 'rabbit', 'mom', 'dad', 'bear', 'bear-blank', 'fancy-shop', 'cool-shop',
    'sun', 'cloud', 'cloud2', 'flower', 'bush', 'ground', 'tree', 'cool-world', 'bear-sign'];
  function loadImage(src) {
    return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  }
  const loading = Promise.all([
    ...ART.map((n) => loadImage(`assets/${n}.png`).then((i) => { IMG[n] = i; })),
    loadImage('assets/title.jpg').then((i) => { IMG.title = i; }),
  ]);

  // ---------------------------------------------------------------------------
  // Saving (photos, clothes, photo book). Browser storage can be missing, so
  // everything still works without it.
  const SAVE_KEY = 'photo-taker-save-v1';
  let save = { photos: [], owned: [], wear: { boy: {}, girl: {} }, found: [], sound: true };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') save = { ...save, ...s, wear: { boy: {}, girl: {}, ...(s.wear || {}) } };
  } catch { /* no saved game */ }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {
      // Too big? Drop the oldest photos and try once more.
      try { save.photos = save.photos.slice(-12); localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* give up */ }
    }
  }
  const photos = []; // { canvas, subjects }
  for (const p of save.photos) {
    const img = new Image(); img.src = p.url;
    photos.push({ canvas: img, subjects: p.subjects || [] });
  }

  // ---------------------------------------------------------------------------
  // Input: keyboard and gamepads, mapped to actions. The last thing the player
  // touched decides which button pictures the prompts show.
  const KEYS = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    confirm: ['KeyE', 'Enter'], back: ['Escape', 'Backspace'], run: ['ShiftLeft', 'ShiftRight'],
    photo: ['Space'], album: ['KeyQ'], pause: ['Escape'], fullscreen: ['KeyF'],
  };
  const KEY_LABEL = { confirm: 'E', back: 'Esc', run: 'Shift', photo: 'Space', album: 'Q', pause: 'Esc', fullscreen: 'F' };
  // Standard gamepad layout: 0 bottom, 1 right, 2 left, 3 top face button, 7 right trigger, 9 start.
  const PAD = {
    left: [14], right: [15], up: [12], down: [13],
    confirm: [0], back: [1], run: [1], photo: [2, 7], album: [3], pause: [9], fullscreen: [3],
  };
  const PAD_FACE = { confirm: 'south', back: 'east', run: 'east', photo: 'west', album: 'north', fullscreen: 'north', pause: 'start' };

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
    moveX = Math.max(-1, Math.min(1, ax + (held.right ? 1 : 0) - (held.left ? 1 : 0)));
    moveY = Math.max(-1, Math.min(1, ay + (held.down ? 1 : 0) - (held.up ? 1 : 0)));
    keysHit.clear();
  }
  const hit = (a) => held[a] && !prevHeld[a];
  // In menus Space also means OK, so keyboard players can use one hand.
  const ok = () => hit('confirm') || (device === 'keyboard' && hit('photo'));
  // Escape is both "back" and "pause"; pausing only happens while walking around.
  const backHit = () => hit('back') || (device !== 'keyboard' && hit('pause'));

  // Mouse/touch: tap to pick on the title screen, otherwise treated like OK.
  let tapped = null;
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    tapped = { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    unlockAudio();
  });

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else {
        const p = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        if (p && p.catch) p.catch(() => toast('Press F11 for fullscreen'));
      }
    } catch { toast('Press F11 for fullscreen'); }
  }

  // ---------------------------------------------------------------------------
  // Sound: tiny synth noises, no files.
  let ac = null;
  function unlockAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; }
  }
  function tone(freq, dur, type = 'square', vol = 0.08, slideTo = 0) {
    if (!ac || !save.sound) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
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
    shutter() { noise(0.05, 0.35, 4000); setTimeout(() => noise(0.08, 0.25, 2500), 70); },
    roar() { tone(140, 0.9, 'sawtooth', 0.12, 55); noise(0.7, 0.15, 500, 'lowpass'); },
    blip() { tone(520 + Math.random() * 120, 0.05, 'square', 0.04); },
    move() { tone(660, 0.05, 'triangle', 0.06); },
    get() { tone(660, 0.12, 'triangle', 0.1); setTimeout(() => tone(990, 0.2, 'triangle', 0.1), 110); },
    door() { tone(400, 0.12, 'triangle', 0.08, 600); },
    huff() { noise(0.25, 0.12, 700, 'lowpass'); },
    oof() { tone(300, 0.3, 'square', 0.06, 120); },
    found() { tone(784, 0.1, 'triangle', 0.08); setTimeout(() => tone(1047, 0.1, 'triangle', 0.08), 90); setTimeout(() => tone(1319, 0.18, 'triangle', 0.08), 180); },
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
  // Marker-style ink: fill, then stroke the outline twice slightly offset so it
  // looks hand drawn like the rest of the art.
  function ink(c, path, fill, stroke = '#111', lw = 8) {
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    path(c);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) {
      c.strokeStyle = stroke; c.lineWidth = lw; c.stroke();
      c.translate(2, -1.5); c.globalAlpha = 0.55; path(c); c.stroke();
    }
    c.restore();
  }
  // A wobbly scribble line, for highlights and the ground.
  function scribbleRect(c, x, y, w, h, color, lw = 7, seed = 1) {
    const r = rng(seed);
    c.save(); c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
      pts.forEach(([px, py], i) => {
        const jx = (r() - 0.5) * 8, jy = (r() - 0.5) * 8;
        if (i === 0) c.moveTo(px + jx, py + jy); else c.lineTo(px + jx, py + jy);
      });
      c.stroke();
    }
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Clothes, cut out of Violeta's drawings of the shop racks (assets/clothes/).
  // slot: 'top' (shirts, jackets, dresses), 'legs' (pants, skirts) or 'head'.
  const ITEMS = [
    { id: 'fancy-purple', name: 'Purple Dress', shop: 'fancy', slot: 'top' },
    { id: 'fancy-red', name: 'Red Top', shop: 'fancy', slot: 'top' },
    { id: 'fancy-heart', name: 'Heart Dress', shop: 'fancy', slot: 'top' },
    { id: 'fancy-black', name: 'Black Jacket', shop: 'fancy', slot: 'top' },
    { id: 'fancy-green', name: 'Green Dress', shop: 'fancy', slot: 'top' },
    { id: 'fancy-yellow', name: 'Yellow Pants', shop: 'fancy', slot: 'legs' },
    { id: 'fancy-pink', name: 'Pink Skirt', shop: 'fancy', slot: 'legs' },
    { id: 'fancy-cyan', name: 'Blue Skirt', shop: 'fancy', slot: 'legs' },
    { id: 'cool-hero', name: 'Hero Shirt', shop: 'cool', slot: 'top' },
    { id: 'cool-jacket', name: 'Black Shirt', shop: 'cool', slot: 'top' },
    { id: 'cool-black', name: 'Black Pants', shop: 'cool', slot: 'legs' },
    { id: 'cool-red', name: 'Red Pants', shop: 'cool', slot: 'legs' },
    { id: 'cool-redpants', name: 'Skinny Red Pants', shop: 'cool', slot: 'legs' },
    { id: 'cool-blue', name: 'Blue Pants', shop: 'cool', slot: 'legs' },
    { id: 'cool-swirl', name: 'Swirly Hat', shop: 'cool', slot: 'head' },
  ];
  const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
  for (const it of ITEMS) loadImage(`assets/clothes/${it.id}.png`).then((i) => { it.img = i; });
  const RACKS = {};
  for (const r of ['fancy', 'cool']) loadImage(`assets/clothes/rack-${r}.png`).then((i) => { RACKS[r] = i; });
  // Older saves had placeholder clothes; forget any that no longer exist.
  save.owned = save.owned.filter((id) => ITEM[id]);
  for (const kid of ['boy', 'girl']) {
    const wear = save.wear[kid];
    for (const slot in wear) if (!ITEM[wear[slot]] || ITEM[wear[slot]].slot !== slot) delete wear[slot];
  }

  // Where things go on each kid, as fractions of the drawing's width and height.
  // top: [center x, top y, width] of the shirt area. legs: [center x, top y, height]
  // from the hips to the feet. head: [center x, top of head, width]. hand: camera.
  const KIDS = {
    boy: { label: 'Boy', h: 200, pet: 'dog', petLabel: 'Dog', petH: 95,
      top: [0.46, 0.38, 0.62], legs: [0.45, 0.62, 0.36], head: [0.47, 0.09, 0.6], hand: [0.96, 0.67] },
    girl: { label: 'Girl', h: 225, pet: 'rabbit', petLabel: 'Rabbit', petH: 115,
      top: [0.47, 0.44, 0.6], legs: [0.47, 0.7, 0.27], head: [0.5, 0.17, 0.6], hand: [0.97, 0.6] },
  };
  const SLOTS = ['legs', 'top', 'head'];

  // Draws a kid with their feet at (0, 0) of the current transform, facing right.
  function drawKidAt(c, kid, h, wear, opts = {}) {
    const img = IMG[kid]; if (!img) return;
    const K = KIDS[kid], w = h * img.width / img.height;
    const at = (slot) => [-w / 2 + K[slot][0] * w, -h + K[slot][1] * h];
    const put = (id) => {
      const it = ITEM[id]; if (!it || !it.img) return;
      const size = K[it.slot][2], [x, y] = at(it.slot);
      const iw = it.img.width, ih = it.img.height;
      let dw, dh;
      if (it.slot === 'legs') { dh = size * h; dw = Math.min(dh * iw / ih, w * 0.75); dh = dw * ih / iw; }
      else { dw = size * w; dh = dw * ih / iw; }
      c.drawImage(it.img, x - dw / 2, it.slot === 'head' ? y - dh * 0.75 : y, dw, dh);
    };
    const worn = { ...wear };
    if (opts.tryOn) worn[ITEM[opts.tryOn].slot] = opts.tryOn;
    c.drawImage(img, -w / 2, -h, w, h);
    for (const slot of SLOTS) if (worn[slot]) put(worn[slot]);
    if (opts.camera) {
      const [x, y] = at('hand');
      c.save(); c.translate(x + 6, y - 4); c.rotate(-0.05);
      ink(c, (c) => roundRect(c, -4, -18, 40, 30, 6), '#222', '#000', 4);
      ink(c, (c) => { c.beginPath(); c.arc(18, -3, 9, 0, 7); }, '#9fd8ff', '#000', 3);
      c.fillStyle = opts.flash ? '#fff' : '#ff2a2a'; c.fillRect(26, -24, 9, 6);
      c.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // The world
  const GROUND = 642;
  const WORLD_W = 8400;
  // Things in the Photo Book, in the order they're listed.
  const SUBJECTS = [
    ['mom', 'Mom'], ['dad', 'Dad'], ['pet', 'My Pet'], ['tree', 'Tree'], ['flower', 'Flower'], ['bush', 'Bush'],
    ['sun', 'Sun'], ['cloud', 'Cloud'], ['coolworld', 'Cool World'], ['fancy', 'Fancy Shop'], ['cool', 'Cool Shop'],
    ['sign', 'Bear Sign'], ['bearSleep', 'Sleeping Bear'], ['bearAngry', 'Angry Bear'], ['bearTired', 'Tired Bear'],
  ];
  const SUBJECT_NAME = Object.fromEntries(SUBJECTS);

  const props = [
    // [art, x, height, subject]
    ['tree', 180, 340, 'tree'], ['flower', 330, 150, 'flower'], ['bush', 880, 70, 'bush'],
    ['tree', 1150, 300, 'tree'], ['cool-world', 1700, 380, 'coolworld'], ['flower', 2050, 140, 'flower'],
    ['fancy-shop', 2500, 440, 'fancy'], ['cool-shop', 3100, 380, 'cool'], ['bush', 3450, 80, 'bush'],
    ['tree', 3700, 330, 'tree'], ['bear-sign', 4150, 200, 'sign'], ['flower', 4420, 130, 'flower'],
    ['tree', 5400, 350, 'tree'], ['bush', 5700, 70, 'bush'], ['flower', 5950, 160, 'flower'],
    ['tree', 6300, 300, 'tree'], ['flower', 7600, 140, 'flower'], ['tree', 7950, 360, 'tree'], ['bush', 8200, 90, 'bush'],
  ];
  const shops = [
    { id: 'fancy', name: 'Fancy Shop', x: 2500, color: '#ffe3f6', ink: '#ff1aa8' },
    { id: 'cool', name: 'Cool Shop', x: 3100, color: '#dff7ff', ink: '#1d4cff' },
  ];

  let hero = 'boy';
  const player = { x: 820, vx: 0, facing: 1, walkT: 0, aimUp: 0, knock: 0, flash: 0 };
  const pet = { x: 720, vx: 0, facing: 1, hopT: 0 };
  const npcs = [
    { id: 'mom', art: 'mom', x: 470, h: 215, talks: 0 },
    { id: 'dad', art: 'dad', x: 640, h: 230, talks: 0 },
  ];
  const bears = [
    { homeX: 4900, x: 4900, state: 'sleep', t: 0, stamina: 0, dir: -1 },
    { homeX: 7100, x: 7100, state: 'sleep', t: 0, stamina: 0, dir: -1 },
  ];
  const BEAR_H = 230;
  let camX = 0;
  let chasedCount = 0;

  // ---------------------------------------------------------------------------
  // Game modes: title, play, talk, sign, shop, album, view, pause
  let mode = 'loading';
  let menuSel = 0;
  let time = 0;
  const toasts = [];
  function toast(text) { toasts.push({ text, t: 0 }); if (toasts.length > 2) toasts.shift(); }

  let titleSel = 0;
  let dialog = null;   // { who, art, lines, i, shown }
  let shopUI = null;   // { shop, items, sel }
  let albumSel = 0, viewIdx = 0;
  let pendingPhoto = false;
  let lastPhoto = null; // { canvas, t, subjects }
  let shotList = [];   // things on screen this frame, for working out what's in a photo

  function startGame(kid) {
    hero = kid;
    player.x = 820; player.facing = 1; player.knock = 0;
    pet.x = 720;
    for (const b of bears) { b.x = b.homeX; b.state = 'sleep'; }
    camX = clamp(player.x - W / 2, 0, WORLD_W - W);
    mode = 'play';
    sfx.get();
  }

  // ---------------------------------------------------------------------------
  // Talking
  function momLines() {
    const wearing = Object.values(save.wear[hero] || {}).filter(Boolean).map((id) => ITEM[id] && ITEM[id].name);
    const L = [];
    if (npcs[0].talks === 0) L.push(['Hi sweetie! Did you bring your camera?', 'Go take lots of pictures today!']);
    if (wearing.length) L.push([`Ooh, I love your ${wearing[0].toLowerCase()}!`, 'You look so fancy.']);
    if (chasedCount > 0) L.push(['A bear chased you?!', 'Remember, if you run fast the bear gets tired and stops.']);
    L.push(['The shops are that way.', 'Everything in the shops is free today. Get whatever you want!']);
    L.push(['Be careful with the sleeping bears.', "They don't like having their picture taken!"]);
    L.push([`Give ${hero === 'boy' ? 'the dog' : 'the bunny'} a hug for me.`]);
    return L[npcs[0].talks === 0 ? 0 : 1 + Math.floor(Math.random() * (L.length - 1))] || L[0];
  }
  function dadLines() {
    const n = photos.length, found = save.found.length;
    const L = [];
    if (npcs[1].talks === 0) L.push(['Hey kiddo!', 'Want to fill up your Photo Book? Take a picture of everything!', 'Press {album} to look at your photos.']);
    L.push([n ? `You've taken ${n} picture${n === 1 ? '' : 's'}! Wow.` : "You haven't taken any pictures yet.", `That's ${found} of ${SUBJECTS.length} things in your Photo Book.`]);
    L.push(['Have you seen Cool World?', "It's so colorful. Take a picture of it!"]);
    L.push(['Bears are fast, but you can be faster.', 'Hold {run} to run!']);
    L.push(['Point the camera up at the sky with {up}.', 'You can take pictures of the sun and the clouds.']);
    if (chasedCount > 2) L.push(['Are you waking up the bears on purpose?', 'Ha ha! Me too when I was little.']);
    return L[npcs[1].talks === 0 ? 0 : 1 + Math.floor(Math.random() * (L.length - 1))] || L[0];
  }
  function talkTo(npc) {
    const lines = npc.id === 'mom' ? momLines() : dadLines();
    npc.talks++;
    dialog = { who: npc.id === 'mom' ? 'Mom' : 'Dad', art: npc.art, lines, i: 0, shown: 0 };
    mode = 'talk';
    sfx.blip();
  }

  // ---------------------------------------------------------------------------
  // Taking pictures
  function viewfinder() {
    const w = 440, h = 320;
    const cx = player.x - camX + player.facing * 250;
    const cy = lerp(GROUND - 125, 210, player.aimUp);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
  function takePhoto() {
    if (player.knock > 0) return;
    pendingPhoto = true;
  }
  // Called in the middle of drawing, after the world and before the HUD.
  function capturePhoto() {
    pendingPhoto = false;
    const vf = viewfinder();
    const pw = 360, ph = Math.round(360 * vf.h / vf.w);
    const pc = document.createElement('canvas'); pc.width = pw; pc.height = ph;
    const p = pc.getContext('2d');
    p.fillStyle = '#fff'; p.fillRect(0, 0, pw, ph);
    const k = scale * dpr;
    p.drawImage(canvas, vf.x * k, vf.y * k, vf.w * k, vf.h * k, 0, 0, pw, ph);
    // What's in it?
    const subjects = [];
    for (const s of shotList) {
      const ix = Math.max(0, Math.min(vf.x + vf.w, s.x + s.w) - Math.max(vf.x, s.x));
      const iy = Math.max(0, Math.min(vf.y + vf.h, s.y + s.h) - Math.max(vf.y, s.y));
      const a = ix * iy;
      if (a > 0.35 * s.w * s.h || a > 0.3 * vf.w * vf.h) {
        if (!subjects.includes(s.id)) subjects.push(s.id);
        if (s.bear && s.bear.state === 'sleep') wakeBear(s.bear);
      }
    }
    photos.push({ canvas: pc, subjects });
    lastPhoto = { canvas: pc, t: 0, subjects };
    player.flash = 1;
    sfx.shutter();
    const fresh = subjects.filter((id) => !save.found.includes(id));
    if (fresh.length) {
      save.found.push(...fresh);
      setTimeout(sfx.found, 250);
      toast(`New in your Photo Book: ${fresh.map(subjectLabel).join(', ')}!`);
      if (save.found.length === SUBJECTS.length) toast('You found everything! Photo Book complete!');
    }
    try {
      save.photos.push({ url: pc.toDataURL('image/jpeg', 0.75), subjects });
      if (save.photos.length > 40) save.photos.shift();
    } catch { /* keep the photo for now even if it can't be saved */ }
    if (photos.length > 60) photos.shift();
    writeSave();
  }
  function subjectLabel(id) { return id === 'pet' ? KIDS[hero].petLabel : SUBJECT_NAME[id] || id; }

  // ---------------------------------------------------------------------------
  // Bears
  const BEAR = { chase: 390, chaseTime: 5.5, tired: 3.5, back: 130 };
  function wakeBear(b) {
    b.state = 'wake'; b.t = 0; b.stamina = BEAR.chaseTime; b.dir = Math.sign(player.x - b.x) || -1;
    chasedCount++;
    setTimeout(sfx.roar, 150);
    toast('Uh oh! You woke up the bear! RUN!');
  }
  function updateBear(b, dt) {
    b.t += dt;
    const dx = player.x - b.x;
    switch (b.state) {
      case 'sleep': break;
      case 'wake': if (b.t > 1.2) { b.state = 'chase'; b.t = 0; } break;
      case 'chase':
        b.dir = Math.sign(dx) || b.dir;
        b.stamina -= dt;
        // Fast at first, slowing down as it gets tired.
        b.x += b.dir * BEAR.chase * (0.75 + 0.25 * clamp(b.stamina / BEAR.chaseTime, 0, 1) * 1.3) * dt;
        if (Math.abs(dx) < 80 && player.knock <= 0) {
          player.knock = 1.4; player.vx = b.dir * 500;
          b.state = 'roar'; b.t = 0;
          sfx.roar(); setTimeout(sfx.oof, 200);
          toast('Oof! The bear caught you.');
        } else if (b.stamina <= 0) {
          b.state = 'tired'; b.t = 0;
          toast('The bear is tired. Phew!');
        }
        break;
      case 'roar': if (b.t > 1.3) { b.state = 'back'; b.t = 0; } break;
      case 'tired':
        if (Math.floor(b.t * 2) !== Math.floor((b.t - dt) * 2)) sfx.huff();
        if (b.t > BEAR.tired) { b.state = 'back'; b.t = 0; }
        break;
      case 'back': {
        const d = b.homeX - b.x;
        b.dir = Math.sign(d) || b.dir;
        b.x += b.dir * Math.min(Math.abs(d), BEAR.back * dt);
        if (Math.abs(d) < 2) { b.state = 'sleep'; b.t = 0; }
        break;
      }
    }
    b.x = clamp(b.x, 100, WORLD_W - 100);
  }
  // The bear drawing faces left. Sleeping/tired bears use a copy with the face
  // painted out, and get a new face drawn on top.
  function drawBear(c, b) {
    const sleepy = b.state === 'sleep' || b.state === 'tired' || b.state === 'back';
    const img = sleepy ? IMG['bear-blank'] : IMG.bear; if (!img) return;
    const h = BEAR_H, w = h * img.width / img.height;
    const x = b.x - camX;
    let bob = 0, squash = 1, rot = 0;
    if (b.state === 'sleep') { squash = 0.86 + Math.sin(time * 2) * 0.02; rot = 0.08; }
    if (b.state === 'chase' || b.state === 'back') bob = -Math.abs(Math.sin(b.t * (b.state === 'chase' ? 14 : 7))) * 14;
    if (b.state === 'wake') bob = -Math.max(0, Math.sin(b.t * 9)) * 30;
    if (b.state === 'roar') { squash = 1 + Math.sin(b.t * 30) * 0.03; }
    if (b.state === 'tired') squash = 0.92 + Math.sin(time * 6) * 0.04;
    c.save();
    c.translate(x, GROUND + bob);
    // Faces left in the drawing, so flip when going right.
    if (b.dir > 0) c.scale(-1, 1);
    c.rotate(rot); c.scale(1, squash);
    c.drawImage(img, -w / 2, -h, w, h);
    // Face spots in the drawing (fractions of its size).
    const fx = (f) => -w / 2 + f * w, fy = (f) => -h + f * h;
    c.lineCap = 'round'; c.strokeStyle = '#111'; c.lineWidth = 7;
    if (b.state === 'sleep') {
      for (const ex of [0.29, 0.43]) { c.beginPath(); c.arc(fx(ex), fy(0.34), 15, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
      c.beginPath(); c.arc(fx(0.36), fy(0.48), 10, 0, Math.PI); c.stroke();
    } else if (b.state === 'tired') {
      for (const ex of [0.29, 0.43]) { c.beginPath(); c.moveTo(fx(ex) - 14, fy(0.33)); c.lineTo(fx(ex) + 14, fy(0.36)); c.stroke(); }
      c.beginPath(); c.ellipse(fx(0.36), fy(0.5), 16, 20, 0, 0, 7); c.stroke();
      c.fillStyle = '#ff5fa0'; c.beginPath(); c.ellipse(fx(0.36), fy(0.55), 9, 13, 0, 0, 7); c.fill();
    } else if (b.state === 'back') {
      c.fillStyle = '#111';
      for (const ex of [0.29, 0.43]) { c.beginPath(); c.arc(fx(ex), fy(0.34), 6, 0, 7); c.fill(); }
      c.beginPath(); c.moveTo(fx(0.31), fy(0.5)); c.lineTo(fx(0.41), fy(0.49)); c.stroke();
    }
    c.restore();
    // Extras that shouldn't flip: Zzz, "!", sweat, ROAR
    c.save();
    c.textAlign = 'center';
    if (b.state === 'sleep') {
      for (let i = 0; i < 3; i++) {
        const p = (time * 0.5 + i / 3) % 1;
        c.globalAlpha = 1 - p; c.fillStyle = '#1d4cff'; c.font = font(22 + p * 20);
        c.fillText('z', x - w * 0.15 + Math.sin(p * 6 + i) * 14 - p * 40, GROUND - h * 0.85 - p * 90);
      }
    } else if (b.state === 'wake') {
      c.fillStyle = '#ff1a1a'; c.font = font(70); c.fillText('!', x, GROUND - h - 10 + bob);
    } else if (b.state === 'roar') {
      c.fillStyle = '#ff1a1a'; c.font = font(54); c.fillText('ROAR!', x, GROUND - h - 10 + Math.sin(b.t * 30) * 4);
    } else if (b.state === 'tired') {
      c.fillStyle = '#26a8ff';
      for (let i = 0; i < 2; i++) { const p = (b.t * 1.2 + i * 0.5) % 1; c.globalAlpha = 1 - p; c.beginPath(); c.ellipse(x + (i ? 50 : -60), GROUND - h * 0.8 + p * 50, 7, 11, 0, 0, 7); c.fill(); }
      c.globalAlpha = 1; c.fillStyle = '#555'; c.font = font(28); c.fillText('huff... puff...', x, GROUND - h - 6);
    }
    c.restore();
    const id = b.state === 'sleep' ? 'bearSleep' : (b.state === 'tired' || b.state === 'back') ? 'bearTired' : 'bearAngry';
    shotList.push({ id, x: x - w / 2, y: GROUND - h * 0.9, w, h: h * 0.9, bear: b });
  }

  // ---------------------------------------------------------------------------
  // Update
  function nearThing() {
    for (const n of npcs) if (Math.abs(player.x - n.x) < 110) return { kind: 'npc', npc: n, x: n.x, h: n.h, label: 'Talk' };
    for (const s of shops) if (Math.abs(player.x - s.x) < 120) return { kind: 'shop', shop: s, x: s.x, h: 300, label: 'Go in' };
    const sign = props.find((p) => p[3] === 'sign');
    if (Math.abs(player.x - sign[1]) < 130) return { kind: 'sign', x: sign[1], h: sign[2] + 20, label: 'Read' };
    return null;
  }

  function updatePlay(dt) {
    // Hold up to point the camera at the sky.
    const aim = moveY < -0.5 ? 1 : 0;
    player.aimUp += clamp(aim - player.aimUp, -dt * 5, dt * 5);

    if (player.knock > 0) {
      player.knock -= dt;
      player.x += player.vx * dt; player.vx *= Math.pow(0.05, dt);
    } else {
      const running = held.run;
      const speed = running ? 470 : 280;
      const target = moveX * speed;
      player.vx = lerp(player.vx, target, Math.min(1, dt * 12));
      if (Math.abs(moveX) > 0.2) player.facing = Math.sign(moveX);
      player.x += player.vx * dt;
      if (Math.abs(player.vx) > 20) player.walkT += dt * (running ? 15 : 11) * Math.min(1, Math.abs(player.vx) / 280);
      else player.walkT = 0;

      const near = nearThing();
      if (hit('confirm') && near) {
        if (near.kind === 'npc') talkTo(near.npc);
        else if (near.kind === 'shop') openShop(near.shop);
        else if (near.kind === 'sign') { mode = 'sign'; sfx.blip(); }
      } else if (hit('photo')) takePhoto();
    }
    player.x = clamp(player.x, 60, WORLD_W - 60);
    player.flash = Math.max(0, player.flash - dt * 3);

    // The pet runs to a spot behind you.
    const spot = player.x - player.facing * 110;
    const d = spot - pet.x;
    const pspeed = clamp(Math.abs(d) * 4, 0, 560);
    pet.vx = Math.abs(d) > 8 ? Math.sign(d) * pspeed : 0;
    pet.x += pet.vx * dt;
    if (Math.abs(pet.vx) > 30) { pet.facing = Math.sign(pet.vx); pet.hopT += dt * 10; } else { pet.hopT = 0; pet.facing = player.facing; }

    for (const b of bears) updateBear(b, dt);

    const lead = player.facing * 140;
    camX = lerp(camX, clamp(player.x - W / 2 + lead, 0, WORLD_W - W), Math.min(1, dt * 4));

    if (hit('album')) { openAlbum(); return; }
    if (hit('pause')) { mode = 'pause'; menuSel = 0; sfx.blip(); }
  }

  function update(dt) {
    time += dt;
    pollInput();
    for (const t of toasts) t.t += dt;
    while (toasts.length && toasts[0].t > 3.5) toasts.shift();
    if (lastPhoto) { lastPhoto.t += dt; if (lastPhoto.t > 2.6) lastPhoto = null; }
    const tap = tapped; tapped = null;

    switch (mode) {
      case 'title': {
        if (hit('left') || hit('right')) { titleSel = 1 - titleSel; sfx.move(); }
        if (hit('fullscreen')) toggleFullscreen();
        if (tap) {
          const cards = titleCards();
          cards.forEach((r, i) => { if (tap.x > r.x && tap.x < r.x + r.w && tap.y > r.y && tap.y < r.y + r.h) { titleSel = i; startGame(i ? 'girl' : 'boy'); } });
        } else if (ok()) startGame(titleSel ? 'girl' : 'boy');
        break;
      }
      case 'play': updatePlay(dt); if (tap) takePhoto(); break;
      case 'talk': {
        const line = dialog.lines[dialog.i];
        const before = Math.floor(dialog.shown);
        dialog.shown = Math.min(line.length, dialog.shown + dt * 45);
        if (Math.floor(dialog.shown) !== before && Math.floor(dialog.shown) % 3 === 0) sfx.blip();
        if (ok() || backHit() || tap) {
          if (dialog.shown < line.length) dialog.shown = line.length;
          else if (++dialog.i >= dialog.lines.length) { dialog = null; mode = 'play'; }
          else dialog.shown = 0;
        }
        break;
      }
      case 'sign': if (ok() || backHit() || tap) mode = 'play'; break;
      case 'shop': updateShop(); break;
      case 'album': updateAlbum(); break;
      case 'view': {
        if (hit('left') && viewIdx > 0) { viewIdx--; sfx.move(); }
        if (hit('right') && viewIdx < photos.length - 1) { viewIdx++; sfx.move(); }
        if (backHit() || ok() || tap) { mode = 'album'; albumSel = viewIdx; }
        break;
      }
      case 'pause': updatePause(); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Shops (and the "My Clothes" closet, which is the same screen)
  function openShop(shop) {
    shopUI = { shop, items: ITEMS.filter((it) => it.shop === shop.id), sel: 0 };
    mode = 'shop';
    sfx.door();
    // Bears don't follow you into shops.
    for (const b of bears) if (b.state === 'chase' || b.state === 'wake') { b.state = 'back'; b.t = 0; }
  }
  function openCloset() {
    const items = ITEMS.filter((it) => save.owned.includes(it.id));
    shopUI = { shop: { id: 'closet', name: 'My Clothes', color: '#fffbe0', ink: '#e6a800' }, items, sel: 0 };
    mode = 'shop';
  }
  const SHOP_COLS = 4;
  function updateShop() {
    const n = shopUI.items.length;
    if (n) {
      if (hit('left')) { shopUI.sel = (shopUI.sel + n - 1) % n; sfx.move(); }
      if (hit('right')) { shopUI.sel = (shopUI.sel + 1) % n; sfx.move(); }
      if (hit('up') && shopUI.sel - SHOP_COLS >= 0) { shopUI.sel -= SHOP_COLS; sfx.move(); }
      if (hit('down') && shopUI.sel + SHOP_COLS < n) { shopUI.sel += SHOP_COLS; sfx.move(); }
    }
    if (ok() && n) {
      const it = shopUI.items[shopUI.sel];
      const wear = save.wear[hero];
      if (!save.owned.includes(it.id)) {
        save.owned.push(it.id); wear[it.slot] = it.id; sfx.get();
      } else if (wear[it.slot] === it.id) { delete wear[it.slot]; sfx.move(); }
      else { wear[it.slot] = it.id; sfx.get(); }
      writeSave();
    }
    if (backHit()) { mode = shopUI.shop.id === 'closet' ? 'pause' : 'play'; shopUI = null; sfx.door(); }
  }

  // ---------------------------------------------------------------------------
  // Photo album
  const ALBUM_COLS = 4, ALBUM_ROWS = 3;
  function openAlbum() { mode = 'album'; albumSel = Math.max(0, photos.length - 1); sfx.blip(); }
  function updateAlbum() {
    const n = photos.length;
    if (n) {
      if (hit('left') && albumSel > 0) { albumSel--; sfx.move(); }
      if (hit('right') && albumSel < n - 1) { albumSel++; sfx.move(); }
      if (hit('up') && albumSel - ALBUM_COLS >= 0) { albumSel -= ALBUM_COLS; sfx.move(); }
      if (hit('down') && albumSel + ALBUM_COLS < n) { albumSel += ALBUM_COLS; sfx.move(); }
      if (ok()) { mode = 'view'; viewIdx = albumSel; sfx.blip(); }
    }
    if (backHit() || hit('album')) { mode = 'play'; }
  }

  // ---------------------------------------------------------------------------
  // Pause menu
  function pauseItems() {
    return [
      ['Keep playing', () => { mode = 'play'; }],
      ['My photos', openAlbum],
      ['My clothes', openCloset],
      [document.fullscreenElement ? 'Leave fullscreen' : 'Fullscreen', toggleFullscreen],
      [`Sound: ${save.sound ? 'on' : 'off'}`, () => { save.sound = !save.sound; writeSave(); }],
      ['Pick boy or girl', () => { mode = 'title'; titleSel = hero === 'girl' ? 1 : 0; }],
      ['All games', () => { location.href = '/'; }],
    ];
  }
  function updatePause() {
    const items = pauseItems();
    if (hit('up')) { menuSel = (menuSel + items.length - 1) % items.length; sfx.move(); }
    if (hit('down')) { menuSel = (menuSel + 1) % items.length; sfx.move(); }
    if (ok()) { sfx.blip(); items[menuSel][1](); }
    else if (backHit() || hit('pause')) mode = 'play';
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
  const TRIGGER = { xbox: 'RT', deck: 'R2', nintendo: 'ZR', ps: 'R2' };
  const START = { xbox: 'menu', deck: 'menu', nintendo: '+', ps: 'OPTIONS' };

  // Returns the width drawn. (x, y) is the left middle.
  function drawButton(c, action, x, y, size = 34) {
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const r = size / 2;
    if (device === 'keyboard') {
      if (action === 'move' || action === 'up') {
        const keys = action === 'up' ? ['↑'] : ['←', '→'];
        let w = 0;
        for (const k of keys) { w += keyCap(c, k, x + w, y, size) + 4; }
        c.restore(); return w - 4;
      }
      const w = keyCap(c, KEY_LABEL[action] || '?', x, y, size);
      c.restore(); return w;
    }
    if (action === 'move' || action === 'up') {
      // Left stick
      c.fillStyle = '#333'; c.beginPath(); c.arc(x + r, y, r, 0, 7); c.fill();
      c.fillStyle = '#666'; c.beginPath(); c.arc(x + r, y + (action === 'up' ? -4 : 0), r * 0.62, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = font(size * 0.4); c.fillText(action === 'up' ? '▲' : 'L', x + r, y + 1 + (action === 'up' ? -4 : 0));
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
    const face = PAD_FACE[action];
    const [label, color] = FACE[device][face];
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
    let w = size;
    if (action === 'photo') {
      // The trigger also takes photos.
      c.fillStyle = '#111'; c.font = font(size * 0.42); c.fillText('/', x + size + 9, y);
      const tl = TRIGGER[device];
      c.font = font(size * 0.38);
      const tw = Math.max(size, c.measureText(tl).width + 14);
      c.fillStyle = '#333'; roundRect(c, x + size + 18, y - r, tw, size, r * 0.6); c.fill();
      c.fillStyle = '#fff'; c.fillText(tl, x + size + 18 + tw / 2, y + 1);
      w += 18 + tw;
    }
    c.restore(); return w;
  }
  function keyCap(c, label, x, y, size) {
    c.font = font(size * 0.42);
    const w = Math.max(size, c.measureText(label).width + 18);
    c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 3;
    roundRect(c, x, y - size / 2, w, size, 7); c.fill(); c.stroke();
    c.fillStyle = '#111'; c.fillRect(x + 4, y + size / 2 - 2, w - 8, 2);
    c.fillText(label, x + w / 2, y);
    return w;
  }
  // A row of [action, words] prompts. align: 'left' | 'right' | 'center'.
  function drawPrompts(c, list, x, y, align = 'left', size = 34) {
    c.save();
    c.font = font(size * 0.62);
    const widths = list.map(([a, t]) => measureButton(c, a, size) + 10 + c.measureText(t).width);
    const total = widths.reduce((s, w) => s + w, 0) + 28 * (list.length - 1);
    let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    list.forEach(([a, t], i) => {
      const bw = drawButton(c, a, cx, y, size);
      c.font = font(size * 0.62); c.textAlign = 'left'; c.textBaseline = 'middle';
      c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,.9)'; c.strokeText(t, cx + bw + 10, y + 1);
      c.fillStyle = '#111'; c.fillText(t, cx + bw + 10, y + 1);
      cx += widths[i] + 28;
    });
    c.restore();
  }
  const measureCanvas = document.createElement('canvas').getContext('2d');
  function measureButton(c, a, size) { measureCanvas.font = c.font; return drawButton(measureCanvas, a, -9999, -9999, size); }

  // Text with {action} buttons inside it, for talking.
  function drawRichText(c, text, x, y, size) {
    const parts = text.split(/(\{\w+\})/);
    let cx = x;
    for (const p of parts) {
      const m = p.match(/^\{(\w+)\}$/);
      if (m) cx += drawButton(c, m[1], cx + 4, y, size * 1.25) + 8;
      else { c.fillText(p, cx, y); cx += c.measureText(p).width; }
    }
  }

  // ---------------------------------------------------------------------------
  // Drawing the world
  function drawGround(c) {
    const g = IMG.ground; if (!g) return;
    const gw = 900, gh = gw * g.height / g.width;
    const start = Math.floor(camX / gw) - 1;
    for (let i = start; i < start + Math.ceil(W / gw) + 3; i++) {
      const x = i * gw - camX;
      c.save();
      if (i % 2) { c.translate(x + gw, 0); c.scale(-1, 1); c.drawImage(g, 0, GROUND - gh * 0.45, gw, gh); }
      else c.drawImage(g, x, GROUND - gh * 0.45, gw, gh);
      c.restore();
    }
  }
  function drawSprite(c, art, x, h, subject, opts = {}) {
    const img = IMG[art]; if (!img) return;
    const w = h * img.width / img.height;
    const sx = x - camX * (opts.parallax ?? 1);
    if (sx + w / 2 < -50 || sx - w / 2 > W + 50) return;
    const y = (opts.y ?? GROUND) - h;
    c.save();
    if (opts.alpha) c.globalAlpha = opts.alpha;
    if (opts.flip) { c.translate(sx, 0); c.scale(-1, 1); c.drawImage(img, -w / 2, y, w, h); }
    else c.drawImage(img, sx - w / 2, y, w, h);
    c.restore();
    if (subject) shotList.push({ id: subject, x: sx - w / 2, y, w, h });
  }
  function drawSky(c) {
    // Sun stays put in the sky, clouds drift slowly.
    drawSprite(c, 'sun', W * 0.82 + camX * 0.02, 150, 'sun', { parallax: 0.02, y: 210 });
    for (let i = 0; i < 14; i++) {
      const x = 300 + i * 760 + Math.sin(i * 7.3) * 200 + time * 6;
      drawSprite(c, i % 2 ? 'cloud2' : 'cloud', x, i % 2 ? 60 : 50, 'cloud', { parallax: 0.3, y: 120 + (i % 3) * 45 });
    }
    // Faded trees far away
    for (let i = 0; i < 16; i++) drawSprite(c, 'tree', 200 + i * 640 + (i % 3) * 90, 170 + (i % 2) * 30, null, { parallax: 0.6, alpha: 0.28, y: GROUND - 40 });
  }
  function drawKid(c) {
    const K = KIDS[hero];
    const bob = player.walkT ? -Math.abs(Math.sin(player.walkT)) * 9 : Math.sin(time * 2.5) * 1.5;
    const rot = player.knock > 0 ? (1.4 - player.knock) * 6 * -Math.sign(player.vx || 1) * (player.knock > 0.4 ? 1 : player.knock / 0.4) : (player.walkT ? Math.sin(player.walkT) * 0.06 : 0);
    const x = player.x - camX;
    c.save();
    c.translate(x, GROUND + bob - (player.knock > 0 ? Math.sin(Math.min(1, (1.4 - player.knock) / 0.6) * Math.PI) * 60 : 0));
    if (player.facing < 0) c.scale(-1, 1);
    c.translate(0, -K.h / 2); c.rotate(rot); c.translate(0, K.h / 2);
    drawKidAt(c, hero, K.h, save.wear[hero], { camera: true, flash: player.flash > 0.5 });
    c.restore();
    if (player.knock > 0.2) {
      c.save(); c.fillStyle = '#ffd400'; c.font = font(34); c.textAlign = 'center';
      for (let i = 0; i < 3; i++) { const a = time * 5 + i * 2.1; c.fillText('★', x + Math.cos(a) * 50, GROUND - K.h - 20 + Math.sin(a) * 14); }
      c.restore();
    }
  }
  function drawPet(c) {
    const K = KIDS[hero], img = IMG[K.pet]; if (!img) return;
    const h = K.petH, w = h * img.width / img.height;
    const hop = pet.hopT ? Math.abs(Math.sin(pet.hopT)) * (K.pet === 'rabbit' ? 34 : 12) : 0;
    const x = pet.x - camX;
    c.save(); c.translate(x, GROUND - hop);
    if (pet.facing < 0) c.scale(-1, 1);
    c.rotate(pet.hopT ? Math.sin(pet.hopT) * 0.08 : 0);
    c.drawImage(img, -w / 2, -h, w, h);
    c.restore();
    shotList.push({ id: 'pet', x: x - w / 2, y: GROUND - h - hop, w, h });
  }
  function drawNpc(c, n) {
    const img = IMG[n.art]; if (!img) return;
    const w = n.h * img.width / img.height, x = n.x - camX;
    c.save(); c.translate(x, GROUND); c.rotate(Math.sin(time * 1.6 + n.x) * 0.025);
    c.drawImage(img, -w / 2, -n.h, w, n.h);
    c.restore();
    shotList.push({ id: n.id, x: x - w / 2, y: GROUND - n.h, w, h: n.h });
  }

  function drawWorld(c) {
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    drawSky(c);
    drawGround(c);
    for (const [art, x, h, subject] of props) drawSprite(c, art, x, h, subject, { y: GROUND + (art === 'bear-sign' ? -40 : 0) });
    // A post under the bear sign
    const sign = props.find((p) => p[3] === 'sign');
    c.fillStyle = '#7a3e12'; c.fillRect(sign[1] - camX - 9, GROUND - 60, 18, 64);
    for (const n of npcs) drawNpc(c, n);
    for (const b of bears) drawBear(c, b);
    drawPet(c);
    drawKid(c);
  }

  function drawViewfinder(c) {
    const vf = viewfinder();
    c.save();
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 5; c.lineCap = 'round';
    const L = 34;
    for (const [x, y, dx, dy] of [[vf.x, vf.y, 1, 1], [vf.x + vf.w, vf.y, -1, 1], [vf.x, vf.y + vf.h, 1, -1], [vf.x + vf.w, vf.y + vf.h, -1, -1]]) {
      c.beginPath(); c.moveTo(x + dx * L, y); c.lineTo(x, y); c.lineTo(x, y + dy * L); c.stroke();
    }
    c.restore();
  }

  function drawHUD(c) {
    if (player.flash > 0) { c.fillStyle = `rgba(255,255,255,${player.flash})`; c.fillRect(0, 0, W, H); }
    drawViewfinder(c);
    // Top left: photo count and photo book
    c.save();
    c.font = font(26); c.textBaseline = 'middle'; c.fillStyle = '#111';
    ink(c, (c) => roundRect(c, 22, 20, 46, 34, 7), '#222', '#000', 3);
    ink(c, (c) => { c.beginPath(); c.arc(45, 37, 10, 0, 7); }, '#9fd8ff', '#000', 3);
    c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineJoin = 'round';
    c.strokeText(`${photos.length}`, 80, 38); c.fillText(`${photos.length}`, 80, 38);
    c.font = font(20); c.fillStyle = '#444';
    const book = `Photo Book: ${save.found.length} / ${SUBJECTS.length}`;
    c.strokeText(book, 24, 76); c.fillText(book, 24, 76);
    c.restore();
    // Top right: what the buttons do
    const list = [['photo', 'Take a picture'], ['album', 'Photos'], ['pause', 'Menu']];
    drawPrompts(c, list, W - 24, 38, 'right', 32);
    drawPrompts(c, [['up', 'Aim up'], ['run', 'Hold to run']], W - 24, 82, 'right', 28);
    // Something to do nearby?
    const near = mode === 'play' && player.knock <= 0 && nearThing();
    if (near) drawPrompts(c, [['confirm', near.label]], near.x - camX, GROUND - near.h - 40 + Math.sin(time * 4) * 4, 'center', 38);
    // Last photo pops up in the corner like an instant photo.
    if (lastPhoto) {
      const t = lastPhoto.t, pw = 260, ph = pw * lastPhoto.canvas.height / lastPhoto.canvas.width;
      const slide = t < 0.3 ? 1 - t / 0.3 : t > 2.2 ? (t - 2.2) / 0.4 : 0;
      drawPolaroid(c, lastPhoto.canvas, W - pw - 50 + slide * 400, H - ph - 110, pw, -0.06, lastPhoto.subjects);
    }
  }
  function drawPolaroid(c, img, x, y, w, rot = 0, subjects = null, selected = false) {
    const h = w * (img.height || 1) / (img.width || 1);
    const pad = w * 0.05, bottom = subjects ? w * 0.2 : pad;
    c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(rot);
    c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 12; c.shadowOffsetY = 4;
    c.fillStyle = '#fff'; c.fillRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad + bottom);
    c.shadowColor = 'transparent';
    if (img.width) c.drawImage(img, -w / 2, -h / 2, w, h);
    c.strokeStyle = '#ddd'; c.lineWidth = 1; c.strokeRect(-w / 2, -h / 2, w, h);
    if (subjects) {
      c.fillStyle = '#333'; c.font = font(Math.max(14, w * 0.07)); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(subjects.length ? subjects.map(subjectLabel).slice(0, 3).join(', ') : '...', 0, h / 2 + bottom / 2, w);
    }
    if (selected) scribbleRect(c, -w / 2 - pad - 6, -h / 2 - pad - 6, w + pad * 2 + 12, h + pad + bottom + 12, '#ffd400', 8, 7);
    c.restore();
  }
  function drawToasts(c) {
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    toasts.forEach((t, i) => {
      const a = Math.min(1, t.t * 5, (3.5 - t.t) * 2);
      c.globalAlpha = Math.max(0, a);
      c.font = font(30);
      const w = c.measureText(t.text).width + 50, y = 150 + i * 60;
      c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 4;
      roundRect(c, W / 2 - w / 2, y - 25, w, 50, 25); c.fill(); c.stroke();
      c.fillStyle = '#111'; c.fillText(t.text, W / 2, y + 1);
    });
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Screens
  function titleCards() {
    const cw = 280, ch = 240, gap = 60, y = 385;
    return [{ x: W / 2 - cw - gap / 2, y, w: cw, h: ch }, { x: W / 2 + gap / 2, y, w: cw, h: ch }];
  }
  function drawTitle(c) {
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    const t = IMG.title;
    if (t) { const th = 330, tw = th * t.width / t.height; c.drawImage(t, W / 2 - tw / 2, 4, tw, th); }
    c.save(); c.textAlign = 'center'; c.fillStyle = '#111'; c.font = font(30);
    c.fillText('Who do you want to be?', W / 2, 362);
    c.restore();
    titleCards().forEach((r, i) => {
      const kid = i ? 'girl' : 'boy', K = KIDS[kid], sel = titleSel === i;
      const bob = sel ? Math.abs(Math.sin(time * 5)) * -10 : 0;
      c.save(); c.translate(r.x + r.w * 0.4, r.y + r.h - 42 + bob);
      drawKidAt(c, kid, K.h * 0.85, save.wear[kid], { camera: true });
      c.restore();
      const pimg = IMG[K.pet];
      if (pimg) { const ph = K.petH * 0.85, pw = ph * pimg.width / pimg.height; c.drawImage(pimg, r.x + r.w * 0.8 - pw / 2, r.y + r.h - 42 - ph, pw, ph); }
      c.save(); c.textAlign = 'center'; c.font = font(30); c.fillStyle = sel ? '#111' : '#888';
      c.fillText(`${K.label} + ${K.petLabel}`, r.x + r.w / 2, r.y + r.h - 2);
      c.restore();
      if (sel) scribbleRect(c, r.x - 10, r.y - 4, r.w + 20, r.h + 26, '#ffd400', 9, 3);
    });
    drawPrompts(c, [['move', 'Choose'], ['confirm', 'Start'], ['fullscreen', 'Fullscreen']], W / 2, H - 30, 'center', 32);
  }

  function drawDialog(c) {
    const bw = Math.min(W - 80, 1000), bh = 170, bx = W / 2 - bw / 2, by = H - bh - 24;
    c.save();
    c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 5;
    roundRect(c, bx, by, bw, bh, 22); c.fill(); c.stroke();
    const img = IMG[dialog.art];
    if (img) { const ph = 150, pw = ph * img.width / img.height; c.drawImage(img, bx + 20, by + 10, pw, ph); }
    c.fillStyle = '#ff1aa8'; c.font = font(30); c.textBaseline = 'middle';
    c.fillText(dialog.who, bx + 180, by + 36);
    c.fillStyle = '#111'; c.font = font(30, 'normal');
    const line = dialog.lines[dialog.i];
    // Don't cut a {button} in half while typing.
    let shown = line.slice(0, Math.floor(dialog.shown));
    const open = shown.lastIndexOf('{');
    if (open > shown.lastIndexOf('}')) shown = shown.slice(0, open);
    wrapRich(c, shown, line, bx + 180, by + 86, bw - 210, 42, 30);
    c.restore();
    if (dialog.shown >= line.length) drawPrompts(c, [['confirm', dialog.i < dialog.lines.length - 1 ? 'More' : 'Bye!']], bx + bw - 24, by + bh - 26, 'right', 30);
  }
  // Wraps by the full line so words don't jump around while typing.
  function wrapRich(c, text, full, x, y, maxW, lh, size) {
    const words = full.split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (c.measureText(test.replace(/\{\w+\}/g, 'WWW')).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    lines.push(cur);
    let left = text.length;
    lines.forEach((l, i) => {
      if (left <= 0) return;
      const part = l.slice(0, left);
      drawRichText(c, part, x, y + i * lh, size);
      left -= l.length + 1;
    });
  }

  function drawSign(c) {
    c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(0, 0, W, H);
    const img = IMG['bear-sign'];
    if (img) { const h = 520, w = h * img.width / img.height; c.drawImage(img, W / 2 - w / 2, 20, w, h); }
    c.save(); c.textAlign = 'center'; c.fillStyle = '#111'; c.font = font(36);
    c.fillText('The bear will chase you if you take a picture!', W / 2, 590);
    c.restore();
    drawPrompts(c, [['confirm', 'OK']], W / 2, H - 50, 'center', 34);
  }

  function drawShop(c) {
    const s = shopUI.shop;
    c.fillStyle = s.color; c.fillRect(0, 0, W, H);
    // Scribbly floor and walls, like her drawings
    c.save(); c.strokeStyle = s.ink; c.globalAlpha = 0.18; c.lineWidth = 14; c.lineCap = 'round';
    const r = rng(s.id.length * 99);
    for (let i = 0; i < 26; i++) { c.beginPath(); const x = r() * W; c.moveTo(x, 0); c.lineTo(x + (r() - 0.5) * 200, H); c.stroke(); }
    c.restore();
    // Her drawing of the shop's racks, faded behind the clothes
    const rack = RACKS[s.id];
    if (rack) {
      const rw = W * 0.62, rh = rw * rack.height / rack.width;
      c.save(); c.globalAlpha = 0.22; c.drawImage(rack, W - rw - 10, 150, rw, rh); c.restore();
    }
    const shopImg = IMG[s.id === 'fancy' ? 'fancy-shop' : s.id === 'cool' ? 'cool-shop' : null];
    if (shopImg) { const h = 150, w = h * shopImg.width / shopImg.height; c.drawImage(shopImg, 30, 18, w, h); }
    c.save(); c.fillStyle = s.ink; c.font = font(52); c.textBaseline = 'middle';
    c.fillText(s.name, shopImg ? 150 : 40, 70);
    c.fillStyle = '#111'; c.font = font(26, 'normal');
    c.fillText(s.id === 'closet' ? 'Pick what to wear.' : 'Everything is free! Take what you like.', shopImg ? 152 : 42, 122);
    c.restore();

    // The kid, trying on whatever is picked
    const it = shopUI.items[shopUI.sel];
    const K = KIDS[hero];
    c.save(); c.translate(W * 0.2, 600);
    ink(c, (c) => { c.beginPath(); c.ellipse(0, 4, 150, 22, 0, 0, 7); }, 'rgba(0,0,0,.08)', null);
    drawKidAt(c, hero, K.h * 1.8, save.wear[hero], { tryOn: it && it.id });
    c.restore();

    if (!shopUI.items.length) {
      c.save(); c.fillStyle = '#111'; c.font = font(34); c.textAlign = 'center';
      c.fillText('No clothes yet!', W * 0.62, 320);
      c.font = font(26, 'normal'); c.fillText('Visit the Fancy Shop and the Cool Shop.', W * 0.62, 370);
      c.restore();
    }
    // Item cards
    const gap = 18, gx = W * 0.36, gy = 180;
    const cw = Math.min(200, (W - 30 - gx - gap * (SHOP_COLS - 1)) / SHOP_COLS), ch = 170;
    shopUI.items.forEach((item, i) => {
      const x = gx + (i % SHOP_COLS) * (cw + gap), y = gy + Math.floor(i / SHOP_COLS) * (ch + gap);
      const owned = save.owned.includes(item.id), worn = save.wear[hero][item.slot] === item.id;
      c.save();
      c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 4;
      roundRect(c, x, y, cw, ch, 18); c.fill(); c.stroke();
      if (item.img) {
        const iw = item.img.width, ih = item.img.height, s2 = Math.min((cw - 40) / iw, (ch - 64) / ih);
        c.drawImage(item.img, x + cw / 2 - iw * s2 / 2, y + 12 + (ch - 64 - ih * s2) / 2, iw * s2, ih * s2);
      }
      c.fillStyle = '#111'; c.font = font(20); c.textAlign = 'center';
      c.fillText(item.name, x + cw / 2, y + ch - 30);
      c.font = font(16); c.fillStyle = worn ? '#00a000' : owned ? '#777' : s.ink;
      c.fillText(worn ? 'Wearing it' : owned ? 'Yours' : 'FREE', x + cw / 2, y + ch - 10);
      c.restore();
      if (i === shopUI.sel) scribbleRect(c, x - 8, y - 8, cw + 16, ch + 16, '#ffd400', 9, i + 11);
    });
    let action = 'Get it!';
    if (it && save.owned.includes(it.id)) action = save.wear[hero][it.slot] === it.id ? 'Take it off' : 'Wear it';
    const list = [['move', 'Choose']];
    if (it) list.push(['confirm', action]);
    list.push(['back', s.id === 'closet' ? 'Back' : 'Leave shop']);
    drawPrompts(c, list, W / 2, H - 32, 'center', 32);
  }

  function drawAlbum(c) {
    c.fillStyle = '#fff8e6'; c.fillRect(0, 0, W, H);
    c.save(); c.fillStyle = '#111'; c.font = font(48); c.textBaseline = 'middle';
    c.fillText('My Photos', 40, 54);
    c.restore();
    // Photo Book checklist on the right
    const bx = W - 300;
    c.save(); c.font = font(26); c.fillStyle = '#ff1aa8'; c.textBaseline = 'middle';
    c.fillText(`Photo Book ${save.found.length}/${SUBJECTS.length}`, bx, 54);
    c.font = font(21, 'normal');
    SUBJECTS.forEach(([id], i) => {
      const got = save.found.includes(id), y = 100 + i * 35;
      c.fillStyle = got ? '#111' : '#aaa';
      c.fillText(`${got ? '✔' : '○'}  ${got ? subjectLabel(id) : '???'}`, bx, y);
    });
    c.restore();

    if (!photos.length) {
      c.save(); c.fillStyle = '#111'; c.font = font(32); c.textAlign = 'center';
      c.fillText('No photos yet.', (W - 320) / 2, 300);
      c.font = font(26, 'normal'); c.fillText('Go take some pictures!', (W - 320) / 2, 350);
      c.restore();
    } else {
      const perPage = ALBUM_COLS * ALBUM_ROWS, page = Math.floor(albumSel / perPage);
      const areaW = W - 360, pw = Math.min(200, (areaW - 40) / ALBUM_COLS - 36), ph = pw * 320 / 440;
      for (let k = 0; k < perPage; k++) {
        const i = page * perPage + k; if (i >= photos.length) break;
        const col = k % ALBUM_COLS, row = Math.floor(k / ALBUM_COLS);
        const x = 50 + col * (pw + 36), y = 110 + row * (ph + 70);
        drawPolaroid(c, photos[i].canvas, x, y, pw, ((i * 37) % 7 - 3) * 0.01, photos[i].subjects, i === albumSel);
      }
      const pages = Math.ceil(photos.length / perPage);
      if (pages > 1) { c.save(); c.fillStyle = '#777'; c.font = font(22); c.textAlign = 'center'; c.fillText(`Page ${page + 1} of ${pages}`, areaW / 2, H - 80); c.restore(); }
    }
    const list = [];
    if (photos.length) list.push(['move', 'Choose'], ['confirm', 'Look']);
    list.push(['back', 'Back']);
    drawPrompts(c, list, W / 2, H - 32, 'center', 32);
  }
  function drawView(c) {
    c.fillStyle = '#fff8e6'; c.fillRect(0, 0, W, H);
    const p = photos[viewIdx]; if (!p) return;
    const pw = Math.min(W - 200, 570);
    drawPolaroid(c, p.canvas, W / 2 - pw / 2, 50, pw, 0, p.subjects);
    drawPrompts(c, [['move', `${viewIdx + 1} of ${photos.length}`], ['back', 'Back']], W / 2, H - 32, 'center', 32);
  }
  function drawPause(c) {
    c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(0, 0, W, H);
    const items = pauseItems();
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#111'; c.font = font(52); c.fillText('Paused', W / 2, 90);
    items.forEach(([label], i) => {
      const y = 180 + i * 62;
      c.font = font(34); c.fillStyle = i === menuSel ? '#111' : '#777';
      c.fillText(label, W / 2, y);
      if (i === menuSel) { const w = c.measureText(label).width; scribbleRect(c, W / 2 - w / 2 - 24, y - 26, w + 48, 52, '#ffd400', 7, i + 3); }
    });
    c.restore();
    drawPrompts(c, [['move', 'Choose'], ['confirm', 'OK'], ['back', 'Back']], W / 2, H - 32, 'center', 32);
  }

  // ---------------------------------------------------------------------------
  function render() {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    if (mode === 'loading') {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#111'; ctx.font = font(40); ctx.textAlign = 'center'; ctx.fillText('Loading...', W / 2, H / 2); ctx.textAlign = 'left';
      return;
    }
    if (mode === 'title') { drawTitle(ctx); drawToasts(ctx); return; }
    if (mode === 'shop') { drawShop(ctx); return; }
    if (mode === 'album') { drawAlbum(ctx); return; }
    if (mode === 'view') { drawView(ctx); return; }
    shotList = [];
    drawWorld(ctx);
    if (pendingPhoto) capturePhoto();
    drawHUD(ctx);
    if (mode === 'talk') drawDialog(ctx);
    if (mode === 'sign') drawSign(ctx);
    if (mode === 'pause') drawPause(ctx);
    drawToasts(ctx);
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
  window.photoTaker = { get state() { return { mode, hero, player, pet, bears, photos: photos.length, found: save.found, device }; }, startGame, ITEMS, KIDS };
})();
