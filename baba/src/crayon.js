// Kid-drawing helpers: wobbly lines, scribbly crayon fills and a hand-written
// letter set, all drawn with canvas 2D and turned into PIXI textures.

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return [c, c.getContext('2d')];
}

export function toTexture(canvas) {
  return PIXI.Texture.from(canvas);
}

// Shift a #rrggbb colour lighter (+) or darker (-).
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

// Break a polyline into short steps and push each point around with a slow
// random walk, so straight lines come out hand-drawn.
export function wobble(pts, r, amt = 3, step = 10, closed = false) {
  const src = closed ? [...pts, pts[0]] : pts;
  const out = [];
  let ox = 0, oy = 0;
  for (let i = 0; i < src.length - 1; i++) {
    const [x0, y0] = src[i], [x1, y1] = src[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      ox = ox * 0.7 + (r() - 0.5) * amt;
      oy = oy * 0.7 + (r() - 0.5) * amt;
      out.push([x0 + (x1 - x0) * t + ox, y0 + (y1 - y0) * t + oy]);
    }
  }
  const last = src[src.length - 1];
  out.push([last[0] + ox * 0.5, last[1] + oy * 0.5]);
  return out;
}

export function trace(ctx, pts, closed = false) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
}

// A crayon line: a few slightly different passes over the same path.
export function crayonLine(ctx, pts, color, width, r, { passes = 2, amt = 2.5, alpha = 0.85 } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  for (let p = 0; p < passes; p++) {
    ctx.globalAlpha = alpha * (p === 0 ? 1 : 0.6);
    ctx.lineWidth = width * (p === 0 ? 1 : 0.7);
    trace(ctx, wobble(pts, r, amt, 8));
    ctx.stroke();
  }
  ctx.restore();
}

// Fill a shape the way a kid colours it in: a patchy base, then lots of
// back-and-forth scribble strokes, with little gaps of paper showing.
export function crayonFill(ctx, pts, color, r, { angle = -0.5, gap = 7, width = 6, base = 0.75, outline = null, outlineWidth = 3 } = {}) {
  const shape = wobble(pts, r, 3, 14, true);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of shape) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  ctx.save();
  trace(ctx, shape, true);
  ctx.clip();
  ctx.globalAlpha = base;
  ctx.fillStyle = color;
  ctx.fillRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
  ctx.lineCap = 'round';
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const span = Math.hypot(maxX - minX, maxY - minY) / 2 + 10;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (let d = -span; d < span; d += gap * (0.6 + r() * 0.8)) {
    ctx.globalAlpha = 0.35 + r() * 0.4;
    ctx.strokeStyle = shade(color, (r() - 0.5) * 0.18);
    ctx.lineWidth = width * (0.6 + r() * 0.8);
    const px = cx - sa * d, py = cy + ca * d;
    const line = [[px - ca * span, py - sa * span], [px + ca * span, py + sa * span]];
    trace(ctx, wobble(line, r, 4, 20));
    ctx.stroke();
  }
  // paper flecks
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#fffaf0';
  const flecks = ((maxX - minX) * (maxY - minY)) / 900;
  for (let i = 0; i < flecks; i++) {
    const x = minX + r() * (maxX - minX), y = minY + r() * (maxY - minY);
    ctx.fillRect(x, y, 1 + r() * 4, 1 + r() * 1.5);
  }
  ctx.restore();
  if (outline) crayonLine(ctx, [...shape, shape[0]], outline, outlineWidth, r, { passes: 1, amt: 1 });
}

export function circlePts(cx, cy, rx, ry = rx, n = 28, a0 = 0, a1 = Math.PI * 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

// ---- hand-written capitals on a 4 x 6 grid ----
const D = Math.PI / 180;
const arc = (cx, cy, rx, ry, a0, a1, n = 14) => circlePts(cx, cy, rx, ry, n, a0 * D, a1 * D);
const P_BOWL = [[0, 6], [0, 0], [2.4, 0], ...arc(2.4, 1.6, 1.5, 1.6, -90, 90, 10), [0, 3.2]];
const GLYPHS = {
  A: [[[0, 6], [2, 0], [4, 6]], [[0.8, 3.8], [3.2, 3.8]]],
  B: [[[0, 0], [0, 6]], [[0, 0], [2.4, 0], ...arc(2.4, 1.5, 1.3, 1.5, -90, 90, 8), [0, 3]], [[2.4, 3], ...arc(2.4, 4.5, 1.6, 1.5, -90, 90, 8), [0, 6]]],
  C: [arc(2, 3, 2, 3, -40, -320)],
  D: [[[0, 0], [0, 6]], [[0, 0], [1.2, 0], ...arc(1.2, 3, 2.8, 3, -90, 90), [0, 6]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [[...arc(2, 3, 2, 3, -40, -360), [2.2, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[2, 0], [2, 6]], [[0.8, 0], [3.2, 0]], [[0.8, 6], [3.2, 6]]],
  J: [[[4, 0], [4, 4.4], ...arc(2, 4.4, 2, 1.6, 0, 180)]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.6]], [[1.3, 2.5], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 3.6], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [arc(2, 3, 2, 3, 0, 360, 24)],
  P: [P_BOWL],
  Q: [arc(2, 3, 2, 3, 0, 360, 24), [[2.5, 4.3], [4.3, 6.3]]],
  R: [P_BOWL, [[1.8, 3.2], [4, 6]]],
  S: [[...arc(2, 1.5, 1.9, 1.5, -20, -270, 12), ...arc(2, 4.5, 2, 1.5, -90, 160, 12)]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 4], ...arc(2, 4, 2, 2, 180, 0, 12), [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [1, 6], [2, 2.5], [3, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 3]], [[4, 0], [2, 3], [2, 6]]],
  Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  '!': [[[2, 0], [2, 4.2]], [[2, 5.7], [2, 6]]],
  '?': [[...arc(2, 1.6, 1.8, 1.6, -170, 60, 10), [2, 4.4]], [[2, 5.7], [2, 6]]],
  '/': [[[3.5, 0], [0.5, 6]]],
  '-': [[[0.5, 3], [3.5, 3]]],
  '.': [[[2, 5.7], [2, 6]]],
  '=': [[[0.5, 2.2], [3.5, 2.2]], [[0.5, 3.8], [3.5, 3.8]]],
};

// Draw one hand-written capital with its top-left at (x, y), `size` tall.
export function drawGlyph(ctx, ch, x, y, size, color, width, r, opts = {}) {
  const g = GLYPHS[ch];
  if (!g) return;
  const u = size / 6;
  const rot = (r() - 0.5) * (opts.tilt ?? 0.12);
  const cx = x + 2 * u, cy = y + 3 * u;
  for (const line of g) {
    const pts = line.map(([gx, gy]) => {
      const dx = (gx - 2) * u, dy = (gy - 3) * u;
      return [cx + dx * Math.cos(rot) - dy * Math.sin(rot), cy + dx * Math.sin(rot) + dy * Math.cos(rot)];
    });
    crayonLine(ctx, pts, color, width, r, { passes: opts.passes ?? 2, amt: opts.amt ?? size / 60 });
  }
}

export function textWidth(str, size) {
  return str.length * size * 0.85 - size * 0.18;
}

// Render a line of hand-written text into its own texture.
export function textTexture(str, size, color, { width = size / 9, seed = 1, colors = null, pad = 12, bounce = 0.08 } = {}) {
  const r = rng(seed);
  const w = textWidth(str, size) + pad * 2, h = size * (1 + bounce * 2) + pad * 2;
  const [c, ctx] = makeCanvas(w, h);
  [...str].forEach((ch, i) => {
    const col = colors ? colors[i % colors.length] : color;
    const dy = (r() - 0.5) * size * bounce * 2;
    drawGlyph(ctx, ch, pad + i * size * 0.85, pad + size * bounce + dy, size, col, width, r);
  });
  return toTexture(c);
}

export function textSprite(str, size, color, opts) {
  const s = new PIXI.Sprite(textTexture(str, size, color, opts));
  s.anchor.set(0.5);
  return s;
}
