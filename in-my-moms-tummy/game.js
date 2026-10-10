// In My Mom's Tummy: a one-button womb bouncer.
// Press space / click / tap / any gamepad face button to kick off toward where the baby's head points.
(async () => {
  const PINK = 0xe600e0;
  const TITLE_BG = 0xf6f6f6;
  const WOMB_BG = 0xffa6f2;

  const app = new PIXI.Application();
  await app.init({
    resizeTo: window,
    background: WOMB_BG,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  document.body.appendChild(app.canvas);

  const tex = await PIXI.Assets.load(['assets/baby.png', 'assets/ow.png', 'assets/title.jpg']);
  const babyTex = tex['assets/baby.png'], owTex = tex['assets/ow.png'], titleTex = tex['assets/title.jpg'];

  // ---------- fullscreen ----------
  const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function enterFullscreen() {
    if (isFullscreen()) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return; // e.g. iPhone Safari: add to home screen for fullscreen
    try {
      const p = req.call(el, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  function exitFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit && isFullscreen()) exit.call(document);
  }

  // ---------- scenes ----------
  const title = new PIXI.Container();
  const game = new PIXI.Container();
  app.stage.addChild(game, title);
  game.visible = false;

  // title screen
  const titleBg = new PIXI.Graphics();
  const titleArt = new PIXI.Sprite(titleTex);
  titleArt.anchor.set(0.5);
  const prompt = new PIXI.Text({
    text: 'press to play!',
    style: { fontFamily: 'Comic Sans MS, Chalkboard SE, Marker Felt, sans-serif', fontWeight: 'bold', fill: 0x111111, fontSize: 32 },
  });
  prompt.anchor.set(0.5);
  title.addChild(titleBg, titleArt, prompt);

  // game screen
  const world = new PIXI.Container();   // shaken on hits
  const womb = new PIXI.Container();    // pulses like a heartbeat
  const scribble = new PIXI.Graphics();
  womb.addChild(scribble);
  const bubbles = new PIXI.Container();
  const baby = new PIXI.Sprite(babyTex);
  baby.anchor.set(0.42, 0.62); // body centre; the hair sticks out above
  const ows = new PIXI.Container();
  world.addChild(womb, bubbles, ows, baby);

  const hud = new PIXI.Container();
  const hudIcon = new PIXI.Sprite(owTex);
  hudIcon.anchor.set(0, 0.5);
  const hudText = new PIXI.Text({
    text: '× 0',
    style: { fontFamily: 'Comic Sans MS, Chalkboard SE, Marker Felt, sans-serif', fontWeight: 'bold', fill: 0x111111, fontSize: 32 },
  });
  hudText.anchor.set(0, 0.5);
  hud.addChild(hudIcon, hudText);
  game.addChild(world, hud);

  // ---------- layout ----------
  let W = 0, H = 0, U = 0;   // U = unit length (short side of screen)
  let cx = 0, cy = 0, A = 0, B = 0, R = 0; // womb centre, semi-axes, baby radius

  function rand(a, b) { return a + Math.random() * (b - a); }

  function drawScribble() {
    scribble.clear();
    const lw = Math.max(6, U * 0.024);
    const loops = 16;
    for (let i = 0; i < loops; i++) {
      // first loop sits right on the wall; the rest wander outward
      const off = i === 0 ? 0 : rand(0, U * 0.16);
      const a = A + lw * 0.5 + off, b = B + lw * 0.5 + off * rand(0.6, 1.2);
      const tilt = i === 0 ? 0 : rand(-0.12, 0.12);
      const ph1 = rand(0, 6.28), ph2 = rand(0, 6.28);
      const wob = i === 0 ? 0 : U * 0.025;
      const ox = i === 0 ? 0 : rand(-1, 1) * U * 0.03;
      const oy = i === 0 ? 0 : rand(-1, 1) * U * 0.03;
      const start = rand(0, 6.28);
      const sweep = i === 0 ? Math.PI * 2 : rand(Math.PI * 1.3, Math.PI * 2.2);
      const steps = 90;
      for (let s = 0; s <= steps; s++) {
        const t = start + (s / steps) * sweep;
        const w = wob * (Math.sin(t * 3 + ph1) + 0.5 * Math.sin(t * 5 + ph2));
        let x = (a + w) * Math.cos(t), y = (b + w) * Math.sin(t);
        const xr = x * Math.cos(tilt) - y * Math.sin(tilt);
        const yr = x * Math.sin(tilt) + y * Math.cos(tilt);
        x = cx + ox + xr; y = cy + oy + yr;
        if (s === 0) scribble.moveTo(x, y); else scribble.lineTo(x, y);
      }
      scribble.stroke({ width: i === 0 ? lw * 1.4 : lw, color: PINK, cap: 'round', join: 'round', alpha: i === 0 ? 1 : 0.9 });
    }
    // a couple of big swoopy strokes like the drawing's left side
    for (let i = 0; i < 2; i++) {
      const x0 = cx - A - U * rand(0.04, 0.12);
      scribble.moveTo(x0, cy + B * 0.9).quadraticCurveTo(x0 - U * 0.05, cy - B * 1.3, x0 + U * 0.04, cy - B * 0.95);
      scribble.stroke({ width: lw, color: PINK, cap: 'round', join: 'round', alpha: 0.9 });
    }
  }

  function layout() {
    W = app.screen.width; H = app.screen.height; U = Math.min(W, H);
    cx = W / 2; cy = H / 2;
    const pad = U * 0.1;
    A = Math.max(U * 0.25, W / 2 - pad);
    B = Math.max(U * 0.25, H / 2 - pad);

    const babySize = U * 0.2; // head + body, not counting the hair
    baby.scale.set((babySize * 1.5) / babyTex.height);
    baseBabyScale = baby.scale.x;
    R = babySize * 0.45;

    womb.pivot.set(cx, cy);
    womb.position.set(cx, cy);
    drawScribble();

    const iconH = U * 0.08;
    hudIcon.scale.set(iconH / owTex.height);
    hudText.style.fontSize = Math.round(U * 0.06);
    hudText.x = hudIcon.width + U * 0.01;
    hud.position.set(U * 0.04, U * 0.04 + iconH / 2);

    titleBg.clear().rect(0, 0, W, H).fill(TITLE_BG);
    const s = Math.min(W / titleTex.width, (H * 0.86) / titleTex.height);
    titleArt.scale.set(s);
    titleArt.position.set(W / 2, H * 0.45);
    prompt.style.fontSize = Math.round(U * 0.06);
    prompt.position.set(W / 2, H - U * 0.07);

    // keep the baby inside after a resize
    if (state.started) collide(true);
    else { state.x = cx; state.y = cy; }
  }

  // ---------- game state ----------
  let baseBabyScale = 1;
  const state = {
    started: false,
    x: 0, y: 0, vx: 0, vy: 0,
    rot: 0, spin: 1.6,
    squash: 0, shake: 0, beat: 0, count: 0,
  };
  const BASE_SPIN = 1.6;    // rad/s the baby settles back to, so you can time your kick
  const DRAG = 0.9;         // per second
  const RESTITUTION = 0.88;

  function resetGame() {
    state.x = cx; state.y = cy; state.vx = 0; state.vy = 0;
    state.rot = 0; state.spin = BASE_SPIN; state.count = 0;
    hudText.text = '× 0';
    ows.removeChildren().forEach(o => o.destroy());
  }

  function startGame() {
    state.started = true;
    title.visible = false;
    game.visible = true;
    resetGame();
  }

  function kick() {
    const dx = Math.sin(state.rot), dy = -Math.cos(state.rot);
    const impulse = U * 1.5;
    state.vx += dx * impulse; state.vy += dy * impulse;
    const sp = Math.hypot(state.vx, state.vy), max = U * 4;
    if (sp > max) { state.vx *= max / sp; state.vy *= max / sp; }
    state.squash = 1;
    for (let i = 0; i < 6; i++) spawnBubble(state.x - dx * R, state.y - dy * R, -dx, -dy);
  }

  function press() {
    if (!state.started) startGame();
    else kick();
  }

  // ---------- effects ----------
  function spawnBubble(x, y, dx, dy) {
    const g = new PIXI.Graphics().circle(0, 0, U * rand(0.006, 0.016)).stroke({ width: Math.max(2, U * 0.004), color: 0xffffff, alpha: 0.8 });
    g.position.set(x, y);
    const sp = U * rand(0.2, 0.6), a = rand(-0.6, 0.6);
    const c = Math.cos(a), s = Math.sin(a);
    g.vx = (dx * c - dy * s) * sp; g.vy = (dx * s + dy * c) * sp;
    g.life = g.maxLife = rand(0.5, 0.9);
    bubbles.addChild(g);
  }

  function spawnOw(x, y, strength) {
    if (ows.children.length > 12) ows.children[0].destroy();
    const o = new PIXI.Sprite(owTex);
    o.anchor.set(0.5);
    o.position.set(x, y);
    o.rotation = rand(-0.5, 0.5);
    o.target = (U * (0.1 + 0.06 * strength)) / owTex.height;
    o.scale.set(0.01);
    o.life = o.maxLife = 1.0;
    ows.addChild(o);
  }

  // ---------- physics ----------
  function collide(quiet) {
    const a = A - R, b = B - R;
    const px = state.x - cx, py = state.y - cy;
    const q = Math.hypot(px / a, py / b);
    if (q <= 1) return;
    // push back onto the ellipse, then bounce off its normal
    state.x = cx + px / q; state.y = cy + py / q;
    let nx = px / (a * a), ny = py / (b * b);
    const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
    const vn = state.vx * nx + state.vy * ny;
    if (vn <= 0) return;
    state.vx -= (1 + RESTITUTION) * vn * nx;
    state.vy -= (1 + RESTITUTION) * vn * ny;
    // glancing hits spin the baby; every hit adds a bit of tumble
    const vt = state.vx * -ny + state.vy * nx;
    state.spin += (vt / R) * 0.5 + Math.sign(vt || 1) * (vn / R) * 0.25;
    if (quiet) return;
    const strength = Math.min(1, vn / (U * 2));
    if (vn > U * 0.25) {
      const side = rand(-0.8, 0.8) * R;
      spawnOw(state.x - nx * R * 1.4 - ny * side, state.y - ny * R * 1.4 + nx * side, strength);
      state.count++;
      hudText.text = '× ' + state.count;
      state.shake = Math.max(state.shake, strength);
      state.squash = Math.max(state.squash, 0.6 + strength * 0.6);
    }
  }

  function step(dt) {
    state.vx *= Math.exp(-DRAG * dt);
    state.vy *= Math.exp(-DRAG * dt);
    state.spin += (BASE_SPIN - state.spin) * (1 - Math.exp(-0.9 * dt));
    state.rot += state.spin * dt;
    // substeps keep fast babies from tunnelling through the wall
    const n = Math.max(1, Math.ceil((Math.hypot(state.vx, state.vy) * dt) / (R * 0.25)));
    for (let i = 0; i < n; i++) {
      state.x += (state.vx * dt) / n;
      state.y += (state.vy * dt) / n;
      collide(false);
    }
  }

  // ---------- input ----------
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') {
      isFullscreen() ? exitFullscreen() : enterFullscreen();
      return;
    }
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      enterFullscreen();
      press();
    }
  });
  window.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    enterFullscreen();
    press();
  }, { passive: false });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  const padPrev = {};
  function pollGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const prev = padPrev[gp.index] || [];
      const now = gp.buttons.map(b => b.pressed);
      // 0-3 are the face buttons (A/B/X/Y); Start (9) also works on the title screen
      for (let i = 0; i < now.length; i++) {
        if (now[i] && !prev[i] && (i <= 3 || (i === 9 && !state.started))) { press(); break; }
      }
      padPrev[gp.index] = now;
    }
  }

  // ---------- loop ----------
  let time = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(tk.deltaMS / 1000, 1 / 20);
    time += dt;
    pollGamepads();

    if (!state.started) {
      prompt.alpha = 0.55 + 0.45 * Math.sin(time * 4);
      prompt.scale.set(1 + 0.04 * Math.sin(time * 4));
      titleArt.rotation = 0.015 * Math.sin(time * 1.3);
      return;
    }

    step(dt);

    // baby
    baby.position.set(state.x, state.y);
    baby.rotation = state.rot;
    state.squash = Math.max(0, state.squash - dt * 4);
    const sq = Math.sin(state.squash * Math.PI) * 0.18;
    baby.scale.set(baseBabyScale * (1 + sq), baseBabyScale * (1 - sq));

    // heartbeat
    const beat = (time * 1.4) % 1;
    const pulse = Math.exp(-beat * 9) + 0.6 * Math.exp(-Math.abs(beat - 0.22) * 14);
    womb.scale.set(1 + 0.012 * pulse);

    // shake
    state.shake = Math.max(0, state.shake - dt * 3);
    const sh = state.shake * state.shake * U * 0.03;
    world.position.set(rand(-sh, sh), rand(-sh, sh));

    // ows: pop in, wobble, fade out
    for (const o of [...ows.children]) {
      o.life -= dt;
      if (o.life <= 0) { o.destroy(); continue; }
      const age = o.maxLife - o.life;
      const pop = age < 0.15 ? age / 0.15 * 1.25 : 1 + 0.25 * Math.exp(-(age - 0.15) * 12);
      o.scale.set(o.target * pop);
      o.alpha = Math.min(1, o.life / 0.35);
    }

    // bubbles drift and fade
    for (const b of [...bubbles.children]) {
      b.life -= dt;
      if (b.life <= 0) { b.destroy(); continue; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vx *= Math.exp(-3 * dt); b.vy *= Math.exp(-3 * dt);
      b.alpha = b.life / b.maxLife;
    }
  });

  app.renderer.on('resize', layout);
  layout();
})();
