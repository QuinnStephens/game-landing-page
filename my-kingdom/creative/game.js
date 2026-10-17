// My Kingdom: Creative mode. A town of six places from Violeta's drawings. Pick one to go inside,
// pan around, and move the people, furniture and toys wherever you like. Everything is remembered.
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // The screen is at least 720 tall and 720 wide in game units; bigger screens just see more
  let W = 1280, VH = 720, scale = 1;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    scale = Math.min(canvas.height / 720, canvas.width / 720);
    W = canvas.width / scale;
    VH = canvas.height / scale;
  }
  addEventListener('resize', resize);
  resize();

  const FONT = '"Comic Sans MS", "Chalkboard SE", "Comic Neue", "Marker Felt", cursive, sans-serif';
  const font = (px, weight = 'bold') => `${weight} ${px}px ${FONT}`;
  const INK = '#151515';
  const PENCIL = '#5a49b5'; // her purple pencil, for outlines and words

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // ---------------------------------------------------------------------------
  // Her drawings, cut out by tools/cut_creative_art.py

  // h is how tall each thing stands in a room. tray says which drawer it's in (people and the
  // things drawn for one place aren't in a drawer; they always live in their place).
  const THINGS = {
    teacher: { h: 270, person: true, name: 'Teacher' },
    zookeeper: { h: 230, person: true, name: 'Zookeeper' },
    waiter: { h: 280, person: true, name: 'Waiter' },
    phone: { h: 60, tray: 'items', name: 'Phone' },
    book: { h: 64, tray: 'items', name: 'Book' },
    'teddy-bear': { h: 120, tray: 'items', name: 'Teddy Bear' },
    doll: { h: 130, tray: 'items', name: 'Doll' },
    block: { h: 70, tray: 'items', name: 'Block' },
    dollhouse: { h: 220, tray: 'items', name: 'Dollhouse' },
    'baby-bed': { h: 190, tray: 'furniture', name: 'Baby Bed' },
    'big-kid-bed': { h: 170, tray: 'furniture', name: 'Big Kid Bed' },
    chair: { h: 160, tray: 'furniture', name: 'Chair' },
    fridge: { h: 270, tray: 'furniture', name: 'Fridge' },
    'table-and-chairs': { h: 200, tray: 'furniture', name: 'Table and Chairs' },
    'baby-swing': { h: 230, tray: 'furniture', name: 'Baby Swing', swing: { pivot: [0.55, 0.1], seats: [[0.6, 0.7]] } },
    toilet: { h: 140, tray: 'furniture', name: 'Toilet' },
    'restaurant-table': { h: 260, name: 'Table' },
    'zoo-bunny': { h: 130, name: 'Bunny' },
    'zoo-koala': { h: 180, name: 'Koala' },
    'zoo-lion': { h: 200, name: 'Lion' },
    // Swings: where they hang from and where each seat is, as fractions across and down the drawing.
    // The slide: where a baby gets on at the top and comes off at the bottom
    'park-swings': { h: 440, name: 'Swings', swing: { pivot: [0.55, 0.12], seats: [[0.36, 0.74], [0.74, 0.74]] } },
    'park-slide': { h: 260, name: 'Slide', slide: { top: [0.38, 0.1], bottom: [1.02, 0.95] } },
    'ball-pit': { h: 170, name: 'Ball Pit', pit: true },
    'school-desk': { h: 210, name: 'Table' },
  };
  const TRAYS = [
    { id: 'items', name: 'Toys' },
    { id: 'furniture', name: 'Furniture' },
    { id: 'people', name: 'People' },
  ];

  // Each place: its outside drawing in the town, how wide its inside is, and what's there to start with
  // (thing, x, y of its bottom middle). FLOOR is where the wall meets the floor.
  const FLOOR = 450;
  const PLACES = [
    { id: 'home', name: 'Home', width: 2200, start: [['big-kid-bed', 420, 640], ['teddy-bear', 470, 548], ['baby-swing', 780, 600], ['table-and-chairs', 1100, 650], ['fridge', 1420, 560], ['toilet', 1900, 560], ['dollhouse', 1680, 650]] },
    { id: 'park', name: 'Park', width: 2400, outside: true, start: [['park-slide', 620, 600], ['ball-pit', 900, 660], ['park-swings', 1450, 600], ['block', 1900, 660]] },
    { id: 'restaurant', name: 'Restaurant', width: 2200, start: [['waiter', 700, 620], ['school-desk', 1100, 660], ['table-and-chairs', 1650, 660], ['phone', 1960, 420]] },
    { id: 'library', name: 'Library', width: 2200, start: [['chair', 820, 660], ['book', 900, 690], ['book', 1500, 680]] },
    { id: 'school', name: 'School', width: 2200, start: [['teacher', 1100, 600], ['restaurant-table', 680, 680], ['restaurant-table', 1520, 680], ['block', 1850, 640]] },
    { id: 'zoo', name: 'Zoo', width: 2600, outside: true, start: [['zookeeper', 520, 640], ['zoo-lion', 1000, 600], ['zoo-koala', 1560, 600], ['zoo-bunny', 2100, 640]] },
  ];

  const IMG = {};
  function loadImage(name) {
    return new Promise((res) => {
      const i = new Image();
      i.onload = () => { IMG[name] = i; res(); };
      i.onerror = () => res();
      i.src = `../public/img/creative/${name}.png`;
    });
  }
  const loadingThings = Promise.all([...Object.keys(THINGS), ...PLACES.map((p) => p.id)].map(loadImage));

  // ---------------------------------------------------------------------------
  // Characters you make, with the same hand-drawn character creator as Explore (public/img/creator).
  // They can be grown-ups or babies, bears or humans, and go in the People drawer to put in any place.

  const CREATOR_ART = { w: 2224, h: 1668 };
  const CREATOR_PAD = 40; // empty room around each cut-out piece, for its glow
  const CREATOR_NECK = { x: 1010, y: 1165 }; // where the character stands in the drawing
  const EXPLORE_CHARACTER_KEY = 'bear-kingdom-character-v1';
  // The groups, in the order the explore creator has them, plus big or baby. Only humans change how they look
  const CREATOR_GROUPS = [
    { id: 'species', options: ['bear', 'human'] },
    { id: 'age', options: ['big', 'baby'] },
    { id: 'skin', options: ['skin-0', 'skin-1', 'skin-2'], humanOnly: true },
    { id: 'hair', options: ['hair-black', 'hair-yellow', 'hair-purple', 'hair-blue'], optional: true, humanOnly: true },
    { id: 'shirt', options: ['shirt-dress', 'shirt-blue', 'shirt-purple', 'shirt-pink', 'shirt-green', 'shirt-yellow'], optional: true, humanOnly: true },
    { id: 'pants', options: ['pants-skirt-pink', 'pants-blue', 'pants-skirt-blue', 'pants-purple', 'pants-skirt-purple', 'pants-pink'], optional: true, humanOnly: true },
    { id: 'go', options: ['go'] },
  ];
  const DEFAULT_LOOK = { species: 'human', age: 'big', skin: 'skin-0', hair: 'hair-purple', shirt: 'shirt-blue', pants: 'pants-blue' };
  // Big or baby: placeholders in the empty top-left corner of her drawing, until she draws them
  const AGE_BUTTONS = { big: { x: 25, y: 8, w: 165, h: 270 }, baby: { x: 200, y: 62, w: 165, h: 216 } };
  // The character, in drawing units with the neck at 0,0, matching Explore (index.html)
  const BODY_LINES = [
    [0, 0, 0, 200], [-38, 200, 38, 200],
    [0, 45, -135, 150], [0, 45, 135, 150],
    [-35, 200, -42, 400], [35, 200, 42, 400],
    [-42, 400, -105, 412], [42, 400, 105, 412],
  ];
  const CLOTHES_BOXES = {
    pants: { x: -82, y: 178, w: 164, h: 225 },
    skirt: { x: -125, y: 170, w: 250, h: 165 },
    shirt: { x: -120, y: -8, w: 240, h: 225 },
    dress: { x: -135, y: -8, w: 270, h: 345 },
  };
  const HUMAN_HEAD = { x: 76, y: -235, rx: 265, ry: 215, rotation: -0.38 };
  const HAIR_BOXES = {
    'hair-black': [{ cx: 0, cy: -0.78, w: 1.7, h: 0.8 }],
    'hair-yellow': [{ cx: 0, cy: -1.18, w: 0.6, h: 0.5 }],
    'hair-purple': [{ cx: -0.98, cy: 0.1, w: 0.42, h: 1.6 }, { cx: 0.98, cy: 0.1, w: 0.42, h: 1.6, flip: true }],
    'hair-blue': [{ cx: -0.98, cy: 0.1, w: 0.48, h: 1.6 }, { cx: 0.98, cy: 0.1, w: 0.48, h: 1.6, flip: true }],
  };
  // Babies have a shorter, smaller body under the same big head
  const BABY_BODY = { sx: 0.8, sy: 0.5 };
  // How tall each kind of character stands in a room
  const CHARACTER_HEIGHT = { human: { big: 290, baby: 165 }, bear: { big: 270, baby: 145 } };

  const CIMG = {};
  let CLAYOUT = {};
  function loadInto(store, key, src) {
    return new Promise((res) => {
      const i = new Image();
      i.onload = () => { store[key] = i; res(); };
      i.onerror = () => res();
      i.src = src;
    });
  }
  async function loadCreatorArt() {
    try { CLAYOUT = await (await fetch('../public/img/creator/layout.json')).json(); } catch { CLAYOUT = {}; }
    const names = ['species-bear', 'species-human', ...CREATOR_GROUPS.slice(2, -1).flatMap((g) => g.options)].filter((n) => CLAYOUT[n]);
    await Promise.all([
      ...names.flatMap((n) => [loadInto(CIMG, n, `../public/img/creator/${n}.png`), loadInto(CIMG, n + '-glow', `../public/img/creator/${n}-glow.png`)]),
      loadInto(CIMG, 'human-skin', '../public/img/creator/human-skin.png'),
      loadInto(CIMG, 'human-face', '../public/img/creator/human-face.png'),
      loadInto(CIMG, 'background', '../public/img/creator/background.jpg'),
      loadInto(CIMG, 'bear', '../public/img/bear-char.png'),
      loadInto(CIMG, 'go', '../public/img/menu/creative.png'),
      loadInto(CIMG, 'go-glow', '../public/img/menu/creative-glow.png'),
    ]);
    CIMG['age-big'] = drawAgeButton(false);
    CIMG['age-baby'] = drawAgeButton(true);
  }
  const loading = Promise.all([loadingThings, loadCreatorArt()]);

  // A grown-up or a baby in black marker, like the little figures in her creator drawing
  function drawAgeButton(baby) {
    const b = AGE_BUTTONS[baby ? 'baby' : 'big'];
    const cv = document.createElement('canvas'); cv.width = b.w; cv.height = b.h;
    const c = cv.getContext('2d');
    c.strokeStyle = '#151515'; c.lineCap = c.lineJoin = 'round';
    const cx = b.w / 2, label = 54;
    // Drawn in a 100-wide box, scaled to fit above the word
    const k = Math.min(b.w / 100, (b.h - label) / (baby ? 120 : 190));
    c.save();
    c.translate(cx, 4); c.scale(k, k);
    c.lineWidth = 9;
    if (baby) {
      c.beginPath(); c.arc(0, 42, 30, 0, 7); c.stroke();
      c.beginPath(); c.arc(4, 8, 8, Math.PI * 0.9, Math.PI * 2.2); c.stroke(); // a curl
      c.lineWidth = 6; c.beginPath(); c.arc(0, 48, 11, 0.2, Math.PI - 0.2); c.stroke();
      c.lineWidth = 9;
      c.beginPath(); c.moveTo(0, 72); c.lineTo(0, 100); c.moveTo(0, 80); c.lineTo(-26, 94); c.moveTo(0, 80); c.lineTo(26, 94);
      c.moveTo(0, 100); c.lineTo(-17, 117); c.moveTo(0, 100); c.lineTo(17, 117); c.stroke();
    } else {
      c.beginPath(); c.arc(0, 32, 28, 0, 7); c.stroke();
      c.lineWidth = 6; c.beginPath(); c.arc(0, 36, 12, 0.2, Math.PI - 0.2); c.stroke();
      c.lineWidth = 9;
      c.beginPath(); c.moveTo(0, 60); c.lineTo(0, 130); c.moveTo(0, 76); c.lineTo(-42, 112); c.moveTo(0, 76); c.lineTo(42, 112);
      c.moveTo(0, 130); c.lineTo(-28, 185); c.moveTo(0, 130); c.lineTo(28, 185); c.stroke();
    }
    c.restore();
    c.font = font(46); c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillStyle = '#151515';
    c.fillText(baby ? 'Baby' : 'Big', cx, b.h - 2);
    return cv;
  }

  function loadExploreLook() {
    const look = { ...DEFAULT_LOOK };
    try {
      const saved = JSON.parse(localStorage.getItem(EXPLORE_CHARACTER_KEY));
      CREATOR_GROUPS.forEach((g) => {
        if (saved && (g.options.includes(saved[g.id]) || (g.optional && saved[g.id] === null))) look[g.id] = saved[g.id];
      });
    } catch { /* none */ }
    return look;
  }
  function cleanLook(saved) {
    const look = { ...DEFAULT_LOOK };
    CREATOR_GROUPS.forEach((g) => {
      if (saved && (g.options.includes(saved[g.id]) || (g.optional && saved[g.id] === null))) look[g.id] = saved[g.id];
    });
    return look;
  }

  // A cut-out piece stretched so its drawing (not its glow room) fills the box
  function drawPiece(c, name, box, flip = false) {
    const img = CIMG[name], info = CLAYOUT[name];
    if (!img || !info) return;
    c.save();
    c.translate(box.x + box.w / 2, box.y + box.h / 2);
    c.scale(box.w / (info.w - 2 * CREATOR_PAD) * (flip ? -1 : 1), box.h / (info.h - 2 * CREATOR_PAD));
    c.drawImage(img, -img.width / 2, -img.height / 2);
    c.restore();
  }
  const TINTED = {};
  function tinted(name, color) {
    const key = name + color;
    if (TINTED[key]) return TINTED[key];
    const img = CIMG[name];
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = 'multiply'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(img, 0, 0);
    return (TINTED[key] = cv);
  }

  // Draws a human in drawing units with the neck at 0,0 (bears are just her bear drawing)
  function drawHuman(c, look) {
    const baby = look.age === 'baby';
    c.save();
    if (baby) c.scale(BABY_BODY.sx, BABY_BODY.sy);
    c.strokeStyle = '#151515'; c.lineWidth = 28; c.lineCap = c.lineJoin = 'round';
    c.beginPath();
    BODY_LINES.forEach(([x1, y1, x2, y2]) => { c.moveTo(x1, y1); c.lineTo(x2, y2); });
    c.stroke();
    if (look.pants) drawPiece(c, look.pants, CLOTHES_BOXES[look.pants.startsWith('pants-skirt') ? 'skirt' : 'pants']);
    if (look.shirt) drawPiece(c, look.shirt, CLOTHES_BOXES[look.shirt === 'shirt-dress' ? 'dress' : 'shirt']);
    c.restore();
    for (const name of ['human-skin', 'human-face']) {
      const info = CLAYOUT[name], img = name === 'human-skin' ? tinted(name, CLAYOUT.skinColors[look.skin]) : CIMG[name];
      if (info && img) c.drawImage(img, info.x - CREATOR_NECK.x, info.y - CREATOR_NECK.y);
    }
    if (look.hair) {
      const head = HUMAN_HEAD;
      c.save();
      c.translate(head.x, head.y);
      c.rotate(head.rotation);
      HAIR_BOXES[look.hair].forEach((b) => {
        const w = b.w * head.rx, h = b.h * head.ry;
        drawPiece(c, look.hair, { x: b.cx * head.rx - w / 2, y: b.cy * head.ry - h / 2, w, h }, b.flip);
      });
      c.restore();
    }
  }
  // Where a human reaches, in drawing units around the neck
  function humanBounds(look) {
    return { x0: -290, x1: 430, y0: -530, y1: look.age === 'baby' ? 425 * BABY_BODY.sy : 430 };
  }
  // A picture of the character, cut close, for putting in rooms
  function renderCharacter(look) {
    if (look.species === 'bear') return CIMG.bear;
    const k = 0.45, b = humanBounds(look);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((b.x1 - b.x0) * k); cv.height = Math.ceil((b.y1 - b.y0) * k);
    const c = cv.getContext('2d');
    c.scale(k, k); c.translate(-b.x0, -b.y0);
    drawHuman(c, look);
    return cv;
  }

  // Your characters: { id, look } each
  let characters = [];
  let nextCharId = 1;
  const CHAR_ART = {};
  const charById = (id) => characters.find((ch) => ch.id === id);
  function charArt(id) {
    if (CHAR_ART[id]) return CHAR_ART[id];
    const ch = charById(id);
    return ch ? (CHAR_ART[id] = renderCharacter(ch.look)) : null;
  }
  function charName(look) {
    const baby = look.age === 'baby';
    if (look.species === 'bear') return baby ? 'Baby Bear' : 'Bear';
    return baby ? 'Baby' : 'Person';
  }

  // Every thing in a room is either one of her drawings (THINGS) or a character you made
  function defOf(t) {
    if (t.kind === 'char') {
      const ch = charById(t.char);
      const look = ch ? ch.look : DEFAULT_LOOK;
      return { h: CHARACTER_HEIGHT[look.species][look.age], tray: 'people', name: charName(look), made: true };
    }
    return THINGS[t.kind];
  }
  const artOf = (t) => (t.kind === 'char' ? charArt(t.char) : IMG[t.kind]);
  const maskKey = (t) => (t.kind === 'char' ? 'char-' + t.char : t.kind);

  // A small copy of each drawing's see-through mask, so you grab the drawing and not the paper around it
  const MASKS = {};
  function maskFor(name, img) {
    if (MASKS[name] !== undefined) return MASKS[name];
    if (!img) return (MASKS[name] = null);
    const w = 48, h = Math.max(8, Math.round(48 * img.height / img.width));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0, w, h);
    let data;
    try { data = c.getImageData(0, 0, w, h).data; } catch { return (MASKS[name] = null); }
    // Fill in the gaps between her scribbles so a thing is easy to grab anywhere inside it
    const solid = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      let first = -1, last = -1;
      for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 40) { if (first < 0) first = x; last = x; }
      for (let x = first; x >= 0 && x <= last; x++) solid[y * w + x] = 1;
    }
    return (MASKS[name] = { w, h, solid });
  }

  // ---------------------------------------------------------------------------
  // Saving: what's in every place

  const SAVE_KEY = 'my-kingdom-creative-v1';
  let nextId = 1;
  function startingThings(place) {
    return place.start.map(([kind, x, y]) => ({ id: nextId++, kind, x, y }));
  }
  const SAVE_VERSION = 2;
  let world = {};
  let savedVersion = SAVE_VERSION;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved && saved.places) { world = saved.places; savedVersion = saved.v || 1; }
    if (saved && Array.isArray(saved.characters)) {
      characters = saved.characters.filter((ch) => ch && Number.isInteger(ch.id)).map((ch) => ({ id: ch.id, look: cleanLook(ch.look) }));
      nextCharId = Math.max(0, ...characters.map((ch) => ch.id)) + 1;
    }
  } catch { /* nothing saved */ }
  for (const p of PLACES) {
    if (!Array.isArray(world[p.id])) world[p.id] = startingThings(p);
    const list = world[p.id];
    // Who's on a swing or in the ball pit is saved as the place in this list of what they're on
    for (const t of list) t.id = nextId++;
    for (const t of list) {
      const host = t.on && list[t.on.i];
      t.on = host ? { id: host.id, seat: t.on.seat || 0, pit: !!t.on.pit } : null;
    }
    world[p.id] = list.filter((t) => (t.kind === 'char' ? charById(t.char) : THINGS[t.kind]));
    if (savedVersion < 2) upgradeFromV1(p, world[p.id]);
    // The teacher, zookeeper and waiter are always there
    for (const [kind, x, y] of p.start) {
      if (THINGS[kind].person && !world[p.id].some((t) => t.kind === kind)) world[p.id].push({ id: nextId++, kind, x, y });
    }
  }
  // Violeta's first changes: the school and restaurant swap tables, the baby swing moves home,
  // and the park gets its slide, ball pit and swings
  function upgradeFromV1(place, list) {
    const swap = { school: ['school-desk', 'restaurant-table'], restaurant: ['restaurant-table', 'school-desk'] }[place.id];
    if (swap) for (const t of list) if (t.kind === swap[0]) t.kind = swap[1];
    if (place.id === 'park') {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].kind === 'baby-swing') list.splice(i, 1);
    }
    for (const [kind, x, y] of place.start) {
      if (['park-slide', 'ball-pit', 'park-swings', 'baby-swing'].includes(kind) && !list.some((t) => t.kind === kind)) list.push({ id: nextId++, kind, x, y });
    }
  }
  function writeSave() {
    try {
      const places = {};
      for (const id in world) {
        const list = world[id];
        places[id] = list.map(({ kind, char, x, y, flip, on }) => {
          const i = on ? list.findIndex((h) => h.id === on.id) : -1;
          return { kind, char, x: Math.round(x), y: Math.round(y), flip: !!flip, on: i >= 0 ? { i, seat: on.seat, pit: on.pit } : undefined };
        });
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, places, characters }));
    } catch { /* storage full or blocked */ }
  }

  // ---------------------------------------------------------------------------
  // Placeholder painting in her style: purple pencil outlines that wobble, and crayon scribbles to colour in

  function wobblyPath(c, pts, r, amount = 4, closed = false) {
    c.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (r() - 0.5) * amount, jy = y + (r() - 0.5) * amount;
      if (i) c.lineTo(jx, jy); else c.moveTo(jx, jy);
    });
    if (closed) c.closePath();
  }
  function along(points, step = 50) {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i], [x1, y1] = points[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let k = 0; k < n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
    }
    out.push(points[points.length - 1]);
    return out;
  }
  function rectPts(x, y, w, h) { return along([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]); }
  function ellipsePts(x, y, rx, ry, n = 28) {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; out.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]); }
    return out;
  }
  function pencil(c, pts, r, color = PENCIL, width = 5, closed = false) {
    c.save();
    c.lineCap = c.lineJoin = 'round';
    c.strokeStyle = color;
    c.globalAlpha = 0.85; c.lineWidth = width; wobblyPath(c, pts, r, 5, closed); c.stroke();
    c.globalAlpha = 0.45; c.lineWidth = width * 0.6; wobblyPath(c, pts, r, 7, closed); c.stroke();
    c.restore();
  }
  // Colour in a shape the way she does: a light wash, then a zigzag scribble back and forth
  function scribble(c, pts, r, color, { wash = 0.35, step = 16, width = 9, alpha = 0.8 } = {}) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    c.save();
    wobblyPath(c, pts, () => 0.5, 0, true);
    c.clip();
    c.fillStyle = color; c.globalAlpha = wash; c.fillRect(x0 - 5, y0 - 5, x1 - x0 + 10, y1 - y0 + 10);
    c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width; c.lineCap = c.lineJoin = 'round';
    const tilt = (y1 - y0) * 0.25;
    c.beginPath();
    let x = x0 - tilt - 10, top = true;
    c.moveTo(x, y1 + 8);
    while (x < x1 + tilt + 10) {
      x += step * (0.6 + r() * 0.8);
      c.lineTo(x + (top ? tilt : 0), top ? y0 - 8 + r() * 10 : y1 + 8 - r() * 10);
      top = !top;
    }
    c.stroke();
    c.restore();
  }
  function words(c, text, x, y, size, color = PENCIL, align = 'center') {
    c.save();
    c.font = font(size); c.textAlign = align; c.textBaseline = 'middle';
    c.fillStyle = color; c.globalAlpha = 0.9;
    c.fillText(text, x, y);
    c.restore();
  }
  function tree(c, r, x, ground, size = 1) {
    const trunk = rectPts(x - 18 * size, ground - 150 * size, 36 * size, 150 * size);
    scribble(c, trunk, r, '#9a6234', { step: 10, width: 7 });
    pencil(c, trunk, r);
    const top = ellipsePts(x, ground - 210 * size, 105 * size, 90 * size);
    scribble(c, top, r, '#25b84a', { step: 18, width: 12 });
    pencil(c, top, r, PENCIL, 5, true);
  }
  function cloud(c, r, x, y, s = 1) {
    const pts = ellipsePts(x, y, 90 * s, 34 * s);
    scribble(c, pts, r, '#ffffff', { wash: 0.9, step: 20, width: 10, alpha: 0.6 });
    pencil(c, pts, r, '#8fb6e8', 4, true);
  }
  function sun(c, r, x, y) {
    const pts = ellipsePts(x, y, 55, 55);
    scribble(c, pts, r, '#ffd21f', { step: 12, width: 9 });
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      pencil(c, [[x + Math.cos(a) * 72, y + Math.sin(a) * 72], [x + Math.cos(a) * 100, y + Math.sin(a) * 100]], r, '#f4a300', 6);
    }
  }
  function windowPane(c, r, x, y, w, h, curtains = '#ff7aa8') {
    const frame = rectPts(x, y, w, h);
    scribble(c, frame, r, '#8fd0ff', { step: 22, width: 10, wash: 0.6 });
    pencil(c, frame, r);
    pencil(c, [[x + w / 2, y], [x + w / 2, y + h]], r);
    pencil(c, [[x, y + h / 2], [x + w, y + h / 2]], r);
    if (curtains) {
      for (const cx of [x - 14, x + w - 26]) {
        const cur = rectPts(cx, y - 14, 40, h + 30);
        scribble(c, cur, r, curtains, { step: 10, width: 7 });
      }
    }
  }
  function door(c, r, x, ground, color = '#b9773d') {
    const pts = rectPts(x, ground - 260, 140, 260);
    scribble(c, pts, r, color, { step: 14, width: 9 });
    pencil(c, pts, r);
    const knob = ellipsePts(x + 115, ground - 130, 9, 9, 10);
    scribble(c, knob, r, '#ffd21f', { wash: 1 });
  }

  // The insides she hasn't drawn yet. Each one is painted once into its own canvas, 720 tall.
  const PAINTERS = {
    home(c, w, r) {
      wall(c, w, r, '#ffd7ea');
      for (let i = 0; i < w / 60; i++) for (let j = 0; j < 7; j++) {
        c.fillStyle = 'rgba(240, 110, 170, 0.35)';
        c.beginPath(); c.arc(30 + i * 60 + (j % 2) * 30 + (r() - 0.5) * 8, 40 + j * 60 + (r() - 0.5) * 8, 7, 0, 7); c.fill();
      }
      floor(c, w, r, '#e3ac6c', true);
      windowPane(c, r, 240, 110, 230, 190);
      door(c, r, 760, FLOOR);
      const pic = rectPts(1240, 120, 170, 130);
      scribble(c, pic, r, '#fff6b0', { wash: 0.9, step: 30 });
      pencil(c, pic, r, '#c07a2a', 9);
      sun(c, r, 1325, 185);
      windowPane(c, r, 1700, 110, 230, 190);
      const rug = ellipsePts(1050, 640, 330, 55);
      scribble(c, rug, r, '#a874e6', { step: 14 });
      pencil(c, rug, r, PENCIL, 5, true);
    },
    school(c, w, r) {
      wall(c, w, r, '#fff1a6');
      floor(c, w, r, '#a9dcae', false, '#86c48c');
      const board = rectPts(560, 90, 760, 260);
      scribble(c, board, r, '#2f6b3e', { wash: 1, step: 26, width: 12, alpha: 0.5 });
      pencil(c, board, r, '#9a6234', 12);
      words(c, 'A B C   1 2 3', 940, 175, 64, '#ffffff');
      words(c, 'Hi class!', 940, 275, 46, '#ffe9f4');
      const clock = ellipsePts(1560, 150, 60, 60);
      scribble(c, clock, r, '#ffffff', { wash: 1, step: 30, alpha: 0.3 });
      pencil(c, clock, r, PENCIL, 6, true);
      pencil(c, [[1560, 150], [1560, 108]], r, INK, 5);
      pencil(c, [[1560, 150], [1592, 160]], r, INK, 5);
      windowPane(c, r, 160, 120, 220, 180, null);
      windowPane(c, r, 1800, 120, 220, 180, null);
      const colors = ['#ff6b6b', '#ffb03a', '#ffe14d', '#5bd16b', '#4aa8ff', '#a874e6'];
      colors.forEach((col, i) => { const p = rectPts(470 + i * 160, 380, 120, 50); scribble(c, p, r, col, { step: 12 }); pencil(c, p, r); });
    },
    restaurant(c, w, r) {
      wall(c, w, r, '#ffdcb8');
      for (let x = 0; x < w; x += 90) { c.fillStyle = 'rgba(255, 140, 90, 0.18)'; c.fillRect(x, 0, 45, FLOOR); }
      // Red and white checks
      c.fillStyle = '#fff8f0'; c.fillRect(0, FLOOR, w, 720 - FLOOR);
      for (let y = FLOOR, row = 0; y < 720; y += 54, row++) for (let x = (row % 2) * 54; x < w; x += 108) {
        scribble(c, rectPts(x, y, 54, 54), r, '#ff5a5a', { step: 12, width: 7, wash: 0.5 });
      }
      pencil(c, along([[0, FLOOR], [w, FLOOR]]), r, PENCIL, 6);
      const counter = rectPts(1500, 300, 600, FLOOR - 300);
      scribble(c, counter, r, '#b9773d', { step: 16 });
      pencil(c, counter, r);
      const menu = rectPts(1560, 60, 480, 200);
      scribble(c, menu, r, '#2f2f3a', { wash: 1, step: 30, alpha: 0.4 });
      pencil(c, menu, r, '#9a6234', 10);
      words(c, 'MENU', 1800, 100, 46, '#ffe14d');
      words(c, 'pizza  soup  cake', 1800, 165, 34, '#ffffff');
      words(c, 'ice cream  pasta', 1800, 215, 34, '#ffffff');
      for (const lx of [300, 700, 1100]) {
        pencil(c, [[lx, 0], [lx, 120]], r, INK, 4);
        const shade = along([[lx - 60, 180], [lx - 30, 120], [lx + 30, 120], [lx + 60, 180], [lx - 60, 180]], 20);
        scribble(c, shade, r, '#ffd21f', { step: 10 });
        pencil(c, shade, r);
      }
      windowPane(c, r, 160, 200, 200, 160, '#ff5a5a');
    },
    library(c, w, r) {
      wall(c, w, r, '#d2e2ff');
      floor(c, w, r, '#c6a2ea', false, '#b088de');
      const spines = ['#ff6b6b', '#ffb03a', '#ffe14d', '#5bd16b', '#4aa8ff', '#a874e6', '#ff7aa8', '#2fc2b0'];
      for (const sx of [120, 1560]) {
        const shelf = rectPts(sx, 60, 520, FLOOR - 50);
        scribble(c, shelf, r, '#b9773d', { step: 20, alpha: 0.5 });
        for (let row = 0; row < 4; row++) {
          const y = 80 + row * 95;
          let x = sx + 18;
          while (x < sx + 490) {
            const bw = 22 + r() * 22, bh = 60 + r() * 20;
            const book = rectPts(x, y + 80 - bh, bw, bh);
            scribble(c, book, r, spines[Math.floor(r() * spines.length)], { step: 8, width: 6, wash: 0.7 });
            pencil(c, book, r, PENCIL, 3);
            x += bw + 4;
          }
          pencil(c, along([[sx, y + 82], [sx + 520, y + 82]]), r, '#7a4a20', 7);
        }
        pencil(c, shelf, r, '#7a4a20', 8);
      }
      const sign = rectPts(880, 110, 300, 130);
      scribble(c, sign, r, '#ffffff', { wash: 1, alpha: 0.2 });
      pencil(c, sign, r);
      words(c, 'Shh!', 1030, 175, 72);
      windowPane(c, r, 1260, 120, 200, 170, '#4aa8ff');
    },
    zoo(c, w, r) {
      outdoors(c, w, r);
      sun(c, r, 200, 110);
      cloud(c, r, 700, 120); cloud(c, r, 1500, 90, 1.2); cloud(c, r, 2250, 140);
      tree(c, r, 140, FLOOR + 20); tree(c, r, 1280, FLOOR + 10, 0.9); tree(c, r, 2480, FLOOR + 20, 1.1);
      // Pens with fences
      for (const [x0, x1] of [[760, 1220], [1340, 1800], [1880, 2340]]) {
        for (let x = x0; x <= x1; x += 46) {
          const post = rectPts(x, FLOOR - 70, 16, 120);
          scribble(c, post, r, '#c58a4a', { step: 8, width: 6, wash: 0.7 });
        }
        pencil(c, along([[x0, FLOOR - 40], [x1 + 16, FLOOR - 40]]), r, '#8a5a2a', 7);
        pencil(c, along([[x0, FLOOR + 10], [x1 + 16, FLOOR + 10]]), r, '#8a5a2a', 7);
      }
      const pond = ellipsePts(1600, 650, 220, 50);
      scribble(c, pond, r, '#3a9cff', { step: 14 });
      pencil(c, pond, r, PENCIL, 5, true);
      const sign = rectPts(330, 220, 220, 110);
      scribble(c, sign, r, '#fff6b0', { wash: 1, alpha: 0.4 });
      pencil(c, sign, r, '#8a5a2a', 8);
      pencil(c, [[440, 330], [440, FLOOR + 30]], r, '#8a5a2a', 10);
      words(c, 'ZOO', 440, 277, 64, '#e0408a');
    },
    park(c, w, r) {
      outdoors(c, w, r);
      sun(c, r, w - 260, 110);
      cloud(c, r, 400, 100); cloud(c, r, 1100, 150, 0.9); cloud(c, r, 1800, 90, 1.1);
      tree(c, r, 160, FLOOR + 20, 1.1); tree(c, r, 520, FLOOR + 30, 0.8); tree(c, r, 2000, FLOOR + 20); tree(c, r, 2300, FLOOR + 40, 0.9);
      const path = along([[0, 690], [700, 600], [1300, 640], [1900, 590], [w, 660]], 60);
      c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(215, 185, 140, 0.8)'; c.lineWidth = 70;
      wobblyPath(c, path, r, 4); c.stroke(); c.restore();
      const pond = ellipsePts(1850, 690, 200, 40);
      scribble(c, pond, r, '#3a9cff', { step: 14 });
      pencil(c, pond, r, PENCIL, 5, true);
      const flowers = ['#ff6b6b', '#ffe14d', '#ff7aa8', '#a874e6'];
      for (let i = 0; i < 40; i++) {
        const fx = r() * w, fy = FLOOR + 30 + r() * 240;
        c.fillStyle = flowers[i % 4]; c.globalAlpha = 0.85;
        for (let k = 0; k < 5; k++) { const a = k / 5 * 7; c.beginPath(); c.arc(fx + Math.cos(a) * 8, fy + Math.sin(a) * 8, 6, 0, 7); c.fill(); }
        c.fillStyle = '#ffd21f'; c.beginPath(); c.arc(fx, fy, 5, 0, 7); c.fill(); c.globalAlpha = 1;
      }
    },
  };
  function wall(c, w, r, color) {
    c.fillStyle = color; c.fillRect(0, 0, w, FLOOR);
    for (let x = 0; x < w; x += 400) scribble(c, rectPts(x, -10, 400, FLOOR + 10), r, color, { wash: 0, step: 40, width: 14, alpha: 0.5 });
  }
  function floor(c, w, r, color, planks = false, lines = null) {
    c.fillStyle = color; c.fillRect(0, FLOOR, w, 720 - FLOOR);
    for (let x = 0; x < w; x += 400) scribble(c, rectPts(x, FLOOR, 400, 720 - FLOOR), r, color, { wash: 0, step: 30, width: 12, alpha: 0.6 });
    if (planks) for (let y = FLOOR + 60; y < 720; y += 60) pencil(c, along([[0, y], [w, y]], 80), r, '#b9773d', 3);
    if (lines) for (let x = 0; x < w; x += 110) pencil(c, along([[x, FLOOR], [x - 80, 720]]), r, lines, 3);
    pencil(c, along([[0, FLOOR], [w, FLOOR]]), r, PENCIL, 6);
  }
  function outdoors(c, w, r) {
    c.fillStyle = '#bfe6ff'; c.fillRect(0, 0, w, FLOOR);
    c.fillStyle = '#9be38a'; c.fillRect(0, FLOOR, w, 720 - FLOOR);
    for (let x = 0; x < w; x += 400) scribble(c, rectPts(x, FLOOR, 400, 720 - FLOOR), r, '#5bc95b', { wash: 0, step: 22, width: 8, alpha: 0.5 });
    pencil(c, along([[0, FLOOR], [w, FLOOR]], 60), r, '#3f9f3f', 6);
  }

  const BACKDROPS = {};
  function backdrop(place) {
    if (BACKDROPS[place.id]) return BACKDROPS[place.id];
    const cv = document.createElement('canvas');
    cv.width = place.width; cv.height = 720;
    PAINTERS[place.id](cv.getContext('2d'), place.width, rng(place.id.length * 977 + 13));
    return (BACKDROPS[place.id] = cv);
  }

  // The town: sky, grass and a road, painted once for each screen size
  let townArt = null;
  function townBackdrop() {
    const key = `${Math.round(W)}x${Math.round(VH)}`;
    if (townArt && townArt.key === key) return townArt.cv;
    const cv = document.createElement('canvas');
    cv.width = Math.round(W); cv.height = Math.round(VH);
    const c = cv.getContext('2d'), r = rng(7);
    const horizon = 150;
    c.fillStyle = '#bfe6ff'; c.fillRect(0, 0, cv.width, horizon);
    c.fillStyle = '#9be38a'; c.fillRect(0, horizon, cv.width, cv.height);
    for (let x = 0; x < cv.width; x += 300) scribble(c, rectPts(x, horizon, 300, cv.height), r, '#5bc95b', { wash: 0, step: 24, width: 8, alpha: 0.35 });
    pencil(c, along([[0, horizon], [cv.width, horizon]], 60), r, '#3f9f3f', 6);
    sun(c, r, cv.width - 110, 70);
    cloud(c, r, cv.width * 0.25, 60, 0.8); cloud(c, r, cv.width * 0.55, 80, 0.7);
    // A street along the front of each row of places, with their names on it
    const slots = townSlots();
    for (let i = 0; i < slots.length; i += townCols()) {
      const roadY = slots[i].labelY + 22;
      c.save(); c.strokeStyle = '#b4b4c0'; c.lineWidth = 58; c.lineCap = 'round';
      wobblyPath(c, along([[-40, roadY], [cv.width + 40, roadY]], 80), r, 6); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 5; c.setLineDash([26, 30]);
      wobblyPath(c, along([[-40, roadY + 24], [cv.width + 40, roadY + 24]], 80), r, 2); c.stroke();
      c.restore();
    }
    townArt = { key, cv };
    return cv;
  }

  // ---------------------------------------------------------------------------
  // Input: keyboard, controllers (with the right button pictures), mouse and touch

  const KEYS = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    confirm: ['Space', 'Enter', 'KeyE'], back: ['Backspace', 'KeyB'], add: ['KeyT'], remove: ['KeyX', 'Delete'],
    flip: ['KeyR'], prevTab: ['KeyQ'], nextTab: ['Tab'], pause: ['Escape'], fullscreen: ['KeyF'],
  };
  const KEY_LABEL = { confirm: 'Space', back: 'Bksp', add: 'T', remove: 'X', flip: 'R', pause: 'Esc', fullscreen: 'F', prevTab: 'Q', nextTab: 'Tab' };
  // Standard gamepad layout: 0 bottom, 1 right, 2 left, 3 top face button
  const PAD = { left: [14], right: [15], up: [12], down: [13], confirm: [0], back: [1], remove: [2], add: [3], prevTab: [4], nextTab: [5], flip: [7], pause: [9] };
  const PAD_FACE = { confirm: 'south', back: 'east', remove: 'west', add: 'north' };

  const keysDown = new Set(), keysHit = new Set();
  let device = 'keyboard'; // 'keyboard' | 'mouse' | 'touch' | 'xbox' | 'ps' | 'nintendo' | 'deck'
  const held = {}, prevHeld = {};
  let moveX = 0, moveY = 0, stickActive = false;

  function padFamily(id) {
    if (/054c|playstation|dualshock|dualsense|wireless controller/i.test(id)) return 'ps';
    if (/057e|nintendo|switch|pro controller|joy-con|joycon/i.test(id)) return 'nintendo';
    if (/28de|valve|steam/i.test(id)) return 'deck';
    return 'xbox';
  }
  // Steam Input and some adapters hide which controller it really is, so the pause menu can set it
  const PAD_STYLES = [['auto', 'Automatic'], ['xbox', 'Xbox'], ['ps', 'PlayStation'], ['nintendo', 'Switch'], ['deck', 'Steam Deck']];
  const PAD_STYLE_KEY = 'my-kingdom-pad-style';
  let padStyle = 'auto';
  try { const v = localStorage.getItem(PAD_STYLE_KEY); if (PAD_STYLES.some(([id]) => id === v)) padStyle = v; } catch { /* none */ }
  let lastPadId = '';
  function cyclePadStyle() {
    const i = PAD_STYLES.findIndex(([id]) => id === padStyle);
    padStyle = PAD_STYLES[(i + 1) % PAD_STYLES.length][0];
    try { localStorage.setItem(PAD_STYLE_KEY, padStyle); } catch { /* fine */ }
    if (usingPad() || padStyle !== 'auto') device = padStyle !== 'auto' ? padStyle : padFamily(lastPadId);
  }
  const usingPad = () => !['keyboard', 'mouse', 'touch'].includes(device);
  const usingHand = () => device === 'keyboard' || usingPad();

  addEventListener('keydown', (e) => {
    if (!keysDown.has(e.code)) keysHit.add(e.code);
    keysDown.add(e.code);
    if (device !== 'keyboard') { device = 'keyboard'; handFromPointer(); }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace'].includes(e.code)) e.preventDefault();
    unlockAudio();
  });
  addEventListener('keyup', (e) => keysDown.delete(e.code));
  addEventListener('blur', () => keysDown.clear());

  function pollInput() {
    const padHeld = {};
    let ax = 0, ay = 0;
    stickActive = false;
    for (const gp of navigator.getGamepads ? navigator.getGamepads() : []) {
      if (!gp || !gp.connected) continue;
      const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
      let used = false;
      for (const a in PAD) for (const i of PAD[a]) if (b(i)) { padHeld[a] = true; used = true; }
      const sx = gp.axes[0] || 0, sy = gp.axes[1] || 0;
      if (Math.abs(sx) > 0.2) { ax += sx; used = true; stickActive = true; }
      if (Math.abs(sy) > 0.2) { ay += sy; used = true; stickActive = true; }
      if (sx < -0.5) padHeld.left = true;
      if (sx > 0.5) padHeld.right = true;
      if (sy < -0.5) padHeld.up = true;
      if (sy > 0.5) padHeld.down = true;
      if (used) {
        lastPadId = gp.id;
        const was = device;
        device = padStyle !== 'auto' ? padStyle : padFamily(gp.id);
        if (was === 'mouse' || was === 'touch') handFromPointer();
        unlockAudio();
      }
    }
    for (const a in KEYS) {
      prevHeld[a] = held[a];
      held[a] = !!padHeld[a] || KEYS[a].some((k) => keysDown.has(k));
    }
    for (const a in KEYS) if (KEYS[a].some((k) => keysHit.has(k))) { prevHeld[a] = false; held[a] = true; }
    moveX = clamp(ax + (held.right ? 1 : 0) - (held.left ? 1 : 0), -1, 1);
    moveY = clamp(ay + (held.down ? 1 : 0) - (held.up ? 1 : 0), -1, 1);
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
  // Sound: tiny synth noises, no files

  let ac = null;
  function unlockAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; }
  }
  function tone(freq, dur, type = 'square', vol = 0.08, slideTo = 0, delay = 0) {
    if (!ac) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
  }
  const sfx = {
    move() { tone(660, 0.05, 'triangle', 0.06); },
    pick() { tone(440, 0.08, 'triangle', 0.09, 700); },
    drop() { tone(520, 0.1, 'triangle', 0.09, 300); },
    add() { tone(660, 0.08, 'triangle', 0.1); tone(990, 0.12, 'triangle', 0.1, 0, 0.07); },
    away() { tone(700, 0.15, 'sine', 0.09, 200); },
    door() { tone(300, 0.15, 'triangle', 0.08, 500); tone(500, 0.15, 'triangle', 0.08, 700, 0.12); },
    nope() { tone(220, 0.08, 'square', 0.06); tone(200, 0.1, 'square', 0.06, 0, 0.1); },
    swing() { tone(392, 0.12, 'triangle', 0.08, 587); tone(587, 0.15, 'triangle', 0.07, 784, 0.1); },
    climb() { [0, 0.15, 0.3, 0.45].forEach((d, i) => tone(500 + i * 90, 0.06, 'triangle', 0.06, 0, d)); },
    slide() { tone(1100, 0.8, 'sine', 0.08, 260); },
    plop() { [0, 0.07, 0.14, 0.2].forEach((d) => tone(300 + Math.random() * 500, 0.08, 'sine', 0.07, 0, d)); },
  };

  // ---------------------------------------------------------------------------
  // Game state

  const game = {
    screen: 'town',      // 'town' | 'inside'
    townIndex: 0,         // which place is picked in the town
    place: null,          // the place you're inside
    camX: 0,
    tray: null,           // { tab, index } while the drawer is open
    paused: null,         // { index, confirmReset } while the pause menu is open
    creator: null,        // { look, cursor } while making a character
    lastTab: 0,           // the drawer opens on the tab you used last
    toast: null,          // { text, until }
    fade: 0,
  };
  // The hand you move with the keys or a controller, in screen units
  const hand = { x: 640, y: 360, holding: null, offX: 0, offY: 0 };
  // A drag with the mouse or a finger
  let drag = null; // { kind: 'thing' | 'pan' | 'new', thing, offX, offY, startX, camX, moved, pointerId }
  let pointer = { x: -999, y: -999, over: false };
  let lastPointer = { x: 640, y: 360 };
  // Things that just got put back in place (they bounce)
  const bounces = new Map();

  function handFromPointer() { hand.x = clamp(lastPointer.x, 30, W - 30); hand.y = clamp(lastPointer.y, 30, VH - 30); }
  const groundY = () => (VH - 720) / 2; // the room is 720 tall, centred on taller screens
  const toWorld = (sx, sy) => ({ x: sx + game.camX, y: sy - groundY() });
  const things = () => world[game.place.id];

  function showToast(text) { game.toast = { text, until: performance.now() + 1800 }; }

  function enterPlace(index) {
    const place = PLACES[index];
    game.townIndex = index;
    game.place = place;
    game.screen = 'inside';
    game.tray = null;
    game.camX = clamp(place.width / 2 - W / 2, 0, Math.max(0, place.width - W));
    hand.x = W / 2; hand.y = VH / 2; hand.holding = null;
    drag = null;
    game.fade = 1;
    sfx.door();
  }
  function backToTown() {
    if (hand.holding) dropHeld();
    game.screen = 'town';
    game.place = null;
    game.tray = null;
    drag = null;
    game.fade = 1;
    sfx.door();
  }
  function goToMainMenu() {
    writeSave();
    location.href = '../#creative';
  }

  function sizeOf(t) {
    const img = artOf(t), h = defOf(t).h;
    const w = img ? h * img.width / img.height : h * 0.7;
    return { w, h };
  }
  // The thing drawn on top at a spot in the room (people and things in front are checked first)
  function thingAt(wx, wy) {
    // Riders come first, so a baby in the ball pit can be lifted out instead of the pit
    const sorted = drawOrder().slice().reverse();
    const list = [...sorted.filter((t) => t.on), ...sorted.filter((t) => !t.on)];
    for (const t of list) {
      if (t === hand.holding || (drag && drag.thing === t) || t.sliding) continue;
      const { w, h } = sizeOf(t);
      const lx = t.flip ? (t.x + w / 2 - wx) / w : (wx - (t.x - w / 2)) / w;
      const ly = (wy - (t.y - h)) / h;
      if (lx < 0 || lx > 1 || ly < 0 || ly > 1) continue;
      const m = maskFor(maskKey(t), artOf(t));
      if (!m) return t;
      // Forgiving: check a little patch around the spot
      const mx = Math.floor(lx * m.w), my = Math.floor(ly * m.h);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = mx + dx, y = my + dy;
        if (x >= 0 && y >= 0 && x < m.w && y < m.h && m.solid[y * m.w + x]) return t;
      }
    }
    return null;
  }
  // Further back things are drawn first, so lower on the screen means in front
  function drawOrder() {
    return things().slice().sort((a, b) => a.y - b.y);
  }
  function keepInRoom(t) {
    const { h } = sizeOf(t);
    t.x = clamp(t.x, 20, game.place.width - 20);
    t.y = clamp(t.y, Math.min(h * 0.6, 300), 715);
  }

  // Hold it from wherever the hand grabbed it
  function pickUp(t, w) {
    getOff(t);
    hand.holding = t;
    hand.offX = t.x - w.x;
    hand.offY = t.y - w.y;
    sfx.pick();
  }
  function dropHeld() {
    const t = hand.holding;
    if (!t) return;
    hand.holding = null;
    keepInRoom(t);
    bounces.set(t, performance.now());
    sfx.drop();
    settle(t);
    writeSave();
  }
  function putAway(t) {
    if (!t) return false;
    const def = defOf(t);
    if (!def.tray) {
      showToast(def.person ? `The ${def.name.toLowerCase()} lives here!` : `The ${def.name.toLowerCase()} stays here`);
      sfx.nope();
      bounces.set(t, performance.now());
      return false;
    }
    const list = things();
    // Anyone on it gets off where they are
    for (const r of ridersOf(t)) { getOff(r); r.y = Math.max(r.y, t.y); }
    list.splice(list.indexOf(t), 1);
    if (hand.holding === t) hand.holding = null;
    sfx.away();
    writeSave();
    return true;
  }
  function addThing(entry, wx, wy) {
    const t = { id: nextId++, kind: entry.kind, x: wx, y: wy };
    if (entry.kind === 'char') t.char = entry.char;
    things().push(t);
    sfx.add();
    return t;
  }
  // ---------------------------------------------------------------------------
  // Swings, the slide and the ball pit. Characters and people ride the swings; only babies
  // go down the slide, and land in the ball pit if there's one nearby.

  const canRide = (t) => t.kind === 'char' || !!defOf(t).person;
  const isBaby = (t) => t.kind === 'char' && charById(t.char)?.look.age === 'baby';
  const hostOf = (t) => (t.on ? things().find((h) => h.id === t.on.id) : null);
  const ridersOf = (host) => things().filter((t) => t.on && t.on.id === host.id);
  // A point on a thing's drawing, given as fractions across and down it
  function pointOn(host, [fx, fy]) {
    const { w, h } = sizeOf(host);
    return { x: host.x + (host.flip ? 0.5 - fx : fx - 0.5) * w, y: host.y - h + fy * h };
  }
  // Dropped with its feet somewhere on the drawing (forgiving)
  function droppedOn(t, host) {
    const { w, h } = sizeOf(host);
    return host !== t && Math.abs(t.x - host.x) < w * 0.6 && t.y > host.y - h - 30 && t.y < host.y + 80;
  }
  const pitDepth = (pit) => sizeOf(pit).h * 0.55; // how far into the balls a baby sits
  function getOff(t) {
    t.on = null;
    t.sliding = null;
  }
  function settle(t) {
    getOff(t);
    if (!canRide(t)) return;
    const list = things();
    for (const host of list) {
      const sw = defOf(host).swing;
      if (!sw || !droppedOn(t, host)) continue;
      const taken = ridersOf(host).map((o) => o.on.seat);
      const free = sw.seats.map((_, i) => i).filter((i) => !taken.includes(i));
      if (!free.length) continue;
      free.sort((a, b) => Math.abs(pointOn(host, sw.seats[a]).x - t.x) - Math.abs(pointOn(host, sw.seats[b]).x - t.x));
      t.on = { id: host.id, seat: free[0], pit: false };
      t.swingFrom = performance.now();
      positionRider(t, host);
      sfx.swing();
      return;
    }
    for (const host of list) {
      if (!defOf(host).slide || !droppedOn(t, host)) continue;
      if (isBaby(t)) startSlide(t, host);
      else { showToast('The slide is just for babies!'); sfx.nope(); }
      return;
    }
    if (isBaby(t)) {
      const pit = list.find((host) => defOf(host).pit && droppedOn(t, host));
      if (pit) intoPit(t, pit, t.x - pit.x);
    }
  }
  function intoPit(t, pit, offset) {
    const w = sizeOf(pit).w;
    t.on = { id: pit.id, seat: Math.round(clamp(offset, -w * 0.28, w * 0.28)), pit: true };
    positionRider(t, pit);
    bounces.set(t, performance.now());
    sfx.plop();
  }
  // Riders keep their x, y where they're drawn (before swinging), so they can be grabbed there
  function positionRider(t, host) {
    if (t.on.pit) {
      t.x = host.x + t.on.seat;
      t.y = host.y - pitDepth(host);
    } else {
      const seat = pointOn(host, defOf(host).swing.seats[t.on.seat]);
      t.x = seat.x;
      t.y = seat.y + sizeOf(t).h * 0.22;
    }
  }
  function startSlide(t, slide) {
    const def = defOf(slide).slide;
    const top = pointOn(slide, def.top), bottom = pointOn(slide, def.bottom);
    // The nearest ball pit to the bottom of the slide catches the baby
    let pit = null, best = 900;
    for (const host of things()) {
      if (!defOf(host).pit) continue;
      const d = Math.hypot(host.x - bottom.x, host.y - bottom.y);
      if (d < best) { best = d; pit = host; }
    }
    t.sliding = { t0: performance.now(), from: { x: t.x, y: t.y }, top, bottom, pit: pit ? pit.id : null };
    sfx.climb();
  }
  const CLIMB_MS = 700, SLIDE_MS = 900, HOP_MS = 600;
  function updateRides(now) {
    for (const t of things()) {
      if (t.sliding) {
        const s = t.sliding, k = now - s.t0, h = sizeOf(t).h;
        if (k < CLIMB_MS) {
          // Up the ladder
          const f = k / CLIMB_MS;
          t.x = s.from.x + (s.top.x - s.from.x) * f;
          t.y = s.from.y + (s.top.y + h * 0.3 - s.from.y) * f - Math.abs(Math.sin(f * Math.PI * 4)) * 14;
          s.angle = 0;
        } else if (k < CLIMB_MS + SLIDE_MS) {
          // Wheee, faster and faster
          if (!s.whee) { s.whee = true; sfx.slide(); }
          const f = (k - CLIMB_MS) / SLIDE_MS, e = f * f;
          t.x = s.top.x + (s.bottom.x - s.top.x) * e;
          t.y = s.top.y + h * 0.3 + (s.bottom.y - s.top.y - h * 0.3) * e;
          s.angle = 0.35;
        } else {
          const pit = s.pit && things().find((p) => p.id === s.pit);
          const land = pit ? { x: pit.x, y: pit.y - pitDepth(pit) } : { x: s.bottom.x + 60, y: s.bottom.y };
          const f = Math.min(1, (k - CLIMB_MS - SLIDE_MS) / HOP_MS);
          t.x = s.bottom.x + (land.x - s.bottom.x) * f;
          t.y = s.bottom.y + (land.y - s.bottom.y) * f - Math.sin(f * Math.PI) * 110;
          s.angle = 0.35 * (1 - f) + f * 0.6 * Math.sin(f * Math.PI);
          if (f >= 1) {
            t.sliding = null;
            if (pit) intoPit(t, pit, 0);
            else { keepInRoom(t); bounces.set(t, now); sfx.drop(); }
            writeSave();
          }
        }
      } else if (t.on) {
        const host = hostOf(t);
        if (host) positionRider(t, host);
        else t.on = null;
      }
    }
  }
  // A rider swings back and forth under where the swing hangs from
  function swingAngle(t, now) {
    return Math.sin((now - (t.swingFrom || 0)) / 520 + t.id) * 0.42;
  }

  function resetPlace() {
    world[game.place.id] = startingThings(game.place);
    hand.holding = null;
    writeSave();
    sfx.door();
  }

  // ---------------------------------------------------------------------------
  // Layout of the screens (in screen units)

  // Three across on wide screens, two across on narrow ones
  const townCols = () => (W >= 960 ? 3 : 2);
  function townSlots() {
    const cols = townCols(), rows = Math.ceil(PLACES.length / cols);
    const top = 170, bottom = VH - 70;
    const rowH = (bottom - top) / rows;
    const colW = W / cols;
    const artH = Math.min(rowH - 70, 230);
    return PLACES.map((p, i) => {
      const cx = colW * (i % cols + 0.5), cy = top + rowH * (Math.floor(i / cols) + 0.5);
      const img = IMG[p.id];
      const h = artH, w = img ? Math.min(colW - 30, h * img.width / img.height) : h;
      return { x: cx - w / 2, y: cy - h / 2 - 20, w, h, cx, labelY: cy + h / 2 + 4 };
    });
  }
  const UI = {
    back: () => ({ x: 18, y: 16, w: 150, h: 64 }),
    full: () => ({ x: W - 82, y: 16, w: 64, h: 64 }),
    addButton: () => ({ x: 18, y: VH - 100, w: 150, h: 82 }),
    trash: () => ({ x: W - 150, y: VH - 160, w: 130, h: 140 }),
    trayBox: () => ({ x: 10, y: VH - 210, w: W - 20, h: 200 }),
  };
  // What's in a drawer: her toys or furniture, or "New" and the characters you've made
  function trayList(tab) {
    if (TRAYS[tab].id === 'people') {
      return [{ kind: 'new', name: 'New', h: 0 }, ...characters.slice().reverse().map((ch) => ({ kind: 'char', char: ch.id, name: charName(ch.look), h: CHARACTER_HEIGHT[ch.look.species][ch.look.age] }))];
    }
    return Object.keys(THINGS).filter((k) => THINGS[k].tray === TRAYS[tab].id).map((k) => ({ kind: k, name: THINGS[k].name, h: THINGS[k].h }));
  }
  const entryArt = (e) => (e.kind === 'char' ? charArt(e.char) : IMG[e.kind]);
  // The drawer scrolls sideways when there's more than fits
  function traySize(n) {
    const box = UI.trayBox();
    return clamp((box.w - 40) / n - 12, 100, 130);
  }
  function trayScrollMax() {
    const box = UI.trayBox(), n = trayList(game.tray.tab).length, size = traySize(n);
    return Math.max(0, 24 + n * (size + 12) + 12 - box.w);
  }
  function traySlots() {
    const box = UI.trayBox(), list = trayList(game.tray.tab), size = traySize(list.length);
    const scroll = game.tray.scroll || 0;
    return list.map((e, i) => ({ ...e, x: box.x + 24 + i * (size + 12) - scroll, y: box.y + 62, w: size, h: size }));
  }
  function showTraySlot(index) {
    const box = UI.trayBox(), size = traySize(trayList(game.tray.tab).length);
    const left = 24 + index * (size + 12);
    let scroll = game.tray.scroll || 0;
    if (left - scroll < 24) scroll = left - 24;
    if (left + size - scroll > box.w - 24) scroll = left + size - box.w + 24;
    game.tray.scroll = clamp(scroll, 0, trayScrollMax());
  }
  function setTrayTab(tab) {
    game.tray.tab = game.lastTab = tab;
    game.tray.index = 0;
    game.tray.scroll = 0;
  }
  function trayTabs() {
    const box = UI.trayBox();
    return TRAYS.map((t, i) => ({ x: box.x + 20 + i * 186, y: box.y + 8, w: 174, h: 48 }));
  }
  const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  function pauseItems() {
    const buttons = 'Buttons: ' + PAD_STYLES.find(([id]) => id === padStyle)[1];
    return game.screen === 'inside'
      ? ['Keep playing', 'Make a character', buttons, game.paused?.confirmReset ? 'Press again to start over' : `Start the ${game.place.name.toLowerCase()} over`, 'Back to town', 'Main menu']
      : ['Keep playing', buttons, 'Main menu'];
  }
  function pauseRows() {
    const items = pauseItems();
    const y0 = VH / 2 - (items.length * 74) / 2 + 30;
    return items.map((label, i) => ({ label, x: W / 2 - 260, y: y0 + i * 74, w: 520, h: 62 }));
  }
  function choosePause(i) {
    const label = pauseItems()[i];
    sfx.move();
    if (label === 'Keep playing') game.paused = null;
    else if (label === 'Main menu') goToMainMenu();
    else if (label === 'Back to town') { game.paused = null; backToTown(); }
    else if (label === 'Make a character') { game.paused = null; openCreator(); }
    else if (label.startsWith('Buttons')) cyclePadStyle();
    else if (game.paused.confirmReset) { game.paused = null; resetPlace(); showToast('All fresh!'); }
    else game.paused.confirmReset = true;
  }

  // ---------------------------------------------------------------------------
  // Mouse and touch

  function screenPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * VH };
  }
  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    const p = screenPoint(e);
    pointer = { ...p, over: true }; lastPointer = p;
    device = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    if (drag) return; // one finger at a time
    try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (e.button === 2) return;

    if (inBox(p, UI.full())) { toggleFullscreen(); return; }
    if (game.creator) {
      if (inBox(p, UI.creatorBack())) { closeCreator(); return; }
      const i = creatorItemAt(p);
      if (i >= 0) creatorChoose(i);
      return;
    }
    if (game.paused) {
      const rows = pauseRows();
      const i = rows.findIndex((r) => inBox(p, r));
      if (i >= 0) { game.paused.index = i; choosePause(i); }
      else game.paused = null;
      return;
    }
    if (inBox(p, UI.back())) { if (game.screen === 'inside') backToTown(); else game.paused = { index: 0 }; return; }

    if (game.screen === 'town') {
      const i = townSlots().findIndex((s) => inBox(p, { x: s.x - 10, y: s.y - 10, w: s.w + 20, h: s.h + 60 }));
      if (i >= 0) drag = { kind: 'town', index: i, pointerId: e.pointerId };
      return;
    }

    if (hand.holding) dropHeld();
    if (game.tray) {
      const tab = trayTabs().findIndex((b) => inBox(p, b));
      if (tab >= 0) { setTrayTab(tab); sfx.move(); return; }
      if (inBox(p, UI.trayBox())) {
        // Drag sideways to scroll the drawer, drag up to pull a thing out, or just tap it
        const box = UI.trayBox();
        const slot = traySlots().find((sl) => sl.x + sl.w > box.x && sl.x < box.x + box.w && inBox(p, sl));
        drag = { kind: 'tray', slot, startX: p.x, startY: p.y, scroll: game.tray.scroll || 0, pointerId: e.pointerId };
        return;
      }
    }
    if (inBox(p, UI.addButton())) { toggleTray(); return; }

    const w = toWorld(p.x, p.y);
    const t = thingAt(w.x, w.y);
    if (t) {
      getOff(t);
      drag = { kind: 'thing', thing: t, offX: w.x - t.x, offY: w.y - t.y, pointerId: e.pointerId, startX: p.x, startY: p.y };
      // Picked things come to the front of their spot
      sfx.pick();
    } else {
      drag = { kind: 'pan', startX: p.x, camX: game.camX, pointerId: e.pointerId };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = screenPoint(e);
    pointer = { ...p, over: true }; lastPointer = p;
    if (e.pointerType === 'mouse' && device !== 'mouse' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) device = 'mouse';
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.kind === 'pan') {
      game.camX = clampCam(drag.camX - (p.x - drag.startX));
    } else if (drag.kind === 'tray') {
      const dx = p.x - drag.startX, dy = p.y - drag.startY;
      const pulled = !inBox(p, UI.trayBox()) || dy < -30;
      if (drag.scrolling || (!pulled && trayScrollMax() > 0 && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy))) {
        drag.scrolling = true;
        game.tray.scroll = clamp(drag.scroll - dx, 0, trayScrollMax());
      } else if (drag.slot && drag.slot.kind !== 'new' && pulled) {
        // Pull a new one out of the drawer; let go somewhere in the room to put it there
        const w = toWorld(p.x, p.y);
        const t = addThing(drag.slot, w.x, w.y + drag.slot.h / 2);
        drag = { kind: 'new', thing: t, offX: 0, offY: -drag.slot.h / 2, pointerId: e.pointerId, startX: p.x, startY: p.y };
        game.tray = null;
      }
    } else if (drag.kind === 'thing' || drag.kind === 'new') {
      const w = toWorld(p.x, p.y);
      drag.thing.x = w.x - drag.offX;
      drag.thing.y = w.y - drag.offY;
    }
  });
  function endDrag(e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const p = screenPoint(e);
    const d = drag;
    drag = null;
    if (d.kind === 'town') {
      const i = townSlots().findIndex((s) => inBox(p, { x: s.x - 10, y: s.y - 10, w: s.w + 20, h: s.h + 60 }));
      if (i === d.index) enterPlace(i);
      return;
    }
    if (d.kind === 'tray') {
      if (d.scrolling || !d.slot || !game.tray) return;
      // Tapped: "New" opens the character creator, anything else goes in the middle of the room on screen
      if (d.slot.kind === 'new') { openCreator(); return; }
      const w = toWorld(W / 2, 0);
      const t = addThing(d.slot, w.x + (Math.random() - 0.5) * 200, 640);
      game.tray = null;
      keepInRoom(t);
      bounces.set(t, performance.now());
      writeSave();
      return;
    }
    if (d.kind === 'thing' || d.kind === 'new') {
      const t = d.thing;
      if (inBox(p, UI.trash())) { putAway(t); return; }
      keepInRoom(t);
      bounces.set(t, performance.now());
      sfx.drop();
      settle(t);
      writeSave();
    }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { pointer.over = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    if (game.screen !== 'inside' || game.creator) return;
    if (game.tray && inBox(pointer, UI.trayBox())) {
      game.tray.scroll = clamp((game.tray.scroll || 0) + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY), 0, trayScrollMax());
      e.preventDefault();
      return;
    }
    game.camX = clampCam(game.camX + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY));
    e.preventDefault();
  }, { passive: false });

  function clampCam(x) {
    const room = game.place ? game.place.width : W;
    if (room <= W) return (room - W) / 2;
    return clamp(x, 0, room - W);
  }

  // A new thing comes out in the hand, held by its bottom so you can see it above the hand
  function holdNew(entry) {
    const w = toWorld(W / 2, VH / 2 + 60);
    hand.x = W / 2; hand.y = VH / 2 + 60;
    hand.holding = addThing(entry, w.x, w.y + 20);
    hand.offX = 0; hand.offY = 20;
  }

  // ---------------------------------------------------------------------------
  // The character creator: her drawing, with every piece where she drew it

  let CREATOR_ITEMS = null;
  function creatorItems() {
    if (CREATOR_ITEMS) return CREATOR_ITEMS;
    CREATOR_ITEMS = [];
    CREATOR_GROUPS.forEach((g, gi) => g.options.forEach((option) => {
      let def, img, glow;
      if (g.id === 'species') { def = CLAYOUT['species-' + option]; img = CIMG['species-' + option]; glow = CIMG['species-' + option + '-glow']; }
      else if (g.id === 'age') { def = AGE_BUTTONS[option]; img = CIMG['age-' + option]; }
      else if (g.id === 'go') { def = { x: 1715, y: 1480, w: 440, h: 113 }; img = CIMG.go; glow = CIMG['go-glow']; }
      else { def = CLAYOUT[option]; img = CIMG[option]; glow = CIMG[option + '-glow']; }
      if (!def) return;
      CREATOR_ITEMS.push({ group: gi, option, x: def.x, y: def.y, w: def.w, h: def.h, img, glow });
    }));
    return CREATOR_ITEMS;
  }
  function creatorView() {
    const s = Math.min(W / CREATOR_ART.w, VH / CREATOR_ART.h);
    return { s, x: (W - CREATOR_ART.w * s) / 2, y: (VH - CREATOR_ART.h * s) / 2 };
  }
  const toArt = (p) => { const v = creatorView(); return { x: (p.x - v.x) / v.s, y: (p.y - v.y) / v.s }; };
  const creatorItemEnabled = (it) => !CREATOR_GROUPS[it.group].humanOnly || game.creator.look.species === 'human';
  UI.creatorBack = () => ({ x: 18, y: VH - 82, w: 150, h: 64 });

  function openCreator() {
    const look = loadExploreLook();
    look.age = 'big';
    game.creator = { look, cursor: creatorItems().findIndex((it) => CREATOR_GROUPS[it.group].id === 'species' && it.option === look.species) };
    game.tray = null;
    hand.holding = null;
    drag = null;
    game.fade = 1;
    sfx.door();
  }
  function closeCreator() {
    game.creator = null;
    game.fade = 1;
    sfx.door();
  }
  function finishCreator() {
    const ch = { id: nextCharId++, look: { ...game.creator.look } };
    characters.push(ch);
    game.creator = null;
    game.lastTab = TRAYS.findIndex((t) => t.id === 'people');
    const entry = { kind: 'char', char: ch.id };
    if (usingHand()) holdNew(entry);
    else {
      const w = toWorld(W / 2, 0);
      const t = addThing(entry, w.x, 640);
      bounces.set(t, performance.now());
    }
    writeSave();
    game.fade = 1;
    sfx.add();
  }
  // Picks the piece under the cursor. Picking what's already picked takes it off again (hair and clothes only)
  function creatorChoose(index) {
    const it = creatorItems()[index];
    if (!it) return;
    if (!creatorItemEnabled(it)) { sfx.nope(); return; }
    game.creator.cursor = index;
    const g = CREATOR_GROUPS[it.group];
    if (g.id === 'go') { finishCreator(); return; }
    const look = game.creator.look;
    look[g.id] = look[g.id] === it.option && g.optional ? null : it.option;
    tone(520 + g.options.indexOf(it.option) * 60, 0.06, 'square', 0.05);
  }
  // Moves the cursor to the nearest piece in that direction, preferring ones straight ahead
  function moveCreatorCursor(dx, dy) {
    const items = creatorItems(), from = items[game.creator.cursor];
    const fx = from.x + from.w / 2, fy = from.y + from.h / 2, length = Math.hypot(dx, dy);
    let best = -1, bestScore = Infinity;
    items.forEach((it, i) => {
      if (i === game.creator.cursor || !creatorItemEnabled(it)) return;
      const vx = it.x + it.w / 2 - fx, vy = it.y + it.h / 2 - fy;
      const ahead = (vx * dx + vy * dy) / length;
      if (ahead <= 20) return;
      const score = ahead + Math.abs(vx * dy - vy * dx) / length * 2.5;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) { game.creator.cursor = best; sfx.move(); }
  }
  function creatorItemAt(p) {
    const a = toArt(p);
    return creatorItems().findIndex((it) => a.x >= it.x && a.x <= it.x + it.w && a.y >= it.y && a.y <= it.y + it.h);
  }
  function updateCreator(now) {
    const s = stepped(now);
    if (s) moveCreatorCursor(s.dx, s.dy);
    if (device === 'mouse' && pointer.over) {
      const i = creatorItemAt(pointer);
      if (i >= 0 && i !== game.creator.cursor && creatorItemEnabled(creatorItems()[i])) game.creator.cursor = i;
    }
    if (hit('confirm')) creatorChoose(game.creator.cursor);
    else if (hit('back')) closeCreator();
    else if (hit('pause')) { if (usingPad()) finishCreator(); else closeCreator(); }
  }
  function drawCreator(c, now) {
    const v = creatorView(), look = game.creator.look;
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, VH);
    c.save();
    c.translate(v.x, v.y); c.scale(v.s, v.s);
    if (CIMG.background) c.drawImage(CIMG.background, 0, 0);
    creatorItems().forEach((it, i) => {
      const g = CREATOR_GROUPS[it.group];
      const enabled = creatorItemEnabled(it);
      const chosen = enabled && g.id !== 'go' && look[g.id] === it.option;
      const pointed = i === game.creator.cursor && device !== 'touch';
      c.save();
      c.globalAlpha = enabled ? 1 : 0.2;
      c.translate(it.x + it.w / 2, it.y + it.h / 2);
      if (pointed && g.id !== 'species') { c.rotate(0.03 * Math.sin(now / 300)); c.scale(1.08 + 0.015 * Math.sin(now / 220), 1.08 + 0.015 * Math.sin(now / 220)); }
      if (pointed) {
        c.strokeStyle = '#ff0022'; c.lineWidth = 22;
        roundRect(c, -it.w / 2 + 6, -it.h / 2 + 6, it.w - 12, it.h - 12, Math.min(it.w, it.h) / 3); c.stroke();
      }
      if ((chosen || (pointed && g.id === 'go'))) {
        if (it.glow) c.drawImage(it.glow, -it.w / 2, -it.h / 2, it.w, it.h);
        else { c.fillStyle = 'rgba(255, 200, 60, 0.55)'; c.beginPath(); c.ellipse(0, 0, it.w * 0.55, it.h * 0.55, 0, 0, 7); c.fill(); }
      }
      if (it.img) c.drawImage(it.img, -it.w / 2, -it.h / 2, it.w, it.h);
      c.restore();
    });
    // The character, standing where it was drawn (babies stand on the same floor)
    c.translate(CREATOR_NECK.x, CREATOR_NECK.y);
    if (look.species === 'bear') {
      const k = look.age === 'baby' ? 0.55 : 1, bw = 626 * 4 / 3 * k, bh = 766 * 4 / 3 * k;
      if (CIMG.bear) c.drawImage(CIMG.bear, 17 - bw / 2, 328 - bh, bw, bh);
    } else {
      if (look.age === 'baby') c.translate(0, 425 * (1 - BABY_BODY.sy));
      drawHuman(c, look);
    }
    c.restore();
    drawUiButton(c, UI.creatorBack(), usingHand() ? 'Back' : '← Back', { size: 28, action: 'back' });
    drawFullscreenButton(c);
    drawPrompts(c, [['move', 'Move'], ['confirm', 'Choose'], ['back', 'Back'], ...(usingPad() ? [['pause', 'Done']] : [])], W / 2, 34, 'center', 30);
  }

  function toggleTray() {
    if (game.tray) game.tray = null;
    else { game.tray = { tab: game.lastTab || 0, index: 0, scroll: 0 }; if (hand.holding) dropHeld(); }
    sfx.move();
  }

  // ---------------------------------------------------------------------------
  // Keys and controller, each frame

  let repeatAt = 0;
  function stepped(now) {
    // Menus move one step per press, repeating while held
    const dir = Math.abs(moveX) > 0.5 ? Math.sign(moveX) : 0, dirY = Math.abs(moveY) > 0.5 ? Math.sign(moveY) : 0;
    if (!dir && !dirY) { repeatAt = 0; return null; }
    if (now < repeatAt) return null;
    repeatAt = now + (repeatAt ? 160 : 320);
    return { dx: dir, dy: dirY };
  }

  function update(now, dt) {
    pollInput();
    if (hit('fullscreen')) toggleFullscreen();

    if (game.creator) { updateCreator(now); return; }
    if (game.paused) {
      const s = stepped(now);
      const n = pauseItems().length;
      if (s && s.dy) { game.paused.index = (game.paused.index + s.dy + n) % n; game.paused.confirmReset = false; sfx.move(); }
      if (hit('confirm')) choosePause(game.paused.index);
      else if (hit('back') || hit('pause')) game.paused = null;
      return;
    }
    if (hit('pause')) { game.paused = { index: 0 }; sfx.move(); return; }

    if (game.screen === 'town') {
      const s = stepped(now);
      if (s) {
        const cols = townCols(), n = PLACES.length;
        let i = game.townIndex;
        if (s.dx) i = Math.floor(i / cols) * cols + ((i % cols) + s.dx + cols) % cols;
        if (s.dy) i = (i + s.dy * cols + n) % n;
        if (i !== game.townIndex) { game.townIndex = i; sfx.move(); }
      }
      if (device === 'mouse' && pointer.over) {
        const i = townSlots().findIndex((sl) => inBox(pointer, { x: sl.x - 10, y: sl.y - 10, w: sl.w + 20, h: sl.h + 60 }));
        if (i >= 0 && i !== game.townIndex) { game.townIndex = i; sfx.move(); }
      }
      if (hit('confirm')) enterPlace(game.townIndex);
      else if (hit('back')) goToMainMenu();
      return;
    }

    // Inside a place
    updateRides(now);
    if (game.tray) {
      const list = trayList(game.tray.tab);
      const s = stepped(now);
      if (s && s.dx) {
        // Off either end of a drawer goes on to the next drawer
        const i = game.tray.index + s.dx;
        if (i < 0 || i >= list.length) {
          const tab = (game.tray.tab + s.dx + TRAYS.length) % TRAYS.length;
          setTrayTab(tab);
          game.tray.index = i < 0 ? trayList(tab).length - 1 : 0;
        } else game.tray.index = i;
        showTraySlot(game.tray.index);
        sfx.move();
      }
      const step = hit('nextTab') || (s && !s.dx && s.dy > 0) ? 1 : hit('prevTab') || (s && !s.dx && s.dy < 0) ? -1 : 0;
      if (step) { setTrayTab((game.tray.tab + step + TRAYS.length) % TRAYS.length); sfx.move(); }
      if (hit('confirm')) {
        const entry = list[game.tray.index];
        if (entry.kind === 'new') { openCreator(); return; }
        // The new thing comes out in your hand, ready to put down, held by its bottom so you can see it
        holdNew(entry);
        game.tray = null;
      } else if (hit('back') || hit('add')) toggleTray();
      return;
    }

    if (usingHand()) {
      // Move the hand; push against the sides to look around
      const speed = 620;
      hand.x += moveX * speed * dt;
      hand.y += moveY * speed * dt;
      const edge = 90;
      if (hand.x < edge && moveX < 0) game.camX = clampCam(game.camX + moveX * speed * dt);
      if (hand.x > W - edge && moveX > 0) game.camX = clampCam(game.camX + moveX * speed * dt);
      hand.x = clamp(hand.x, 20, W - 20);
      hand.y = clamp(hand.y, 20, VH - 20);
      if (hand.holding) {
        const w = toWorld(hand.x, hand.y);
        hand.holding.x = w.x + hand.offX;
        hand.holding.y = w.y + hand.offY;
      }
      if (hit('confirm')) {
        if (hand.holding) dropHeld();
        else {
          const w = toWorld(hand.x, hand.y);
          const t = thingAt(w.x, w.y);
          if (t) pickUp(t, w);
        }
      }
      if (hit('remove')) {
        const w = toWorld(hand.x, hand.y);
        putAway(hand.holding || thingAt(w.x, w.y));
      }
      if (hit('flip')) {
        const w = toWorld(hand.x, hand.y);
        const t = hand.holding || thingAt(w.x, w.y);
        if (t) { t.flip = !t.flip; sfx.move(); writeSave(); }
      }
      if (hit('add')) toggleTray();
      if (hit('back')) { if (hand.holding) dropHeld(); else backToTown(); }
    }

    // Dragging something with the mouse or a finger near the side of the screen looks further that way
    if (drag && (drag.kind === 'thing' || drag.kind === 'new')) {
      const p = lastPointer;
      let push = 0;
      if (p.x < 70) push = -1; else if (p.x > W - 70 && !inBox(p, UI.trash())) push = 1;
      if (push) {
        const before = game.camX;
        game.camX = clampCam(game.camX + push * 520 * dt);
        drag.thing.x += game.camX - before;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Drawing

  const FACE = {
    xbox: { south: ['A', '#3cb043'], east: ['B', '#e53935'], west: ['X', '#1e88e5'], north: ['Y', '#fbc02d'] },
    deck: { south: ['A', '#fff'], east: ['B', '#fff'], west: ['X', '#fff'], north: ['Y', '#fff'] },
    nintendo: { south: ['B', '#fff'], east: ['A', '#fff'], west: ['Y', '#fff'], north: ['X', '#fff'] },
    ps: { south: ['cross', '#7cb2e8'], east: ['circle', '#ff6666'], west: ['square', '#e88ad8'], north: ['triangle', '#40e0b0'] },
  };
  const START = { xbox: 'menu', deck: 'menu', nintendo: '+', ps: 'OPTIONS' };
  const SHOULDER = { xbox: ['LB', 'RB'], deck: ['L1', 'R1'], nintendo: ['L', 'R'], ps: ['L1', 'R1'] };

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
      const w = keyCap(c, KEY_LABEL[action] || '?', x, y, size);
      c.restore(); return w;
    }
    if (action === 'move') {
      c.fillStyle = '#333'; c.beginPath(); c.arc(x + r, y, r, 0, 7); c.fill();
      c.fillStyle = '#666'; c.beginPath(); c.arc(x + r, y, r * 0.62, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = font(size * 0.4); c.fillText('L', x + r, y + 1);
      c.restore(); return size;
    }
    if (action === 'pause' || action === 'prevTab' || action === 'nextTab' || action === 'flip') {
      const label = action === 'pause' ? START[device] : action === 'flip' ? (device === 'nintendo' ? 'ZR' : device === 'xbox' ? 'RT' : 'R2') : SHOULDER[device][action === 'prevTab' ? 0 : 1];
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
  // A row of [action, words] prompts. align: 'left' | 'right' | 'center'
  function drawPrompts(c, list, x, y, align = 'left', size = 32) {
    if (!usingHand()) return;
    c.save();
    c.font = font(size * 0.62);
    const widths = list.map(([a, t]) => measureButton(a, size) + 10 + c.measureText(t).width);
    const total = widths.reduce((s, w) => s + w, 0) + 26 * (list.length - 1);
    let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    c.fillStyle = 'rgba(255,255,255,0.75)';
    roundRect(c, cx - 14, y - size * 0.75, total + 28, size * 1.5, size * 0.5); c.fill();
    list.forEach(([a, t], i) => {
      const bw = drawButton(c, a, cx, y, size);
      c.font = font(size * 0.62); c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = INK; c.fillText(t, cx + bw + 10, y + 1);
      cx += widths[i] + 26;
    });
    c.restore();
  }

  // A round, hand-drawn looking button with words or a picture
  // With a controller or keys, the button that does the same thing is drawn on it too
  function drawUiButton(c, b, label, { active = false, color = '#ffffff', size = 30, action = null } = {}) {
    c.save();
    c.fillStyle = active ? '#fff3a0' : color;
    c.strokeStyle = PENCIL; c.lineWidth = 5;
    roundRect(c, b.x, b.y, b.w, b.h, 22); c.fill(); c.stroke();
    let textX = b.x + b.w / 2;
    if (action && usingHand()) {
      const bw = drawButton(c, action, b.x + 12, b.y + b.h / 2, 30);
      textX = b.x + 12 + bw + (b.w - 12 - bw) / 2;
    }
    c.font = font(size); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = PENCIL;
    c.fillText(label, textX, b.y + b.h / 2 + 2);
    c.restore();
  }
  function drawFullscreenButton(c) {
    const b = UI.full();
    drawUiButton(c, b, '');
    c.save(); c.strokeStyle = PENCIL; c.lineWidth = 5; c.lineCap = 'round';
    const m = 18, x0 = b.x + m, y0 = b.y + m, x1 = b.x + b.w - m, y1 = b.y + b.h - m, k = 10;
    c.beginPath();
    c.moveTo(x0, y0 + k); c.lineTo(x0, y0); c.lineTo(x0 + k, y0);
    c.moveTo(x1 - k, y0); c.lineTo(x1, y0); c.lineTo(x1, y0 + k);
    c.moveTo(x1, y1 - k); c.lineTo(x1, y1); c.lineTo(x1 - k, y1);
    c.moveTo(x0 + k, y1); c.lineTo(x0, y1); c.lineTo(x0, y1 - k);
    c.stroke(); c.restore();
  }

  function drawThing(c, t, x, y, now, lifted = false, { shadow = true, tilt = 0 } = {}) {
    const img = artOf(t);
    const { w, h } = sizeOf(t);
    c.save();
    c.translate(x, y);
    // A little bounce when it's put down, a wobble while it's held, and people sway a bit
    const b = bounces.get(t);
    let sy = 1, rot = 0;
    if (b) {
      const k = (now - b) / 350;
      if (k >= 1) bounces.delete(t);
      else sy = 1 - Math.sin(k * Math.PI) * 0.12 * (1 - k);
    }
    if (lifted) rot = Math.sin(now / 120) * 0.05;
    else if (defOf(t).person || t.kind === 'char') rot = Math.sin(now / 700 + t.id) * 0.025;
    rot += tilt;
    // Shadow on the floor
    if (shadow) {
      c.fillStyle = 'rgba(40, 30, 80, 0.13)';
      c.beginPath(); c.ellipse(0, lifted ? 26 : -2, w * 0.38, 12, 0, 0, 7); c.fill();
    }
    if (lifted) c.translate(0, -16);
    c.rotate(rot);
    c.scale((t.flip ? -1 : 1) * (lifted ? 1.06 : 1) * (2 - sy), sy * (lifted ? 1.06 : 1));
    if (img) c.drawImage(img, -w / 2, -h, w, h);
    else { c.fillStyle = '#ddd'; c.fillRect(-w / 2, -h, w, h); }
    c.restore();
  }

  function drawHand(c, now) {
    if (!usingHand() || game.screen !== 'inside' || game.tray || game.paused) return;
    const { x, y } = hand;
    const w = toWorld(x, y);
    const over = !hand.holding && thingAt(w.x, w.y);
    c.save();
    c.translate(x, y);
    const grip = hand.holding ? 0.8 : 1;
    // A friendly mitten in her purple pencil
    c.lineWidth = 6; c.strokeStyle = PENCIL; c.fillStyle = over ? '#fff3a0' : '#ffffff';
    c.beginPath(); c.ellipse(0, 0, 26 * grip, 30 * grip, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(-24 * grip, 6, 10, 15, -0.6, 0, 7); c.fill(); c.stroke();
    if (!hand.holding) {
      c.lineWidth = 3;
      for (const fx of [-9, 1, 11]) { c.beginPath(); c.moveTo(fx, -28); c.lineTo(fx, -12); c.stroke(); }
    }
    if (over) {
      c.strokeStyle = '#ffb000'; c.lineWidth = 5; c.setLineDash([10, 9]); c.lineDashOffset = -now / 30;
      c.beginPath(); c.arc(0, 0, 46, 0, 7); c.stroke();
    }
    c.restore();
  }

  function drawTown(c, now) {
    c.drawImage(townBackdrop(), 0, 0);
    words(c, 'My Kingdom', W / 2, 62, 58);
    words(c, 'Pick a place to go inside', W / 2, 118, 26, '#3f7f3f');
    const slots = townSlots();
    PLACES.forEach((p, i) => {
      const s = slots[i];
      const picked = i === game.townIndex && (usingHand() || device === 'mouse');
      const bob = picked ? Math.sin(now / 220) * 5 : 0;
      if (picked) {
        c.save();
        c.fillStyle = 'rgba(255, 238, 120, 0.7)';
        c.beginPath(); c.ellipse(s.cx, s.y + s.h / 2 + 10, s.w * 0.62, s.h * 0.62, 0, 0, 7); c.fill();
        c.restore();
      }
      const img = IMG[p.id];
      if (img) c.drawImage(img, s.x, s.y + bob, s.w, s.h);
      c.save();
      c.font = font(34); c.textAlign = 'center'; c.textBaseline = 'top';
      c.lineWidth = 8; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineJoin = 'round';
      c.strokeText(p.name, s.cx, s.labelY);
      c.fillStyle = PENCIL; c.fillText(p.name, s.cx, s.labelY);
      c.restore();
    });
    drawUiButton(c, UI.back(), 'Menu', { size: 28, action: 'back' });
    drawFullscreenButton(c);
    drawPrompts(c, [['move', 'Pick'], ['confirm', 'Go inside'], ['back', 'Main menu']], W / 2, VH - 36, 'center');
  }

  function drawInside(c, now) {
    const place = game.place;
    const oy = groundY();
    // Fill above and below the room on tall screens
    const art = backdrop(place);
    const sx = Math.max(0, Math.round(game.camX)), dx = Math.max(0, -game.camX), sw = Math.min(W, art.width - sx);
    c.drawImage(art, sx, 0, sw, 720, dx, oy, sw, 720);
    if (oy > 0) {
      // Tall screens: stretch the top of the wall up and the bottom of the floor down
      c.drawImage(art, sx, 0, sw, 1, dx, 0, sw, oy + 1);
      c.drawImage(art, sx, 719, sw, 1, dx, oy + 719, sw, VH - oy - 719);
    }

    c.save();
    c.translate(-game.camX, oy);
    const dragging = drag && (drag.kind === 'thing' || drag.kind === 'new') ? drag.thing : null;
    const loose = (t) => t !== hand.holding && t !== dragging;
    for (const t of drawOrder()) {
      if (!loose(t) || t.on || t.sliding) continue;
      // Babies in the ball pit sit behind its front; swing riders hang in front of their swing
      const riders = ridersOf(t).filter(loose);
      for (const r of riders) if (r.on.pit) drawThing(c, r, r.x, r.y, now, false, { shadow: false });
      drawThing(c, t, t.x, t.y, now);
      for (const r of riders) {
        if (r.on.pit) continue;
        const pivot = pointOn(t, defOf(t).swing.pivot);
        c.save();
        c.translate(r.x, pivot.y);
        c.rotate(swingAngle(r, now));
        drawThing(c, r, 0, r.y - pivot.y, now, false, { shadow: false });
        c.restore();
      }
    }
    for (const t of things()) {
      if (!t.sliding || !loose(t)) continue;
      drawThing(c, t, t.x, t.y, now, false, { shadow: false, tilt: (t.flip ? 1 : -1) * -(t.sliding.angle || 0) });
      if (t.sliding.whee) words(c, 'Wheee!', t.x, t.y - sizeOf(t).h - 24, 34, '#e0408a');
    }
    const lifted = hand.holding || dragging;
    if (lifted) drawThing(c, lifted, lifted.x, lifted.y, now, true);
    c.restore();

    // Arrows at the sides when there's more room that way
    const room = place.width;
    c.save(); c.fillStyle = 'rgba(90, 73, 181, 0.55)';
    if (game.camX > 4) { c.beginPath(); c.moveTo(14, VH / 2); c.lineTo(44, VH / 2 - 34); c.lineTo(44, VH / 2 + 34); c.fill(); }
    if (game.camX < room - W - 4) { c.beginPath(); c.moveTo(W - 14, VH / 2); c.lineTo(W - 44, VH / 2 - 34); c.lineTo(W - 44, VH / 2 + 34); c.fill(); }
    c.restore();

    // Name of the place
    c.save();
    c.font = font(44); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 10; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineJoin = 'round';
    c.strokeText(place.name, W / 2, 48); c.fillStyle = PENCIL; c.fillText(place.name, W / 2, 48);
    c.restore();

    drawUiButton(c, UI.back(), usingHand() ? 'Town' : '← Town', { size: 28, action: 'back' });
    drawFullscreenButton(c);

    const holdingSomething = hand.holding || dragging;
    if (holdingSomething) {
      // The basket where things get put away
      const b = UI.trash();
      const p = dragging ? lastPointer : hand;
      const over = inBox(p, b);
      c.save();
      c.fillStyle = over ? '#ffe0ea' : 'rgba(255,255,255,0.85)';
      c.strokeStyle = PENCIL; c.lineWidth = 5;
      roundRect(c, b.x, b.y, b.w, b.h, 24); c.fill(); c.stroke();
      c.beginPath();
      c.moveTo(b.x + 22, b.y + 50); c.lineTo(b.x + b.w - 22, b.y + 50); c.lineTo(b.x + b.w - 34, b.y + 108); c.lineTo(b.x + 34, b.y + 108); c.closePath();
      c.fillStyle = '#ffb3cf'; c.fill(); c.stroke();
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(b.x + 22 + i * (b.w - 44) / 4, b.y + 54); c.lineTo(b.x + 34 + i * (b.w - 68) / 4, b.y + 104); c.stroke(); }
      c.font = font(22); c.textAlign = 'center'; c.fillStyle = PENCIL; c.fillText('Put away', b.x + b.w / 2, b.y + 30);
      c.restore();
    }

    if (game.tray) drawTray(c, now);
    else if (!holdingSomething) drawUiButton(c, UI.addButton(), usingHand() ? 'Add' : '+ Add', { size: 34, color: '#fff3a0', action: 'add' });

    if (!game.tray && !game.paused) {
      const list = hand.holding
        ? [['move', 'Move'], ['confirm', 'Put down'], ['remove', 'Put away'], ['flip', 'Turn']]
        : [['move', 'Move'], ['confirm', 'Pick up'], ['add', 'Add'], ['back', 'Town']];
      drawPrompts(c, list, W / 2, VH - 34, 'center', 30);
    }
    drawHand(c, now);
  }

  function drawTray(c, now) {
    const box = UI.trayBox();
    c.save();
    c.fillStyle = 'rgba(255, 255, 255, 0.95)'; c.strokeStyle = PENCIL; c.lineWidth = 6;
    roundRect(c, box.x, box.y, box.w, box.h, 26); c.fill(); c.stroke();
    trayTabs().forEach((b, i) => drawUiButton(c, b, TRAYS[i].name, { active: i === game.tray.tab, size: 26 }));
    if (usingHand()) {
      const tabs = trayTabs();
      const last = tabs[tabs.length - 1];
      c.save();
      c.font = font(20); c.textBaseline = 'middle';
      let x = last.x + last.w + 20;
      x += drawButton(c, 'prevTab', x, last.y + last.h / 2, 30) + 4;
      x += drawButton(c, 'nextTab', x, last.y + last.h / 2, 30) + 10;
      c.fillStyle = INK; c.fillText('Switch', x, last.y + last.h / 2 + 1);
      c.restore();
    }
    c.save();
    c.beginPath(); c.rect(box.x + 6, box.y + 56, box.w - 12, box.h - 60); c.clip();
    traySlots().forEach((s, i) => {
      const picked = usingHand() && i === game.tray.index;
      const isNew = s.kind === 'new';
      c.fillStyle = picked ? '#fff3a0' : isNew ? '#fffbe0' : '#f4f0ff';
      roundRect(c, s.x, s.y, s.w, s.h, 18); c.fill();
      c.lineWidth = picked ? 6 : 3; c.strokeStyle = picked ? '#ffb000' : 'rgba(90,73,181,0.4)'; c.stroke();
      const bob = picked ? Math.sin(now / 200) * 3 : 0;
      if (isNew) {
        // A big plus: make a new character
        c.save();
        c.strokeStyle = PENCIL; c.lineWidth = 10; c.lineCap = 'round';
        const cx = s.x + s.w / 2, cy = s.y + (s.h - 30) / 2 + 4 + bob, r = Math.min(26, s.w / 4);
        c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.moveTo(cx, cy - r); c.lineTo(cx, cy + r); c.stroke();
        c.restore();
      }
      const img = isNew ? null : entryArt(s);
      if (img) {
        const k = Math.min((s.w - 16) / img.width, (s.h - 40) / img.height);
        c.drawImage(img, s.x + s.w / 2 - img.width * k / 2, s.y + 8 + (s.h - 40 - img.height * k) / 2 + bob, img.width * k, img.height * k);
      }
      c.font = font(Math.min(18, s.w / 7)); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = PENCIL;
      c.fillText(s.name, s.x + s.w / 2, s.y + s.h - 16);
    });
    c.restore();
    // Little arrows when the drawer has more than fits
    const scroll = game.tray.scroll || 0, max = trayScrollMax();
    c.fillStyle = 'rgba(90, 73, 181, 0.7)';
    if (scroll > 2) { c.beginPath(); c.moveTo(box.x + 8, box.y + 127); c.lineTo(box.x + 24, box.y + 107); c.lineTo(box.x + 24, box.y + 147); c.fill(); }
    if (scroll < max - 2) { c.beginPath(); c.moveTo(box.x + box.w - 8, box.y + 127); c.lineTo(box.x + box.w - 24, box.y + 107); c.lineTo(box.x + box.w - 24, box.y + 147); c.fill(); }
    c.restore();
    const onNew = trayList(game.tray.tab)[game.tray.index]?.kind === 'new';
    drawPrompts(c, [['move', 'Pick'], ['confirm', onNew ? 'Make a character' : 'Add it'], ['back', 'Close']], W / 2, box.y - 34, 'center', 30);
  }

  function drawPause(c) {
    c.save();
    c.fillStyle = 'rgba(30, 20, 60, 0.5)'; c.fillRect(0, 0, W, VH);
    const rows = pauseRows();
    const top = rows[0].y - 100, bottom = rows[rows.length - 1].y + 96;
    c.fillStyle = '#ffffff'; c.strokeStyle = PENCIL; c.lineWidth = 6;
    roundRect(c, W / 2 - 300, top, 600, bottom - top, 30); c.fill(); c.stroke();
    words(c, 'Paused', W / 2, top + 48, 46);
    rows.forEach((r, i) => drawUiButton(c, r, r.label, { active: i === game.paused.index && usingHand(), size: 28, color: '#f4f0ff' }));
    c.restore();
  }

  function draw(now) {
    const c = ctx;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.clearRect(0, 0, W, VH);
    if (game.creator) drawCreator(c, now);
    else if (game.screen === 'town') drawTown(c, now);
    else drawInside(c, now);
    if (game.paused) drawPause(c);
    if (game.toast && now < game.toast.until) {
      c.save();
      c.font = font(32);
      const tw = c.measureText(game.toast.text).width + 60;
      c.fillStyle = '#fff3a0'; c.strokeStyle = PENCIL; c.lineWidth = 5;
      roundRect(c, W / 2 - tw / 2, 100, tw, 64, 24); c.fill(); c.stroke();
      c.fillStyle = PENCIL; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(game.toast.text, W / 2, 133);
      c.restore();
    }
    if (game.fade > 0) {
      c.fillStyle = `rgba(255, 255, 255, ${game.fade})`;
      c.fillRect(0, 0, W, VH);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(now, dt);
    game.fade = Math.max(0, game.fade - dt * 4);
    draw(now);
    requestAnimationFrame(frame);
  }

  // Loading screen until her drawings are in
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#bfe6ff'; ctx.fillRect(0, 0, W, VH);
  words(ctx, 'Loading…', W / 2, VH / 2, 44);
  loading.then(() => {
    // Coming back from a place you were in last time? Start in the town with it picked
    requestAnimationFrame((t) => { last = t; frame(t); });
  });

  // For tests and screenshots
  window.__creative = { game, hand, world, enterPlace, backToTown, PLACES, openCreator, creatorItems, creatorView, get characters() { return characters; }, setDevice: (d) => { device = d; } };
})();
