import { input } from './input.js';
import { sfx, unlockAudio } from './audio.js';
import { textSprite } from './crayon.js';
import * as art from './art.js';
import { LEVEL, GROUND_Y } from './level.js';

const { W, H } = art;
const GRAVITY = 2300;

// ---------- app + scaling ----------
const app = new PIXI.Application();
await app.init({ width: W, height: H, background: '#fbf6ec', antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
document.getElementById('game').appendChild(app.canvas);

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  app.canvas.style.width = `${Math.floor(W * s)}px`;
  app.canvas.style.height = `${Math.floor(H * s)}px`;
}
window.addEventListener('resize', fit);
document.addEventListener('fullscreenchange', fit);
fit();

// ---------- fullscreen ----------
function toggleFullscreen() {
  unlockAudio();
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  } catch (e) { /* not allowed right now */ }
}

// ---------- textures ----------
const loading = document.getElementById('loading');
const T = {
  pig: await PIXI.Assets.load('assets/pig.png'),
  enemy: await PIXI.Assets.load('assets/enemy.png'),
};
await new Promise((r) => setTimeout(r, 0));
Object.assign(T, {
  marsSky: art.marsSky(),
  farHills: art.farHills(),
  nearHills: art.nearHills(),
  pole: art.flagPoleTexture(),
  cloth: art.flagClothTexture(),
  rocket: art.rocketTexture(),
  flame: art.flameTexture(),
  space: art.spaceSky(),
  blueSky: art.blueSky(),
  blueGround: art.blueGround(),
  burst: art.ouchBurst(),
  rocks: [1, 2, 3].map((s) => art.rockTexture(s * 7, 26 + s * 8)),
});
const groundCache = new Map();
function groundTex(rect, i) {
  const key = rect.join(',');
  if (!groundCache.has(key)) groundCache.set(key, art.groundTexture(rect[2], rect[3], 500 + i * 13, { floating: rect[3] <= 60 && rect[1] + rect[3] < GROUND_Y - 1 }));
  return groundCache.get(key);
}
const plantCache = new Map();
const plantTex = (c) => { if (!plantCache.has(c)) plantCache.set(c, art.plantTexture(c.length * 31 + c.charCodeAt(1), c)); return plantCache.get(c); };
const words = new Map();
function word(str, size, color, opts = {}) {
  const key = [str, size, color, JSON.stringify(opts)].join('|');
  if (!words.has(key)) words.set(key, textSprite(str, size, color, opts).texture);
  const s = new PIXI.Sprite(words.get(key));
  s.anchor.set(0.5);
  return s;
}
loading.remove();

// ---------- scene switching with a crayon-ish fade ----------
const fader = new PIXI.Graphics().rect(0, 0, W, H).fill(0x2b2622);
fader.alpha = 0;
let scene = null, fading = null;
function setScene(s) {
  if (scene) scene.root.destroy({ children: true });
  scene = s;
  app.stage.addChildAt(s.root, 0);
}
function goto(make, dur = 0.35) {
  if (fading) return;
  fading = { t: 0, make, dur, swapped: false };
}
app.stage.addChild(fader);

// ---------- shared physics ----------
const overlaps = (a, s) => a.x - a.w / 2 < s[0] + s[2] && a.x + a.w / 2 > s[0] && a.y - a.h < s[1] + s[3] && a.y > s[1];

// Moves a body (x = centre, y = feet) and stops it against solid rects.
function moveBody(b, dt, solids) {
  b.x += b.vx * dt;
  for (const s of solids) {
    if (!overlaps(b, s)) continue;
    if (b.vx > 0) b.x = s[0] - b.w / 2; else if (b.vx < 0) b.x = s[0] + s[2] + b.w / 2;
    b.hitWall = true;
    b.vx = 0;
  }
  b.onGround = false;
  b.y += b.vy * dt;
  for (const s of solids) {
    if (!overlaps(b, s)) continue;
    if (b.vy > 0) { b.y = s[1]; b.onGround = true; } else if (b.vy < 0) { b.y = s[1] + s[3] + b.h; b.bonked = true; }
    b.vy = 0;
  }
}

// ---------- the pig ----------
class Pig {
  constructor(parent, x, y) {
    this.sprite = new PIXI.Sprite(T.pig);
    this.sprite.anchor.set(0.5, 0.98);
    this.base = 132 / T.pig.height;
    parent.addChild(this.sprite);
    Object.assign(this, { x, y, w: 34, h: 116, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, buffer: 0, walkT: 0, squash: 1, prevY: y });
  }

  control(dt, solids, auto = null) {
    this.prevY = this.y;
    const left = auto ? auto < 0 : input.left, right = auto ? auto > 0 : input.right;
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    const max = auto ? 260 : input.run ? 480 : 330;
    if (dir) {
      const accel = this.onGround ? 2600 : 1800;
      const turning = Math.sign(this.vx) !== dir && this.vx !== 0;
      const before = Math.abs(this.vx);
      this.vx += dir * accel * (turning ? 1.8 : 1) * dt;
      // cap at top speed; if we were already faster (let go of run), ease down
      if (Math.abs(this.vx) > max) this.vx = Math.sign(this.vx) * Math.max(max, Math.min(Math.abs(this.vx), before) - 1500 * dt);
      this.face = dir;
    } else {
      const f = (this.onGround ? 3000 : 700) * dt;
      this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
    }

    if (!auto) {
      if (input.jumpPressed) this.buffer = 0.13;
      this.buffer -= dt;
      this.coyote = this.onGround ? 0.1 : this.coyote - dt;
      if (this.buffer > 0 && this.coyote > 0) {
        this.vy = -(950 + Math.abs(this.vx) * 0.12);
        this.buffer = 0; this.coyote = 0;
        this.squash = 1.25;
        sfx.jump();
      }
    }
    this.vy += GRAVITY * dt;
    if (!auto && this.vy < 0 && !input.jump) this.vy += GRAVITY * 1.4 * dt; // short hop when you let go
    this.vy = Math.min(this.vy, 1400);

    const wasGround = this.onGround;
    moveBody(this, dt, solids);
    if (this.onGround && !wasGround) this.squash = 0.78;
  }

  draw(dt) {
    const s = this.sprite;
    this.squash += (1 - this.squash) * Math.min(1, dt * 12);
    const moving = this.onGround && Math.abs(this.vx) > 20;
    this.walkT += dt * (moving ? Math.abs(this.vx) / 22 : 0);
    if (!moving) this.walkT *= 0.8;
    const sy = this.squash, sx = 1 / Math.sqrt(sy);
    s.x = this.x;
    s.y = this.y - (moving ? Math.abs(Math.sin(this.walkT)) * 5 : 0);
    s.scale.set(this.base * sx * this.face, this.base * sy);
    const lean = this.onGround ? Math.sin(this.walkT) * 0.09 : this.vy < 0 ? -0.06 * this.face : 0.05 * this.face;
    s.rotation += (lean - s.rotation) * Math.min(1, dt * 14);
  }
}

// ---------- the enemy ----------
class Enemy {
  constructor(parent, def) {
    this.sprite = new PIXI.Sprite(T.enemy);
    this.sprite.anchor.set(0.5, 0.97);
    this.base = 82 / T.enemy.height;
    parent.addChild(this.sprite);
    Object.assign(this, { x: def.x, y: def.y ?? GROUND_Y, w: 60, h: 70, vx: -75, vy: 0, min: def.min, max: def.max, t: Math.random() * 6, dead: 0 });
  }

  update(dt, solids) {
    if (this.dead) {
      this.dead += dt;
      this.sprite.scale.set(this.base * 1.4, this.base * Math.max(0.25, 1 - this.dead * 6));
      this.sprite.alpha = Math.max(0, 1 - (this.dead - 0.35) * 3);
      return;
    }
    this.t += dt;
    this.hitWall = false;
    this.vy += GRAVITY * dt;
    const vx = this.vx;
    moveBody(this, dt, solids);
    // turn around at walls, at the ends of the patrol, and at ledges
    const ahead = this.x + Math.sign(vx) * (this.w / 2 + 4);
    const floorAhead = solids.some((s) => ahead > s[0] && ahead < s[0] + s[2] && Math.abs(s[1] - this.y) < 4);
    if (this.hitWall || (this.onGround && !floorAhead) || (vx < 0 && this.x < this.min) || (vx > 0 && this.x > this.max)) this.vx = -vx;
    else this.vx = vx;

    const s = this.sprite;
    s.x = this.x;
    s.y = this.y;
    const bob = Math.sin(this.t * 9);
    s.scale.set(this.base * (vx > 0 ? -1 : 1) * (1 + bob * 0.04), this.base * (1 - bob * 0.04));
    s.rotation = Math.sin(this.t * 4.5) * 0.12;
  }
}

// little floating word, e.g. BOP!
function pop(parent, str, x, y, color = '#e2403b') {
  const s = word(str, 34, color);
  s.x = x; s.y = y;
  parent.addChild(s);
  return { s, t: 0 };
}

// ---------- title ----------
function Title() {
  const root = new PIXI.Container();
  root.addChild(new PIXI.Sprite(T.marsSky));
  const hills = new PIXI.TilingSprite({ texture: T.nearHills, width: W, height: 330 });
  hills.y = 470;
  root.addChild(hills);
  const g = groundTex([0, GROUND_Y, W, 160], 99);
  const ground = new PIXI.Sprite(g.texture);
  ground.x = -g.pad; ground.y = GROUND_Y - g.pad;
  root.addChild(ground);

  const title1 = word('BABA BOO', 92, '#e2403b', { colors: ['#e2403b', '#31b39a', '#f28a2e', '#3a7bd5'], seed: 5, width: 12 });
  const title2 = word('BEE BA', 92, '#e2403b', { colors: ['#3a7bd5', '#e65ca0', '#31b39a'], seed: 9, width: 12 });
  title1.position.set(W / 2, 250);
  title2.position.set(W / 2, 370);
  const pig = new PIXI.Sprite(T.pig);
  pig.anchor.set(0.5, 1); pig.scale.set(200 / T.pig.height);
  pig.position.set(300, GROUND_Y + 4);
  const enemy = new PIXI.Sprite(T.enemy);
  enemy.anchor.set(0.5, 1); enemy.scale.set(110 / T.enemy.height);
  enemy.position.set(990, GROUND_Y + 4);
  const press = word('PRESS A TO START', 40, '#2b2622', { seed: 3 });
  press.position.set(W / 2, 520);
  root.addChild(title1, title2, pig, enemy, press);
  let t = 0;
  return {
    root,
    update(dt) {
      t += dt;
      hills.tilePosition.x -= dt * 20;
      title1.rotation = Math.sin(t * 2) * 0.03;
      title2.rotation = Math.sin(t * 2 + 1) * 0.03;
      pig.rotation = Math.sin(t * 3) * 0.08;
      pig.y = GROUND_Y + 4 - Math.abs(Math.sin(t * 3)) * 18;
      enemy.rotation = Math.sin(t * 4) * 0.12;
      enemy.scale.x = (110 / T.enemy.height) * (Math.sin(t * 0.7) > 0 ? 1 : -1);
      press.alpha = 0.55 + Math.sin(t * 4) * 0.45;
      if (input.confirmPressed) { unlockAudio(); sfx.jump(); goto(Level); }
    },
  };
}

// ---------- the red planet ----------
function Level() {
  const root = new PIXI.Container();
  root.addChild(new PIXI.Sprite(T.marsSky));
  const far = new PIXI.TilingSprite({ texture: T.farHills, width: W, height: 420 });
  far.y = 290;
  const near = new PIXI.TilingSprite({ texture: T.nearHills, width: W, height: 330 });
  near.y = 440;
  root.addChild(far, near);

  const world = new PIXI.Container();
  root.addChild(world);
  const solids = [...LEVEL.platforms, ...LEVEL.ground];
  const decor = new PIXI.Container();
  world.addChild(decor);

  for (const [x, i] of LEVEL.rocks) {
    const s = new PIXI.Sprite(T.rocks[i - 1]);
    s.anchor.set(0.5, 1); s.position.set(x, GROUND_Y + 10);
    decor.addChild(s);
  }
  for (const [x, c] of LEVEL.plants) {
    const s = new PIXI.Sprite(plantTex(c));
    s.anchor.set(0.5, 1); s.position.set(x, GROUND_Y + 8);
    decor.addChild(s);
  }
  const hint = word('PRESS A TO JUMP', 30, '#2b2622', { seed: 8 });
  hint.position.set(560, 330);
  hint.alpha = 0.75;
  decor.addChild(hint);

  // flag + rocket
  const pole = new PIXI.Sprite(T.pole);
  pole.anchor.set(0.5, 1); pole.position.set(LEVEL.flagX, GROUND_Y + 6);
  const cloth = new PIXI.Sprite(T.cloth);
  cloth.anchor.set(0, 0); cloth.position.set(LEVEL.flagX + 2, GROUND_Y - 320);
  const rocket = new PIXI.Container();
  const flame = new PIXI.Sprite(T.flame);
  flame.anchor.set(0.5, 0); flame.position.set(0, -40); flame.visible = false;
  const ship = new PIXI.Sprite(T.rocket);
  ship.anchor.set(0.5, 1);
  rocket.addChild(flame, ship);
  rocket.position.set(LEVEL.rocketX, GROUND_Y + 14);
  world.addChild(pole, cloth, rocket);

  ;[...LEVEL.platforms, ...LEVEL.ground].forEach((rect, i) => {
    const g = groundTex(rect, i);
    const s = new PIXI.Sprite(g.texture);
    s.position.set(rect[0] - g.pad, rect[1] - g.pad);
    world.addChild(s);
  });

  const enemyLayer = new PIXI.Container();
  world.addChild(enemyLayer);
  const enemies = LEVEL.enemies.map((d) => new Enemy(enemyLayer, d));
  const pig = new Pig(world, ...LEVEL.start);
  const pops = [];

  let state = 'play', t = 0, cam = 0;

  function die() {
    if (state !== 'play') return;
    state = 'dead'; t = 0;
    sfx.ouch();
    pig.vy = -700; pig.vx = 0;
  }

  return {
    root,
    pig, enemies,
    get state() { return state; },
    update(dt) {
      t += dt;
      if (state === 'play') {
        pig.control(dt, solids);
        if (pig.x < pig.w / 2) { pig.x = pig.w / 2; pig.vx = 0; }
        if (pig.y > H + 150) die();
        for (const e of enemies) {
          e.update(dt, solids);
          if (e.dead || !overlaps(pig, [e.x - e.w / 2, e.y - e.h, e.w, e.h])) continue;
          if (pig.vy > 0 && pig.prevY <= e.y - e.h + 20) {
            e.dead = 0.001;
            pig.vy = input.jump ? -900 : -620;
            pig.squash = 1.2;
            sfx.stomp();
            pops.push(pop(world, ['BOP!', 'BONK!', 'SPLAT!'][Math.floor(Math.random() * 3)], e.x, e.y - 90));
          } else die();
        }
        if (pig.x >= LEVEL.flagX - 20) {
          state = 'flag'; t = 0;
          pig.x = LEVEL.flagX - 16; pig.vx = 0; pig.vy = 0; pig.face = 1;
          sfx.flag();
        }
      } else if (state === 'dead') {
        pig.vy += GRAVITY * 0.8 * dt;
        pig.y += pig.vy * dt;
        pig.sprite.rotation += dt * 8;
        enemies.forEach((e) => e.update(dt * 0.2, solids));
        if (t > 1.1) goto(Ouch);
      } else if (state === 'flag') {
        // slide down the pole with the flag
        pig.y = Math.min(GROUND_Y, pig.y + 420 * dt);
        cloth.y = Math.min(GROUND_Y - 110, Math.max(cloth.y, pig.y - 130));
        if (pig.y >= GROUND_Y && t > 0.6) { state = 'walk'; t = 0; }
      } else if (state === 'walk') {
        // carry on to the rocket and climb in
        pig.control(dt, solids, 1);
        if (pig.x >= LEVEL.rocketX - 10) { state = 'board'; t = 0; }
      } else if (state === 'board') {
        pig.sprite.alpha = Math.max(0, 1 - t * 2);
        pig.y -= dt * 60;
        if (t > 0.6) { state = 'launch'; t = 0; sfx.rocket(); flame.visible = true; }
      } else if (state === 'launch') {
        const shake = t < 1 ? 4 : 1;
        rocket.x = LEVEL.rocketX + (Math.random() - 0.5) * shake * 2;
        if (t > 1) rocket.y -= (t - 1) * (t - 1) * 900 * dt * 4 + dt * 40;
        flame.scale.set(1 + Math.random() * 0.25, 0.8 + Math.random() * 0.5 + (t > 1 ? 0.5 : 0));
        if (t > 3) goto(Space, 0.5);
      }
      if (state === 'dead') pig.sprite.position.set(pig.x, pig.y);
      else if (state !== 'launch') pig.draw(dt);

      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        p.t += dt; p.s.y -= dt * 60; p.s.alpha = 1 - p.t;
        if (p.t > 1) { p.s.destroy(); pops.splice(i, 1); }
      }

      const target = Math.max(0, Math.min(LEVEL.width - W, pig.x - W * 0.4));
      if (state !== 'dead') cam += (target - cam) * Math.min(1, dt * 8);
      world.x = -Math.round(cam);
      far.tilePosition.x = -cam * 0.2;
      near.tilePosition.x = -cam * 0.45;
    },
  };
}

// ---------- ouch ----------
function Ouch() {
  const root = new PIXI.Container();
  const bg = new PIXI.Sprite(T.marsSky);
  bg.tint = 0xff9a8a;
  const burst = new PIXI.Sprite(T.burst);
  burst.anchor.set(0.5); burst.position.set(W / 2, H / 2 - 30);
  const ouch = word('OUCH!', 160, '#e2403b', { seed: 12, width: 22 });
  ouch.position.set(W / 2, H / 2 - 40);
  const pig = new PIXI.Sprite(T.pig);
  pig.anchor.set(0.5); pig.scale.set(150 / T.pig.height); pig.position.set(W / 2 + 330, H / 2 + 150);
  root.addChild(bg, burst, ouch, pig);
  let t = 0;
  return {
    root,
    update(dt) {
      t += dt;
      const k = Math.min(1, t * 5);
      ouch.scale.set(0.3 + k * 0.7 + Math.sin(t * 20) * 0.03 * (1 - Math.min(1, t)));
      burst.rotation = Math.sin(t * 3) * 0.05;
      burst.scale.set(0.9 + Math.sin(t * 6) * 0.03);
      pig.rotation = 1.3 + Math.sin(t * 8) * 0.15;
      if (t > 2.2 || (t > 0.7 && input.confirmPressed)) goto(Level);
    },
  };
}

// ---------- flying to the blue planet ----------
function Space() {
  const root = new PIXI.Container();
  root.addChild(new PIXI.Sprite(T.space));
  const rocket = new PIXI.Container();
  const flame = new PIXI.Sprite(T.flame);
  flame.anchor.set(0.5, 0); flame.position.set(0, 120);
  const ship = new PIXI.Sprite(T.rocket);
  ship.anchor.set(0.5, 0.5);
  rocket.addChild(flame, ship);
  root.addChild(rocket);
  const zoom = word('ZOOM!', 70, '#f7d35c', { seed: 2, width: 10 });
  zoom.position.set(560, 640); zoom.alpha = 0;
  root.addChild(zoom);
  // a curve from the red planet up and over to the blue one
  const P = [[250, 470], [430, 60], [900, -40], [1110, 105]];
  const bez = (u, i) => (1 - u) ** 3 * P[0][i] + 3 * (1 - u) ** 2 * u * P[1][i] + 3 * (1 - u) * u * u * P[2][i] + u ** 3 * P[3][i];
  let t = 0, landed = false;
  const DUR = 4.2;
  return {
    root,
    update(dt) {
      t += dt;
      const u = Math.min(1, t / DUR);
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      const x = bez(e, 0), y = bez(e, 1);
      const x2 = bez(Math.min(1, e + 0.01), 0), y2 = bez(Math.min(1, e + 0.01), 1);
      rocket.position.set(x, y);
      let angle = Math.atan2(y2 - y, x2 - x) + Math.PI / 2;
      if (u > 0.85) angle *= (1 - u) / 0.15; // straighten up to land
      rocket.rotation = angle;
      rocket.scale.set(0.5 - e * 0.25);
      flame.scale.set(1 + Math.random() * 0.3, (u < 0.9 ? 1 : 0.4) + Math.random() * 0.4);
      zoom.alpha = Math.max(0, Math.sin(Math.min(1, t / 2.2) * Math.PI));
      zoom.scale.set(1 + Math.sin(t * 10) * 0.05);
      if (u >= 1 && !landed) { landed = true; sfx.land(); flame.visible = false; }
      if (t > DUR + 0.6) goto(TheEnd, 0.5);
    },
  };
}

// ---------- the blue planet: THE END, with letters you can knock around ----------
function TheEnd() {
  const root = new PIXI.Container();
  root.addChild(new PIXI.Sprite(T.blueSky));
  const ground = new PIXI.Sprite(T.blueGround);
  ground.y = GROUND_Y - 12;
  const rocket = new PIXI.Sprite(T.rocket);
  rocket.anchor.set(0.5, 1); rocket.position.set(150, GROUND_Y + 14);
  root.addChild(rocket, ground);

  const solids = [[-100, GROUND_Y, W + 200, 200], [-100, -2000, 100, 3000], [W, -2000, 100, 3000]];
  const colors = ['#e2403b', '#f28a2e', '#31b39a', '#3a7bd5', '#e65ca0', '#8e5ad6'];
  const letters = [];
  const layout = [['T', 0], ['H', 1], ['E', 2], ['E', 3.6], ['N', 4.6], ['D', 5.6]];
  layout.forEach(([ch, slot], i) => {
    const lt = art.letterTexture(ch, colors[i], 300 + i * 17);
    const s = new PIXI.Sprite(lt.texture);
    s.anchor.set(0.5, 0.5);
    root.addChild(s);
    letters.push({ ch, s, w: lt.w - 6, h: lt.h - 6, x: 330 + slot * 122, y: -150 - i * 140, vx: 0, vy: 0, rot: (Math.random() - 0.5) * 0.6, vr: 0, i, landed: false });
  });
  const pig = new Pig(root, 270, GROUND_Y);
  pig.sprite.alpha = 0;
  const again = word('PRESS SELECT TO PLAY AGAIN', 22, '#2b2622', { seed: 6 });
  again.position.set(W / 2, 40); again.alpha = 0;
  root.addChild(again);
  let t = 0, cheered = false;

  const box = (l) => [l.x - l.w / 2, l.y - l.h, l.w, l.h];

  function stepLetters(dt) {
    for (const l of letters) {
      l.vy += GRAVITY * dt;
      l.vy = Math.min(l.vy, 1600);
      const vyBefore = l.vy;
      moveBody(l, dt, solids);
      if (l.onGround) {
        if (vyBefore > 400) { l.vy = -vyBefore * 0.3; l.vr += (Math.random() - 0.5) * 3; if (!l.landed) sfx.bump(l.i); }
        l.landed = true;
        l.vx *= Math.pow(0.02, dt);
      }
      if (l.hitWall) { l.vx = -l.vx * 0.5; l.hitWall = false; }
    }
    // letters push each other apart
    for (let k = 0; k < 3; k++) {
      for (let a = 0; a < letters.length; a++) for (let b = a + 1; b < letters.length; b++) {
        const A = letters[a], B = letters[b];
        const ox = Math.min(A.x + A.w / 2, B.x + B.w / 2) - Math.max(A.x - A.w / 2, B.x - B.w / 2);
        const oy = Math.min(A.y, B.y) - Math.max(A.y - A.h, B.y - B.h);
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy) {
          const d = (A.x < B.x ? -1 : 1) * ox / 2;
          A.x += d; B.x -= d;
          const avg = (A.vx + B.vx) / 2;
          A.vx = avg + (avg - A.vx) * 0.3; B.vx = avg + (avg - B.vx) * 0.3;
        } else {
          const top = A.y < B.y ? A : B, bot = top === A ? B : A;
          top.y -= oy;
          if (top.vy > bot.vy) { const avg = (top.vy + bot.vy) / 2; top.vy = avg; bot.vy = avg; }
          top.onGround = true;
          top.vx *= Math.pow(0.1, dt);
        }
      }
    }
    for (const l of letters) l.x = Math.max(l.w / 2, Math.min(W - l.w / 2, l.x));
  }

  function pigVsLetters() {
    for (const l of letters) {
      const b = box(l);
      if (!overlaps(pig, b)) continue;
      const ox = Math.min(pig.x + pig.w / 2, b[0] + b[2]) - Math.max(pig.x - pig.w / 2, b[0]);
      if (pig.vy > 0 && pig.prevY <= b[1] + 18) {
        // bounce on top like a trampoline
        pig.y = b[1];
        pig.vy = input.jump ? -1050 : -700;
        pig.squash = 1.3;
        l.vy += 350; l.vr += (Math.random() - 0.5) * 4;
        sfx.boing();
      } else if (pig.vy < 0 && pig.prevY - pig.h >= b[1] + b[3] - 24) {
        // headbutt from underneath
        pig.y = b[1] + b[3] + pig.h;
        pig.vy = 120;
        l.vy = -900; l.vx += (l.x - pig.x) * 4; l.vr += (Math.random() - 0.5) * 10;
        sfx.bump(l.i);
      } else {
        // shove it sideways
        const dir = pig.x < l.x ? 1 : -1;
        l.x += dir * ox * 0.8;
        pig.x -= dir * ox * 0.2;
        l.vx = dir * Math.max(Math.abs(pig.vx) * 1.25, 200);
        if (l.onGround) l.vy = -180;
        l.vr += dir * 2;
        if (Math.abs(l.lastBump - t) > 0.25 || l.lastBump === undefined) { sfx.bump(l.i); l.lastBump = t; }
      }
    }
  }

  return {
    root,
    pig, letters,
    update(dt) {
      t += dt;
      const steps = 2;
      for (let n = 0; n < steps; n++) stepLetters(dt / steps);
      if (t > 0.8) {
        pig.sprite.alpha = Math.min(1, (t - 0.8) * 3);
        pig.control(dt, solids);
        pigVsLetters();
        pig.draw(dt);
      } else pig.draw(dt);
      if (!cheered && t > 1.6) { cheered = true; sfx.theEnd(); }
      for (const l of letters) {
        l.vr *= Math.pow(l.onGround ? 0.002 : 0.4, dt);
        l.rot += l.vr * dt;
        if (l.onGround) l.rot += (0 - l.rot) * Math.min(1, dt * 7);
        l.s.position.set(l.x, l.y - l.h / 2);
        l.s.rotation = l.rot;
      }
      if (t > 6) again.alpha = Math.min(0.7, (t - 6) * 0.5);
    },
  };
}

// ---------- main loop ----------
setScene(Title());
app.ticker.add((ticker) => {
  const dt = Math.min(ticker.deltaMS / 1000, 1 / 30);
  input.poll();
  if (input.fullscreenPressed) toggleFullscreen();
  if (input.backPressed) goto(Title);
  // small physics steps keep fast falls from tunnelling through floors
  const steps = dt > 1 / 90 ? 2 : 1;
  for (let i = 0; i < steps; i++) {
    scene.update(dt / steps);
    if (i === 0) { input.jumpPressed = false; input.confirmPressed = false; }
  }
  if (fading) {
    fading.t += dt;
    if (!fading.swapped) {
      fader.alpha = Math.min(1, fading.t / fading.dur);
      if (fading.t >= fading.dur) { setScene(fading.make()); fading.swapped = true; fading.t = 0; }
    } else {
      fader.alpha = Math.max(0, 1 - fading.t / fading.dur);
      if (fading.t >= fading.dur) fading = null;
    }
  }
});

// handy for poking at the game from the browser console
window.__game = { app, input, get scene() { return scene; }, setScene, goto, Level, Space, TheEnd, Ouch, Title };
