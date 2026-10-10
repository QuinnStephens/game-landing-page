// Everything except the pig and the enemy is drawn here at start-up in a
// crayon style, so the whole game looks like one kid's drawing.
import { rng, makeCanvas, toTexture, crayonFill, crayonLine, circlePts, drawGlyph, shade } from './crayon.js';

export const W = 1280, H = 800;

const INK = '#2b2622';

function sky({ top, bottom, seed, gap = 9 }) {
  const r = rng(seed);
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#fbf6ec';
  ctx.fillRect(0, 0, W, H);
  const bands = 8;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const col = mix(top, bottom, t);
    const y0 = (H / bands) * i - 10, y1 = (H / bands) * (i + 1) + 10;
    crayonFill(ctx, [[-20, y0], [W + 20, y0], [W + 20, y1], [-20, y1]], col, r, { angle: -0.08 + r() * 0.16, gap, width: 7, base: 0.6 });
  }
  return [c, ctx, r];
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
}

function star(ctx, x, y, s, color, r) {
  crayonLine(ctx, [[x - s, y], [x + s, y]], color, 3, r, { passes: 1, amt: 1 });
  crayonLine(ctx, [[x, y - s], [x, y + s]], color, 3, r, { passes: 1, amt: 1 });
}

// The crescent moon, like the one in the concept drawing.
function moon(ctx, x, y, rad, r) {
  const outer = circlePts(x, y, rad, rad, 30, 60 * Math.PI / 180, 300 * Math.PI / 180);
  const inner = circlePts(x + rad * 0.35, y, rad * 0.9, rad * 0.9, 24, 286 * Math.PI / 180, 74 * Math.PI / 180);
  const shape = [...outer, ...inner];
  crayonFill(ctx, shape, '#fff3a8', r, { gap: 6, width: 4 });
  crayonLine(ctx, [...shape, shape[0]], INK, 3, r, { passes: 1, amt: 1.5 });
}

function planet(ctx, x, y, rad, color, r, { spots = null, ring = false } = {}) {
  crayonFill(ctx, circlePts(x, y, rad, rad, 40), color, r, { gap: 6, width: 6, outline: shade(color, -0.3), outlineWidth: 4 });
  if (spots) {
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2, d = r() * rad * 0.6, s = rad * (0.1 + r() * 0.18);
      crayonFill(ctx, circlePts(x + Math.cos(a) * d, y + Math.sin(a) * d, s, s * 0.7, 14), spots, r, { gap: 5, width: 4 });
    }
  }
  if (ring) crayonLine(ctx, circlePts(x, y, rad * 1.6, rad * 0.35, 40, 0.15, Math.PI - 0.15), '#f7d35c', 6, r);
}

export function marsSky() {
  const [c, ctx, r] = sky({ top: '#e8836a', bottom: '#f7c08a', seed: 11 });
  // little tick-mark stars like in the drawing
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = r() * 360;
    crayonLine(ctx, [[x, y], [x + (r() - 0.5) * 4, y + 6 + r() * 8]], INK, 3, r, { passes: 1, amt: 1 });
  }
  moon(ctx, 1040, 150, 95, r);
  // the blue planet, far away, where the rocket is going
  planet(ctx, 190, 130, 46, '#4f8fe0', r, { spots: '#5fc56b' });
  // sun
  crayonFill(ctx, circlePts(640, 110, 40, 40, 24), '#fde27a', r, { gap: 5, width: 5, outline: '#f2a33a' });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    crayonLine(ctx, [[640 + Math.cos(a) * 52, 110 + Math.sin(a) * 52], [640 + Math.cos(a) * 72, 110 + Math.sin(a) * 72]], '#f2a33a', 4, r, { passes: 1 });
  }
  return toTexture(c);
}

// A strip of hills that tiles left-to-right.
function hills({ w = 2048, h, color, line, seed, base, amp, waves, craters = 0, rocks = 0 }) {
  const r = rng(seed);
  const [c, ctx] = makeCanvas(w, h);
  const top = (x) => base - waves.reduce((s, [k, a, ph]) => s + Math.sin((x / w) * Math.PI * 2 * k + ph) * a, 0) * amp;
  const pts = [];
  for (let x = 0; x <= w; x += 32) pts.push([x, top(x)]);
  const shape = [[0, h + 20], ...pts, [w, h + 20]];
  crayonFill(ctx, shape, color, r, { angle: -0.9, gap: 7, width: 7, base: 0.8 });
  crayonLine(ctx, pts, line, 5, r);
  for (let i = 0; i < craters; i++) {
    const x = 60 + r() * (w - 120), y = top(x) + 40 + r() * (h - top(x) - 60);
    const s = 18 + r() * 30;
    crayonFill(ctx, circlePts(x, y, s, s * 0.45, 16), shade(color, -0.12), r, { gap: 5, width: 4, outline: line, outlineWidth: 3 });
  }
  for (let i = 0; i < rocks; i++) {
    const x = r() * w, y = top(x) + 20 + r() * (h - top(x));
    ctx.fillStyle = shade(color, -0.2);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + r() * 6, 2 + r() * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  return toTexture(c);
}

export const farHills = () => hills({ h: 420, color: '#b84a3c', line: '#7c2a24', seed: 21, base: 220, amp: 1,
  waves: [[3, 70, 0.3], [7, 30, 1.1], [13, 12, 2]], craters: 6 });
export const nearHills = () => hills({ h: 330, color: '#d8693f', line: '#8e3622', seed: 31, base: 150, amp: 1,
  waves: [[4, 45, 1.3], [9, 25, 0.2], [17, 10, 0.7]], craters: 10, rocks: 60 });

// A solid chunk of red-planet ground: dirt with a darker crust on top.
const PAD = 12;
export function groundTexture(w, h, seed, { floating = false, color = '#c4512f', crust = '#8f2f22', dark = '#6e241a' } = {}) {
  const r = rng(seed);
  const [c, ctx] = makeCanvas(w + PAD * 2, h + PAD * 2);
  const x0 = PAD, y0 = PAD, x1 = PAD + w, y1 = PAD + h;
  const body = floating
    ? [[x0 + 6, y0], [x1 - 6, y0], [x1, y0 + 10], [x1 - 4, y1 - 8], [x1 - 14, y1], [x0 + 14, y1], [x0 + 4, y1 - 8], [x0, y0 + 10]]
    : [[x0, y0], [x1, y0], [x1, y1 + PAD], [x0, y1 + PAD]];
  crayonFill(ctx, body, color, r, { angle: -0.7 + r() * 0.3, gap: 7, width: 6, base: 0.85 });
  // pebbles and little craters
  const n = (w * h) / 2500;
  for (let i = 0; i < n; i++) {
    const px = x0 + 10 + r() * (w - 20), py = y0 + 26 + r() * Math.max(1, h - 36);
    const s = 3 + r() * 8;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = r() < 0.5 ? dark : shade(color, 0.15);
    ctx.beginPath();
    ctx.ellipse(px, py, s, s * (0.5 + r() * 0.4), r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // crust along the top
  const crustPts = [[x0, y0], [x1, y0], [x1, y0 + 16], [x0, y0 + 16]];
  crayonFill(ctx, crustPts, crust, r, { angle: 0.05, gap: 5, width: 5, base: 0.9 });
  const outline = floating ? [...body, body[0]] : [[x0, y1 + PAD], [x0, y0], [x1, y0], [x1, y1 + PAD]];
  crayonLine(ctx, outline, dark, 4, r, { passes: 2, amt: 1.6 });
  return { texture: toTexture(c), pad: PAD };
}

export function rockTexture(seed, s = 40, color = '#9b3b2a') {
  const r = rng(seed);
  const [c, ctx] = makeCanvas(s * 2 + 16, s + 16);
  const pts = [[8, s + 8], [8 + s * 0.2, 8 + s * 0.3], [8 + s * 0.7, 8], [8 + s * 1.4, 8 + s * 0.1], [8 + s * 2, s + 8]];
  crayonFill(ctx, pts, color, r, { gap: 5, width: 5, outline: '#5e1f16' });
  return toTexture(c);
}

// Kid-style alien plant: wiggly stem with a round top.
export function plantTexture(seed, color = '#e65ca0') {
  const r = rng(seed);
  const [c, ctx] = makeCanvas(80, 130);
  crayonLine(ctx, [[40, 128], [36, 90], [44, 60], [40, 40]], '#3f8a3c', 6, r);
  crayonLine(ctx, [[38, 95], [18, 80]], '#3f8a3c', 5, r);
  crayonLine(ctx, [[42, 75], [62, 62]], '#3f8a3c', 5, r);
  crayonFill(ctx, circlePts(40, 28, 22, 20, 18), color, r, { gap: 5, width: 5, outline: shade(color, -0.3) });
  ctx.fillStyle = INK;
  ctx.fillRect(33, 24, 3, 5); ctx.fillRect(45, 24, 3, 5);
  return toTexture(c);
}

export function flagPoleTexture() {
  const r = rng(41);
  const [c, ctx] = makeCanvas(40, 340);
  crayonFill(ctx, [[16, 20], [24, 20], [24, 330], [16, 330]], '#8d8d96', r, { gap: 3, width: 3, outline: INK, outlineWidth: 2 });
  crayonFill(ctx, circlePts(20, 16, 12, 12, 16), '#f7d35c', r, { gap: 4, width: 4, outline: INK, outlineWidth: 2 });
  return toTexture(c);
}

export function flagClothTexture() {
  const r = rng(43);
  const [c, ctx] = makeCanvas(150, 110);
  const pts = [[6, 8], [140, 30], [130, 55], [144, 80], [6, 100]];
  crayonFill(ctx, pts, '#31b39a', r, { gap: 6, width: 6, outline: '#17705f' });
  // a little star on it
  star(ctx, 55, 54, 14, '#f7d35c', r);
  return toTexture(c);
}

export function rocketTexture() {
  const r = rng(51);
  const [c, ctx] = makeCanvas(220, 340);
  const cx = 110;
  // fins
  crayonFill(ctx, [[cx - 45, 200], [cx - 95, 300], [cx - 40, 280]], '#e2403b', r, { outline: INK });
  crayonFill(ctx, [[cx + 45, 200], [cx + 95, 300], [cx + 40, 280]], '#e2403b', r, { outline: INK });
  // body
  const body = [[cx, 12], [cx + 30, 50], [cx + 50, 120], [cx + 52, 230], [cx + 40, 290], [cx - 40, 290], [cx - 52, 230], [cx - 50, 120], [cx - 30, 50]];
  crayonFill(ctx, body, '#e8e8f2', r, { gap: 6, width: 6, outline: INK, outlineWidth: 4 });
  // nose cone
  crayonFill(ctx, [[cx, 14], [cx + 30, 52], [cx + 38, 76], [cx - 38, 76], [cx - 30, 52]], '#e2403b', r, { gap: 5, width: 5 });
  crayonLine(ctx, [[cx - 38, 78], [cx + 38, 78]], INK, 3, r, { passes: 1 });
  // window
  crayonFill(ctx, circlePts(cx, 145, 28, 28, 22), '#7ec8f2', r, { gap: 5, width: 5, outline: INK, outlineWidth: 5 });
  // stripe and middle fin
  crayonFill(ctx, [[cx - 52, 220], [cx + 52, 220], [cx + 52, 236], [cx - 52, 236]], '#31b39a', r, { gap: 4, width: 4 });
  crayonFill(ctx, [[cx - 8, 240], [cx + 8, 240], [cx + 6, 310], [cx - 6, 310]], '#c22e2a', r, { outline: INK, outlineWidth: 2 });
  return toTexture(c);
}

export function flameTexture() {
  const r = rng(61);
  const [c, ctx] = makeCanvas(120, 170);
  crayonFill(ctx, [[15, 6], [105, 6], [90, 70], [60, 165], [30, 70]], '#f28a2e', r, { gap: 5, width: 5, outline: '#d0471f' });
  crayonFill(ctx, [[35, 6], [85, 6], [76, 50], [60, 110], [44, 50]], '#fde27a', r, { gap: 4, width: 4 });
  return toTexture(c);
}

export function spaceSky() {
  const r = rng(71);
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#fbf6ec';
  ctx.fillRect(0, 0, W, H);
  crayonFill(ctx, [[-20, -20], [W + 20, -20], [W + 20, H + 20], [-20, H + 20]], '#1d2556', r, { gap: 6, width: 8, base: 0.85 });
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H;
    if (r() < 0.3) star(ctx, x, y, 6 + r() * 6, r() < 0.5 ? '#fff3a8' : '#ffffff', r);
    else { ctx.fillStyle = '#fffbe0'; ctx.globalAlpha = 0.8; ctx.fillRect(x, y, 3, 3); ctx.globalAlpha = 1; }
  }
  moon(ctx, 640, 120, 50, r);
  planet(ctx, 120, 690, 240, '#d0553a', r, { spots: '#9b3b2a' });
  planet(ctx, 1130, 300, 190, '#4f8fe0', r, { spots: '#5fc56b' });
  return toTexture(c);
}

export function blueSky() {
  const [c, ctx, r] = sky({ top: '#7fb2ee', bottom: '#cfe6fb', seed: 81 });
  // fluffy clouds
  for (let i = 0; i < 4; i++) {
    const x = 150 + i * 320 + r() * 60, y = 110 + r() * 120;
    for (let k = 0; k < 4; k++) {
      const s = 32 + r() * 24;
      crayonFill(ctx, circlePts(x + k * 38, y + (k % 2) * -14, s, s * 0.8, 18), '#ffffff', r, { gap: 5, width: 5, base: 0.95 });
    }
  }
  // the red planet, now far away
  planet(ctx, 1110, 110, 40, '#d0553a', r, { spots: '#9b3b2a' });
  crayonFill(ctx, circlePts(180, 120, 46, 46, 24), '#fde27a', r, { gap: 5, width: 5, outline: '#f2a33a' });
  return toTexture(c);
}

export function blueGround() {
  const r = rng(91);
  const [c, ctx] = makeCanvas(W, 200);
  const pts = [];
  for (let x = -20; x <= W + 20; x += 40) pts.push([x, 14 + Math.sin(x / 90) * 4]);
  crayonFill(ctx, [...pts, [W + 20, 220], [-20, 220]], '#3a7bd5', r, { gap: 6, width: 7, base: 0.85 });
  crayonFill(ctx, [[-20, 10], [W + 20, 10], [W + 20, 34], [-20, 34]], '#4cb45a', r, { gap: 5, width: 5, angle: 0.05 });
  crayonLine(ctx, pts, '#1f5a2a', 5, r);
  // flowers
  for (let i = 0; i < 16; i++) {
    const x = 40 + r() * (W - 80), y = 60 + r() * 120;
    const col = ['#f7d35c', '#e65ca0', '#ffffff', '#f28a2e'][i % 4];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      crayonFill(ctx, circlePts(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 6, 6, 10), col, r, { gap: 3, width: 3 });
    }
    crayonFill(ctx, circlePts(x, y, 5, 5, 10), '#f2a33a', r, { gap: 3, width: 3 });
  }
  return toTexture(c);
}

// One big chunky letter for the end screen.
export function letterTexture(ch, color, seed) {
  const r = rng(seed);
  const size = 140, pad = 22;
  const [c, ctx] = makeCanvas(size * 4 / 6 + pad * 2, size + pad * 2);
  drawGlyph(ctx, ch, pad, pad, size, shade(color, -0.35), 30, r, { tilt: 0, passes: 1, amt: 1.5 });
  drawGlyph(ctx, ch, pad, pad, size, color, 22, rng(seed), { tilt: 0, passes: 2, amt: 1.5 });
  return { texture: toTexture(c), w: size * 4 / 6 + 26, h: size + 26 };
}

// Big scribble splat behind the OUCH word.
export function ouchBurst() {
  const r = rng(101);
  const [c, ctx] = makeCanvas(760, 520);
  const pts = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, d = i % 2 ? 250 : 170 + r() * 30;
    pts.push([380 + Math.cos(a) * d * 1.35, 260 + Math.sin(a) * d * 0.95]);
  }
  crayonFill(ctx, pts, '#fde27a', r, { gap: 6, width: 7, outline: '#e2403b', outlineWidth: 6 });
  return toTexture(c);
}
