// Jojo Finds Momo: walk around the jungle and collect all the monkeys.
// Vanilla JS on PixiJS (loaded from the CDN in index.html as the global PIXI).
(async () => {
  'use strict';

  const app = new PIXI.Application();
  await app.init({
    resizeTo: window,
    background: '#000000',
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  document.body.appendChild(app.canvas);
  const canvas = app.canvas;

  const tex = {
    title: await PIXI.Assets.load('assets/title.jpg'),
    jojo: await PIXI.Assets.load('assets/jojo.png'),
    momo: await PIXI.Assets.load('assets/momo.png'),
  };

  // ---------- helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hsl = (h, s, l) => {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
  };
  const FONT = '"Comic Sans MS", "Chalkboard SE", "Marker Felt", system-ui, sans-serif';
  function bubbleText(text, size, fill = 0xffffff) {
    const t = new PIXI.Text({
      text,
      style: { fontFamily: FONT, fontWeight: 'bold', fontSize: size, fill, stroke: { color: 0x000000, width: size * 0.22, join: 'round' }, align: 'center' },
    });
    t.anchor.set(0.5);
    return t;
  }

  // ---------- sound (tiny synth, no files) ----------
  let audio = null;
  let muted = false;
  function initAudio() {
    if (!audio) {
      try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
    }
    if (audio && audio.state === 'suspended') audio.resume();
  }
  function tone(freq, start, dur, type = 'triangle', vol = 0.2) {
    if (!audio || muted) return;
    const t = audio.currentTime + start;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
  function oohOoh() {
    if (!audio || muted) return;
    // A little monkey "ooh ooh!" made of two sliding notes.
    for (let i = 0; i < 2; i++) {
      const t = audio.currentTime + i * 0.16;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, t);
      osc.frequency.exponentialRampToValueAtTime(950, t + 0.12);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    }
    tone(1320, 0.34, 0.2, 'triangle', 0.12);
  }
  const fanfare = () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.3, 'square', 0.08));
  const startJingle = () => [392, 523, 659].forEach((f, i) => tone(f, i * 0.09, 0.2, 'triangle', 0.15));

  // ---------- screen ----------
  let W = 0, H = 0, zoom = 1;

  // ---------- scene graph ----------
  const worldLayer = new PIXI.Container();
  const ground = new PIXI.Container();
  const entities = new PIXI.Container();
  entities.sortableChildren = true; // y-sort so things overlap nicely
  const fx = new PIXI.Graphics(); // butterflies + sparkles, redrawn each frame
  worldLayer.addChild(ground, entities, fx);

  const hud = new PIXI.Container();
  const pill = new PIXI.Graphics().roundRect(0, 0, 190, 56, 28).fill({ color: 0x000000, alpha: 0.45 });
  const pillIcon = new PIXI.Sprite(tex.momo);
  pillIcon.height = 46; pillIcon.scale.x = pillIcon.scale.y; pillIcon.position.set(10, 5);
  const counter = bubbleText('0 / 0', 28, 0xffd23f);
  counter.position.set(10 + pillIcon.width + (190 - pillIcon.width - 20) / 2, 30);
  const pillBox = new PIXI.Container();
  pillBox.position.set(14, 14);
  pillBox.addChild(pill, pillIcon, counter);
  const soundBtn = new PIXI.Graphics();
  const arrows = new PIXI.Graphics();
  const banner = bubbleText('', 46);
  hud.addChild(arrows, pillBox, soundBtn, banner);

  const winLayer = new PIXI.Container();
  const winShade = new PIXI.Graphics();
  const confettiG = new PIXI.Graphics();
  const hooray = bubbleText('Hooray!', 68, 0xffd23f);
  const winMsg = bubbleText('', 40);
  const again = bubbleText('Tap for more Momos!', 42, 0x7dff6a);
  winLayer.addChild(winShade, confettiG, hooray, winMsg, again);

  const titleLayer = new PIXI.Container();
  const titleImg = new PIXI.Sprite(tex.title);
  titleImg.anchor.set(0.5);
  const tapToPlay = bubbleText('Tap to play!', 48, 0xffd23f);
  titleLayer.addChild(titleImg, tapToPlay);

  app.stage.addChild(worldLayer, hud, winLayer, titleLayer);

  function layout() {
    W = app.screen.width;
    H = app.screen.height;
    // Keep the world a comfortable size on phones and big screens alike.
    zoom = Math.max(0.55, Math.min(1.3, Math.min(W, H) / 650));

    const s = Math.min(W / tex.title.width, H / tex.title.height);
    titleImg.scale.set(s);
    titleImg.position.set(W / 2, H / 2);
    tapToPlay.position.set(W / 2, H - Math.max(50, H * 0.09));
    tapToPlay.style.fontSize = Math.min(48, W / 11);

    soundBtn.position.set(W - 42, 42);
    banner.position.set(W / 2, H * 0.22);
    banner.style.fontSize = Math.min(46, W / 12);

    const size = Math.min(52, W / 11);
    hooray.style.fontSize = size * 1.3;
    hooray.position.set(W / 2, H * 0.18);
    winMsg.style.fontSize = size * 0.75;
    winMsg.position.set(W / 2, H * 0.18 + size * 1.4);
    again.style.fontSize = size * 0.8;
    again.position.set(W / 2, H - Math.max(50, H * 0.1));
    winShade.clear().rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.25 });
  }
  app.renderer.on('resize', layout);
  layout();

  function drawSoundBtn() {
    const g = soundBtn.clear();
    g.circle(0, 0, 26).fill({ color: 0x000000, alpha: 0.45 });
    g.poly([-14, -6, -7, -6, 2, -14, 2, 14, -7, 6, -14, 6]).fill(0xffffff);
    if (muted) {
      g.moveTo(8, -6).lineTo(18, 6).moveTo(18, -6).lineTo(8, 6).stroke({ width: 3, color: 0xffffff });
    } else {
      g.arc(4, 0, 7, -0.9, 0.9).stroke({ width: 3, color: 0xffffff });
      g.arc(4, 0, 13, -0.9, 0.9).stroke({ width: 3, color: 0xffffff });
    }
  }
  drawSoundBtn();
  const toggleMute = () => { muted = !muted; drawSoundBtn(); };

  // ---------- input ----------
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys.add(k);
    if (k === 'm') toggleMute();
    if (k === 'enter' || k === ' ') press();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  const pointer = { down: false, x: 0, y: 0, id: null };
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    initAudio();
    // Sound toggle button in the top-right corner.
    if (state === 'play' && e.clientX > W - 70 && e.clientY < 70) {
      toggleMute();
      return;
    }
    pointer.down = true;
    pointer.id = e.pointerId;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    press();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer.id) return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });
  const release = (e) => {
    if (e.pointerId !== pointer.id) return;
    pointer.down = false;
    pointer.id = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- game state ----------
  let state = 'title'; // title | play | win
  let stateTime = 0;
  let time = 0;
  let level = 1;
  let world = { w: 2000, h: 2000 };
  let trees = [], monkeys = [], sparkles = [], confetti = [], butterflies = [];
  const jojo = { x: 0, y: 0, vx: 0, vy: 0, face: 1, walk: 0, trail: [], char: null };
  const cam = { x: 0, y: 0 };

  const JOJO_H = 130;
  const MOMO_H = 80;
  const SPEED = 260;
  const PETALS = [0xff5aa5, 0xffd23f, 0xff7b3a, 0xb06cff, 0xffffff, 0x4fc3ff];

  function setState(s) {
    state = s;
    stateTime = 0;
    titleLayer.visible = s === 'title';
    hud.visible = s === 'play';
    winLayer.visible = s === 'win';
    again.visible = false;
  }
  setState('title');

  function press() {
    initAudio();
    if (state === 'title' && stateTime > 0.3) {
      level = 1;
      startLevel();
    } else if (state === 'win' && stateTime > 1.2) {
      level++;
      startLevel();
    }
  }

  const monkeysForLevel = (n) => Math.min(4 + n * 2, 30);

  // A standing thing in the world: a shadow plus a sprite that can hop, tilt and flip.
  function makeCharacter(texture, h, shadowW) {
    const view = new PIXI.Container();
    const shadow = new PIXI.Graphics().ellipse(0, 0, shadowW, shadowW * 0.32).fill({ color: 0x002800, alpha: 0.28 });
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 1);
    const base = h / texture.height;
    sprite.scale.set(base);
    view.addChild(shadow, sprite);
    entities.addChild(view);
    return { view, sprite, base };
  }

  function makeTree(t) {
    const g = new PIXI.Graphics();
    g.ellipse(0, 0, t.r * 0.7, t.r * 0.7 * 0.32).fill({ color: 0x002800, alpha: 0.28 });
    if (t.kind === 'palm') {
      g.moveTo(0, 0).quadraticCurveTo(25, -90, 8, -170).stroke({ width: 22, color: 0x8a5a2b, cap: 'round' });
      const cx = 8, cy = -170;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3;
        const leaf = new PIXI.Graphics().ellipse(0, 0, 62, 18).fill(hsl(t.hue, 55, i % 2 ? 32 : 38));
        leaf.position.set(cx + Math.cos(a) * 50, cy + Math.sin(a) * 26);
        leaf.rotation = a;
        g.addChild(leaf);
      }
      const nuts = new PIXI.Graphics();
      for (let i = 0; i < 3; i++) nuts.circle(cx - 10 + i * 10, cy + 10, 8).fill(0x6b3f1d);
      g.addChild(nuts);
    } else {
      g.rect(-14, -90, 28, 90).fill(0x7a4a22);
      const r = t.r;
      const blobs = [[0, -150, 1], [-r * 0.55, -120, 0.75], [r * 0.55, -120, 0.75], [-r * 0.3, -190, 0.7], [r * 0.3, -185, 0.7]];
      blobs.forEach(([dx, dy, s], i) => g.circle(dx, dy, r * 0.62 * s).fill(hsl(t.hue, 50, 26 + i * 3)));
      g.circle(-r * 0.2, -175, r * 0.25).fill({ color: hsl(t.hue, 60, 55), alpha: 0.35 });
    }
    g.position.set(t.x, t.y);
    g.zIndex = t.y;
    entities.addChild(g);
    t.view = g;
  }

  // The ground is one tile of grass, bushes and flowers baked into a texture and repeated,
  // which is much cheaper to draw on tablets than thousands of little shapes.
  const TILE = 1024;
  function makeGroundTexture() {
    const g = new PIXI.Graphics();
    g.rect(0, 0, TILE, TILE).fill(0x3f9a3a);
    const inset = () => rand(50, TILE - 50);
    for (let i = 0; i < 40; i++) {
      const r = rand(22, 40);
      g.ellipse(inset(), inset(), r * 1.4, r * 0.6).fill(hsl(rand(90, 140), 45, 30));
    }
    for (let i = 0; i < 170; i++) {
      const x = inset(), y = inset();
      if (Math.random() < 0.55) {
        g.moveTo(x - 5, y).lineTo(x - 7, y - 9)
          .moveTo(x, y).lineTo(x, y - 12)
          .moveTo(x + 5, y).lineTo(x + 7, y - 9)
          .stroke({ width: 2, color: 0x2f7d2c });
      } else {
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          g.circle(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.2);
        }
        g.fill(PETALS[(Math.random() * PETALS.length) | 0]);
        g.circle(x, y, 2.4).fill(0xffe14d);
      }
    }
    const texture = app.renderer.generateTexture({ target: g, frame: new PIXI.Rectangle(0, 0, TILE, TILE), resolution: 1 });
    g.destroy();
    return texture;
  }

  const groundTile = new PIXI.TilingSprite({ texture: makeGroundTexture(), width: 100, height: 100 });
  const groundEdge = new PIXI.Graphics();
  ground.addChild(groundEdge, groundTile);

  function drawGround() {
    groundEdge.clear().rect(-1500, -1500, world.w + 3000, world.h + 3000).fill(0x1d4d1c); // dark jungle beyond the edges
    groundTile.width = world.w;
    groundTile.height = world.h;
    groundTile.tilePosition.set(rand(0, TILE), rand(0, TILE));
  }

  function startLevel() {
    const count = monkeysForLevel(level);
    const size = 1400 + count * 90;
    world = { w: size, h: size };
    for (const child of entities.removeChildren()) child.destroy({ children: true });
    trees = []; monkeys = []; sparkles = []; confetti = []; butterflies = [];
    jojo.x = world.w / 2; jojo.y = world.h / 2;
    jojo.vx = jojo.vy = 0; jojo.trail = [];
    pointer.down = false; // the tap that started the level shouldn't steer Jojo

    const area = (world.w * world.h) / 1e6;
    const treeCount = Math.round(area * 13);
    for (let i = 0; i < treeCount * 4 && trees.length < treeCount; i++) {
      const t = { x: rand(60, world.w - 60), y: rand(80, world.h - 20), r: rand(70, 110), hue: rand(95, 135), kind: Math.random() < 0.35 ? 'palm' : 'round' };
      if (dist(t, jojo) < 220) continue;
      if (trees.some((o) => dist(o, t) < 140)) continue;
      trees.push(t);
    }
    // A border of trees so the jungle feels closed in.
    const edgeTree = (x, y) => trees.push({ x, y, r: rand(80, 110), hue: rand(95, 135), kind: 'round', edge: true });
    for (let x = 0; x <= world.w; x += 120) {
      edgeTree(x + rand(-20, 20), rand(-10, 20));
      edgeTree(x + rand(-20, 20), world.h + rand(20, 50));
    }
    for (let y = 100; y <= world.h; y += 120) {
      edgeTree(rand(-30, 0), y + rand(-20, 20));
      edgeTree(world.w + rand(0, 30), y + rand(-20, 20));
    }
    trees.forEach(makeTree);

    drawGround();
    for (let i = 0; i < 6 + level; i++) {
      butterflies.push({ x: rand(0, world.w), y: rand(0, world.h), a: rand(0, 6.28), c: PETALS[(Math.random() * PETALS.length) | 0], t: rand(0, 10) });
    }

    for (let i = 0; i < count * 50 && monkeys.length < count; i++) {
      const m = { x: rand(120, world.w - 120), y: rand(140, world.h - 80) };
      if (dist(m, jojo) < 350) continue;
      if (trees.some((t) => dist(t, m) < 50)) continue;
      if (monkeys.some((o) => dist(o, m) < 220)) continue;
      Object.assign(m, { vx: 0, vy: 0, timer: rand(0, 2), phase: rand(0, 6.28), found: false, face: Math.random() < 0.5 ? 1 : -1 });
      m.char = makeCharacter(tex.momo, MOMO_H, 22);
      monkeys.push(m);
    }
    jojo.char = makeCharacter(tex.jojo, JOJO_H, 30);

    cam.x = jojo.x; cam.y = jojo.y - JOJO_H / 2;
    banner.text = level === 1 ? 'Find all the Momos!' : `Level ${level}: find ${count} Momos!`;
    setState('play');
    startJingle();
  }

  function blockedByTree(x, y, r) {
    for (const t of trees) {
      const dx = x - t.x, dy = y - t.y;
      const rr = r + (t.edge ? 40 : 22);
      if (dx * dx + dy * dy < rr * rr) return t;
    }
    return null;
  }

  function moveWithCollision(o, dx, dy, r) {
    o.x = clamp(o.x + dx, 40, world.w - 40);
    o.y = clamp(o.y + dy, 70, world.h - 30);
    // Push out of tree trunks so we slide around them.
    for (let pass = 0; pass < 2; pass++) {
      const t = blockedByTree(o.x, o.y, r);
      if (!t) break;
      const rr = r + (t.edge ? 40 : 22);
      const ang = Math.atan2(o.y - t.y, o.x - t.x);
      o.x = t.x + Math.cos(ang) * (rr + 0.5);
      o.y = t.y + Math.sin(ang) * (rr + 0.5);
    }
  }

  // ---------- update ----------
  function update(dt) {
    stateTime += dt;
    time += dt;
    if (state === 'play') updatePlay(dt);
    if (state === 'win') updateWin(dt);
    for (const s of sparkles) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 300 * dt; s.life -= dt; }
    sparkles = sparkles.filter((s) => s.life > 0);
    for (const b of butterflies) {
      b.t += dt; b.a += rand(-2, 2) * dt;
      b.x = clamp(b.x + Math.cos(b.a) * 40 * dt, 0, world.w);
      b.y = clamp(b.y + Math.sin(b.a) * 40 * dt, 0, world.h);
    }
  }

  function updatePlay(dt) {
    let ix = 0, iy = 0;
    if (keys.has('arrowleft') || keys.has('a')) ix -= 1;
    if (keys.has('arrowright') || keys.has('d')) ix += 1;
    if (keys.has('arrowup') || keys.has('w')) iy -= 1;
    if (keys.has('arrowdown') || keys.has('s')) iy += 1;

    if (pointer.down && !(ix || iy)) {
      // Walk toward wherever the finger (or mouse) is.
      const tx = cam.x + (pointer.x - W / 2) / zoom;
      const ty = cam.y + (pointer.y - H / 2) / zoom;
      const dx = tx - jojo.x, dy = ty - (jojo.y - JOJO_H * 0.4);
      const d = Math.hypot(dx, dy);
      if (d > 12) { ix = dx / d; iy = dy / d; if (d < 60) { ix *= d / 60; iy *= d / 60; } }
    }
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }

    jojo.vx = ix * SPEED;
    jojo.vy = iy * SPEED;
    const moving = Math.hypot(jojo.vx, jojo.vy) > 5;
    if (Math.abs(jojo.vx) > 5) jojo.face = jojo.vx > 0 ? 1 : -1;
    moveWithCollision(jojo, jojo.vx * dt, jojo.vy * dt, 18);
    jojo.walk = moving ? jojo.walk + dt * 12 : jojo.walk * 0.8;

    // Breadcrumb trail so found monkeys can follow in a line.
    const last = jojo.trail[0];
    if (!last || Math.hypot(last.x - jojo.x, last.y - jojo.y) > 6) {
      jojo.trail.unshift({ x: jojo.x, y: jojo.y });
      if (jojo.trail.length > 600) jojo.trail.pop();
    }

    let followIndex = 0;
    for (const m of monkeys) {
      m.phase += dt;
      if (m.found) {
        followIndex++;
        const p = jojo.trail[Math.min(jojo.trail.length - 1, followIndex * 9)] || jojo;
        const dx = p.x - m.x, dy = p.y - m.y;
        m.x += dx * Math.min(1, dt * 8);
        m.y += dy * Math.min(1, dt * 8);
        if (Math.abs(dx) > 1) m.face = dx > 0 ? 1 : -1;
        continue;
      }
      // Wander about a little, hopping between spots.
      m.timer -= dt;
      if (m.timer <= 0) {
        m.timer = rand(1, 3);
        if (Math.random() < 0.5) { m.vx = 0; m.vy = 0; }
        else { const a = rand(0, 6.28); m.vx = Math.cos(a) * 55; m.vy = Math.sin(a) * 55; }
      }
      moveWithCollision(m, m.vx * dt, m.vy * dt, 14);
      if (Math.abs(m.vx) > 1) m.face = m.vx > 0 ? 1 : -1;

      if (dist(m, jojo) < 62) {
        m.found = true;
        oohOoh();
        for (let i = 0; i < 24; i++) {
          const a = rand(0, 6.28), s = rand(80, 260);
          sparkles.push({ x: m.x, y: m.y - MOMO_H / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 150, life: rand(0.5, 1), c: [0xffd23f, 0xffffff, 0xff5aa5, 0x7dff6a][i % 4] });
        }
        if (monkeys.every((o) => o.found)) {
          setState('win');
          winMsg.text = `Jojo found all ${monkeys.length} Momos!`;
          setTimeout(fanfare, 400);
          for (let i = 0; i < 160; i++) {
            confetti.push({ x: rand(0, W), y: rand(-H, 0), vy: rand(80, 200), vx: rand(-40, 40), r: rand(0, 6.28), vr: rand(-6, 6), c: [0xff5aa5, 0xffd23f, 0x4fc3ff, 0x7dff6a, 0xff7b3a, 0xb06cff][i % 6] });
          }
        }
      }
    }

    cam.x += (jojo.x - cam.x) * Math.min(1, dt * 6);
    cam.y += (jojo.y - JOJO_H / 2 - cam.y) * Math.min(1, dt * 6);
  }

  function updateWin(dt) {
    for (const c of confetti) {
      c.y += c.vy * dt; c.x += c.vx * dt; c.r += c.vr * dt;
      if (c.y > H + 20) { c.y = -20; c.x = rand(0, W); }
    }
    // All the Momos dance in a circle around Jojo.
    monkeys.forEach((m, i) => {
      m.phase += dt;
      const a = (i / monkeys.length) * Math.PI * 2 + stateTime * 0.8;
      const tx = jojo.x + Math.cos(a) * 130, ty = jojo.y + Math.sin(a) * 70;
      if (Math.abs(tx - m.x) > 1) m.face = tx > m.x ? 1 : -1;
      m.x += (tx - m.x) * Math.min(1, dt * 4);
      m.y += (ty - m.y) * Math.min(1, dt * 4);
    });
    cam.x += (jojo.x - cam.x) * Math.min(1, dt * 4);
    cam.y += (jojo.y - JOJO_H / 2 - cam.y) * Math.min(1, dt * 4);
  }

  // ---------- drawing ----------
  function placeCharacter(o, hop, rot) {
    const { view, sprite, base } = o.char;
    view.position.set(o.x, o.y);
    view.zIndex = o.y;
    sprite.y = -hop;
    sprite.rotation = rot;
    sprite.scale.set(base * o.face, base);
  }

  function star(g, x, y, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    return g.poly(pts);
  }

  function render() {
    if (state === 'title') {
      tapToPlay.scale.set(1 + Math.sin(time * 4) * 0.06);
      return;
    }

    worldLayer.scale.set(zoom);
    worldLayer.position.set(W / 2 - cam.x * zoom, H / 2 - cam.y * zoom);
    const vx0 = cam.x - W / 2 / zoom, vx1 = cam.x + W / 2 / zoom;
    const vy0 = cam.y - H / 2 / zoom, vy1 = cam.y + H / 2 / zoom;

    if (state === 'win') {
      placeCharacter(jojo, Math.abs(Math.sin(time * 6)) * 24, 0);
    } else {
      placeCharacter(jojo, Math.abs(Math.sin(jojo.walk)) * 6, Math.sin(jojo.walk) * 0.07);
    }
    for (const m of monkeys) {
      placeCharacter(m, Math.abs(Math.sin(m.phase * (m.found ? 9 : 4))) * (m.found ? 10 : 7), Math.sin(m.phase * 3) * 0.08);
    }

    // Fade a tree when Jojo or a Momo is hiding behind it.
    const behind = (o, h, t) => o.y < t.y && Math.hypot(o.x - t.x, o.y - h / 2 - (t.y - 150)) < t.r * 0.9;
    for (const t of trees) {
      const onScreen = t.x > vx0 - 200 && t.x < vx1 + 200 && t.y > vy0 - 20 && t.y < vy1 + 260;
      t.view.visible = onScreen;
      if (!onScreen) continue;
      const hiding = behind(jojo, JOJO_H, t) || monkeys.some((m) => (state === 'win' || !m.found) && behind(m, MOMO_H, t));
      t.view.alpha = hiding ? 0.55 : 1;
    }

    fx.clear();
    for (const b of butterflies) {
      if (b.x < vx0 || b.x > vx1 || b.y < vy0 || b.y > vy1) continue;
      const flap = Math.abs(Math.sin(b.t * 14));
      fx.ellipse(b.x - 5 * flap, b.y - 60, 6 * flap + 1, 5).ellipse(b.x + 5 * flap, b.y - 60, 6 * flap + 1, 5).fill(b.c);
    }
    for (const s of sparkles) star(fx, s.x, s.y, 6).fill({ color: s.c, alpha: clamp(s.life * 2, 0, 1) });

    if (state === 'play') renderHud();
    if (state === 'win') renderWin();
  }

  function renderHud() {
    const found = monkeys.filter((m) => m.found).length;
    counter.text = `${found} / ${monkeys.length}`;

    // Arrows at the screen edge pointing toward Momos you can't see yet.
    const margin = 34;
    const pulse = 1 + Math.sin(time * 5) * 0.12;
    arrows.clear();
    for (const m of monkeys) {
      if (m.found) continue;
      const sx = W / 2 + (m.x - cam.x) * zoom;
      const sy = H / 2 + (m.y - MOMO_H / 2 - cam.y) * zoom;
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
      const dx = sx - W / 2, dy = sy - H / 2;
      const s = Math.min((W / 2 - margin) / Math.abs(dx || 1e-6), (H / 2 - margin) / Math.abs(dy || 1e-6));
      const ax = W / 2 + dx * s, ay = H / 2 + dy * s;
      const a = Math.atan2(dy, dx);
      const c = Math.cos(a) * pulse, sn = Math.sin(a) * pulse;
      const pt = (px, py) => [ax + px * c - py * sn, ay + px * sn + py * c];
      arrows.poly([...pt(16, 0), ...pt(-10, -12), ...pt(-4, 0), ...pt(-10, 12)])
        .fill({ color: 0xffd23f, alpha: 0.9 })
        .stroke({ width: 3, color: 0x000000, alpha: 0.6 });
    }

    banner.visible = stateTime < 3;
    banner.alpha = clamp(3 - stateTime, 0, 1);
  }

  function renderWin() {
    confettiG.clear();
    for (const c of confetti) {
      const cs = Math.cos(c.r), sn = Math.sin(c.r);
      const pt = (px, py) => [c.x + px * cs - py * sn, c.y + px * sn + py * cs];
      confettiG.poly([...pt(-5, -3), ...pt(5, -3), ...pt(5, 3), ...pt(-5, 3)]).fill(c.c);
    }
    again.visible = stateTime > 1.2;
    again.scale.set(1 + Math.sin(time * 4) * 0.06);
  }

  // ---------- loop ----------
  app.ticker.add((ticker) => {
    update(Math.min(0.05, ticker.deltaMS / 1000));
    render();
  });

  if (location.hash === '#debug') window.__jojo = { jojo, get monkeys() { return monkeys; }, get state() { return state; } };
})();
