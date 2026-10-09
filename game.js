// Jojo Finds Momo: walk around the jungle and collect all the monkeys.
(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ---------- assets ----------
  const images = {};
  let loaded = 0;
  const sources = { title: 'assets/title.jpg', jojo: 'assets/jojo.png', momo: 'assets/momo.png' };
  for (const [key, src] of Object.entries(sources)) {
    const img = new Image();
    img.onload = () => { loaded++; };
    img.src = src;
    images[key] = img;
  }
  const assetsReady = () => loaded === Object.keys(sources).length;

  // ---------- screen ----------
  let W = 0, H = 0, dpr = 1, zoom = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // Keep the world a comfortable size on phones and big screens alike.
    zoom = Math.max(0.55, Math.min(1.3, Math.min(W, H) / 650));
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- sound (tiny synth, no files) ----------
  let audio = null;
  let muted = false;
  function initAudio() {
    if (audio) return;
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
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
  function fanfare() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.3, 'square', 0.08));
  }
  function startJingle() {
    [392, 523, 659].forEach((f, i) => tone(f, i * 0.09, 0.2, 'triangle', 0.15));
  }

  // ---------- input ----------
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys.add(k);
    if (k === 'm') muted = !muted;
    if (k === 'enter' || k === ' ') press();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  const pointer = { down: false, x: 0, y: 0, id: null };
  canvas.addEventListener('pointerdown', (e) => {
    initAudio();
    if (audio && audio.state === 'suspended') audio.resume();
    // Sound toggle button in the top-right corner.
    if (state === 'play' && e.clientX > W - 70 && e.clientY < 70) {
      muted = !muted;
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
  let level = 1;
  let world = { w: 2000, h: 2000 };
  let trees = [], bushes = [], flowers = [], monkeys = [], sparkles = [], confetti = [], butterflies = [];
  const jojo = { x: 0, y: 0, vx: 0, vy: 0, face: 1, walk: 0, trail: [] };
  const cam = { x: 0, y: 0 };

  const JOJO_H = 130;
  const MOMO_H = 80;
  const SPEED = 260;

  function press() {
    if (!assetsReady()) return;
    initAudio();
    if (state === 'title' && stateTime > 0.3) {
      level = 1;
      startLevel();
    } else if (state === 'win' && stateTime > 1.2) {
      level++;
      startLevel();
    }
  }

  function monkeysForLevel(n) { return Math.min(4 + n * 2, 30); }

  function startLevel() {
    const count = monkeysForLevel(level);
    const size = 1400 + count * 90;
    world = { w: size, h: size };
    trees = []; bushes = []; flowers = []; monkeys = []; sparkles = []; confetti = []; butterflies = [];
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
    for (let x = 0; x <= world.w; x += 120) {
      trees.push({ x: x + rand(-20, 20), y: rand(-10, 20), r: rand(80, 110), hue: rand(95, 135), kind: 'round', edge: true });
      trees.push({ x: x + rand(-20, 20), y: world.h + rand(20, 50), r: rand(80, 110), hue: rand(95, 135), kind: 'round', edge: true });
    }
    for (let y = 100; y <= world.h; y += 120) {
      trees.push({ x: rand(-30, 0), y: y + rand(-20, 20), r: rand(80, 110), hue: rand(95, 135), kind: 'round', edge: true });
      trees.push({ x: world.w + rand(0, 30), y: y + rand(-20, 20), r: rand(80, 110), hue: rand(95, 135), kind: 'round', edge: true });
    }

    for (let i = 0; i < area * 40; i++) bushes.push({ x: rand(0, world.w), y: rand(0, world.h), r: rand(22, 40), hue: rand(90, 140) });
    const petals = ['#ff5aa5', '#ffd23f', '#ff7b3a', '#b06cff', '#ffffff', '#4fc3ff'];
    for (let i = 0; i < area * 160; i++) {
      flowers.push({ x: rand(0, world.w), y: rand(0, world.h), c: petals[(Math.random() * petals.length) | 0], grass: Math.random() < 0.55 });
    }
    for (let i = 0; i < 6 + level; i++) {
      butterflies.push({ x: rand(0, world.w), y: rand(0, world.h), a: rand(0, 6.28), c: petals[(Math.random() * petals.length) | 0], t: rand(0, 10) });
    }

    for (let i = 0; i < count * 50 && monkeys.length < count; i++) {
      const m = { x: rand(120, world.w - 120), y: rand(140, world.h - 80) };
      if (dist(m, jojo) < 350) continue;
      if (trees.some((t) => dist(t, m) < 50)) continue;
      if (monkeys.some((o) => dist(o, m) < 220)) continue;
      m.vx = 0; m.vy = 0; m.timer = rand(0, 2); m.phase = rand(0, 6.28); m.found = false; m.face = Math.random() < 0.5 ? 1 : -1;
      monkeys.push(m);
    }

    state = 'play';
    stateTime = 0;
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
          sparkles.push({ x: m.x, y: m.y - MOMO_H / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 150, life: rand(0.5, 1), c: ['#ffd23f', '#ffffff', '#ff5aa5', '#7dff6a'][i % 4] });
        }
        if (monkeys.every((o) => o.found)) {
          state = 'win';
          stateTime = 0;
          setTimeout(fanfare, 400);
          for (let i = 0; i < 160; i++) {
            confetti.push({ x: rand(0, W), y: rand(-H, 0), vy: rand(80, 200), vx: rand(-40, 40), r: rand(0, 6.28), vr: rand(-6, 6), c: ['#ff5aa5', '#ffd23f', '#4fc3ff', '#7dff6a', '#ff7b3a', '#b06cff'][i % 6] });
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
  function drawSprite(img, x, y, h, face, rot = 0, squash = 1) {
    const w = (img.width / img.height) * h;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(face, squash);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  function shadow(x, y, w) {
    ctx.fillStyle = 'rgba(0,40,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGround(vx0, vy0, vx1, vy1) {
    ctx.fillStyle = '#3f9a3a';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    for (const b of bushes) {
      if (b.x < vx0 - 50 || b.x > vx1 + 50 || b.y < vy0 - 50 || b.y > vy1 + 50) continue;
      ctx.fillStyle = `hsl(${b.hue},45%,30%)`;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r * 1.4, b.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const f of flowers) {
      if (f.x < vx0 - 10 || f.x > vx1 + 10 || f.y < vy0 - 10 || f.y > vy1 + 10) continue;
      if (f.grass) {
        ctx.strokeStyle = '#2f7d2c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(f.x - 5, f.y); ctx.lineTo(f.x - 7, f.y - 9);
        ctx.moveTo(f.x, f.y); ctx.lineTo(f.x, f.y - 12);
        ctx.moveTo(f.x + 5, f.y); ctx.lineTo(f.x + 7, f.y - 9);
        ctx.stroke();
      } else {
        ctx.fillStyle = f.c;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(a) * 4, f.y + Math.sin(a) * 4, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.arc(f.x, f.y, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawTree(t, fade) {
    shadow(t.x, t.y, t.r * 0.7);
    ctx.globalAlpha = fade;
    if (t.kind === 'palm') {
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.quadraticCurveTo(t.x + 25, t.y - 90, t.x + 8, t.y - 170);
      ctx.stroke();
      const cx = t.x + 8, cy = t.y - 170;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3;
        ctx.fillStyle = `hsl(${t.hue},55%,${i % 2 ? 32 : 38}%)`;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 50, cy + Math.sin(a) * 26, 62, 18, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#6b3f1d';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx - 10 + i * 10, cy + 10, 8, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.fillStyle = '#7a4a22';
      ctx.fillRect(t.x - 14, t.y - 90, 28, 90);
      const r = t.r;
      const blobs = [[0, -150, 1], [-r * 0.55, -120, 0.75], [r * 0.55, -120, 0.75], [-r * 0.3, -190, 0.7], [r * 0.3, -185, 0.7]];
      blobs.forEach(([dx, dy, s], i) => {
        ctx.fillStyle = `hsl(${t.hue},50%,${26 + i * 3}%)`;
        ctx.beginPath();
        ctx.arc(t.x + dx, t.y + dy, r * 0.62 * s, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = `hsla(${t.hue},60%,55%,0.35)`;
      ctx.beginPath();
      ctx.arc(t.x - r * 0.2, t.y - 175, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld(time) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x, -cam.y);
    const vx0 = cam.x - W / 2 / zoom, vx1 = cam.x + W / 2 / zoom;
    const vy0 = cam.y - H / 2 / zoom, vy1 = cam.y + H / 2 / zoom;

    // Dark jungle beyond the edges.
    ctx.fillStyle = '#1d4d1c';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    drawGround(Math.max(vx0, 0), Math.max(vy0, 0), Math.min(vx1, world.w), Math.min(vy1, world.h));

    // Everything that stands up gets sorted by its feet so things overlap nicely.
    const things = [];
    for (const t of trees) {
      if (t.x < vx0 - 200 || t.x > vx1 + 200 || t.y < vy0 - 20 || t.y > vy1 + 260) continue;
      things.push({ y: t.y, draw: () => {
        // Fade a tree when Jojo or a Momo is hiding behind it.
        const behind = (o, h) => o.y < t.y && Math.hypot(o.x - t.x, o.y - h / 2 - (t.y - 150)) < t.r * 0.9;
        let fade = 1;
        if (behind(jojo, JOJO_H) || monkeys.some((m) => !m.found && behind(m, MOMO_H))) fade = 0.55;
        drawTree(t, fade);
      } });
    }
    for (const m of monkeys) {
      things.push({ y: m.y, draw: () => {
        const hop = Math.abs(Math.sin(m.phase * (m.found ? 9 : 4))) * (m.found ? 10 : 7);
        shadow(m.x, m.y, 22);
        drawSprite(images.momo, m.x, m.y - hop, MOMO_H, m.face, Math.sin(m.phase * 3) * 0.08);
      } });
    }
    things.push({ y: jojo.y, draw: () => {
      const bob = Math.abs(Math.sin(jojo.walk)) * 6;
      const tilt = Math.sin(jojo.walk) * 0.07;
      shadow(jojo.x, jojo.y, 30);
      if (state === 'win') {
        const jump = Math.abs(Math.sin(time * 6)) * 24;
        drawSprite(images.jojo, jojo.x, jojo.y - jump, JOJO_H, jojo.face);
      } else {
        drawSprite(images.jojo, jojo.x, jojo.y - bob, JOJO_H, jojo.face, tilt);
      }
    } });
    things.sort((a, b) => a.y - b.y);
    for (const th of things) th.draw();

    for (const b of butterflies) {
      if (b.x < vx0 || b.x > vx1 || b.y < vy0 || b.y > vy1) continue;
      const flap = Math.abs(Math.sin(b.t * 14));
      ctx.fillStyle = b.c;
      ctx.beginPath();
      ctx.ellipse(b.x - 5 * flap, b.y - 60, 6 * flap + 1, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(b.x + 5 * flap, b.y - 60, 6 * flap + 1, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const s of sparkles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life * 2));
      ctx.fillStyle = s.c;
      star(s.x, s.y, 6);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function star(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function bubbleText(text, x, y, size, fill = '#ffffff') {
    ctx.font = `bold ${size}px "Comic Sans MS", "Chalkboard SE", "Marker Felt", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.22;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function drawHud(time) {
    const found = monkeys.filter((m) => m.found).length;
    const total = monkeys.length;
    const pad = 14;
    // Counter pill with a little Momo face.
    const pillH = 56;
    const pillW = 190;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(pad, pad, pillW, pillH, 28);
    ctx.fill();
    const img = images.momo;
    const ih = 46, iw = (img.width / img.height) * ih;
    ctx.drawImage(img, pad + 10, pad + 5, iw, ih);
    bubbleText(`${found} / ${total}`, pad + 10 + iw + (pillW - iw - 20) / 2, pad + pillH / 2 + 2, 28, '#ffd23f');

    // Sound button.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(W - 42, 42, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(W - 56, 36); ctx.lineTo(W - 49, 36); ctx.lineTo(W - 40, 28); ctx.lineTo(W - 40, 56); ctx.lineTo(W - 49, 48); ctx.lineTo(W - 56, 48);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    if (muted) {
      ctx.beginPath(); ctx.moveTo(W - 34, 36); ctx.lineTo(W - 24, 48); ctx.moveTo(W - 24, 36); ctx.lineTo(W - 34, 48); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(W - 38, 42, 7, -0.9, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(W - 38, 42, 13, -0.9, 0.9); ctx.stroke();
    }

    // Arrows at the screen edge pointing toward Momos you can't see yet.
    const margin = 34;
    for (const m of monkeys) {
      if (m.found) continue;
      const sx = W / 2 + (m.x - cam.x) * zoom;
      const sy = H / 2 + (m.y - MOMO_H / 2 - cam.y) * zoom;
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
      const dx = sx - W / 2, dy = sy - H / 2;
      const s = Math.min((W / 2 - margin) / Math.abs(dx || 1e-6), (H / 2 - margin) / Math.abs(dy || 1e-6));
      const ax = W / 2 + dx * s, ay = H / 2 + dy * s;
      const a = Math.atan2(dy, dx);
      const pulse = 1 + Math.sin(time * 5) * 0.12;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(255,210,63,0.9)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }

    if (stateTime < 3) {
      ctx.globalAlpha = Math.min(1, 3 - stateTime);
      bubbleText(level === 1 ? 'Find all the Momos!' : `Level ${level}: find ${total} Momos!`, W / 2, H * 0.22, Math.min(46, W / 12));
      ctx.globalAlpha = 1;
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTitle(time) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!assetsReady()) {
      bubbleText('Loading...', W / 2, H / 2, 32);
      return;
    }
    const img = images.title;
    const s = Math.min(W / img.width, H / img.height);
    const iw = img.width * s, ih = img.height * s;
    ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
    const pulse = 1 + Math.sin(time * 4) * 0.06;
    ctx.save();
    ctx.translate(W / 2, H - Math.max(50, H * 0.09));
    ctx.scale(pulse, pulse);
    bubbleText('Tap to play!', 0, 0, Math.min(48, W / 11), '#ffd23f');
    ctx.restore();
  }

  function drawWin(time) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);
    for (const c of confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.r);
      ctx.fillStyle = c.c;
      ctx.fillRect(-5, -3, 10, 6);
      ctx.restore();
    }
    const size = Math.min(52, W / 11);
    bubbleText('Hooray!', W / 2, H * 0.18, size * 1.3, '#ffd23f');
    bubbleText(`Jojo found all ${monkeys.length} Momos!`, W / 2, H * 0.18 + size * 1.4, size * 0.75);
    if (stateTime > 1.2) {
      const pulse = 1 + Math.sin(time * 4) * 0.06;
      ctx.save();
      ctx.translate(W / 2, H - Math.max(50, H * 0.1));
      ctx.scale(pulse, pulse);
      bubbleText('Tap for more Momos!', 0, 0, size * 0.8, '#7dff6a');
      ctx.restore();
    }
  }

  // ---------- loop ----------
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const time = now / 1000;
    update(dt);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state === 'title') {
      drawTitle(time);
    } else {
      drawWorld(time);
      if (state === 'play') drawHud(time);
      if (state === 'win') drawWin(time);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (location.hash === '#debug') window.__jojo = { jojo, get monkeys() { return monkeys; }, get state() { return state; } };
})();
