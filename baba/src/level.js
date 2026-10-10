// The red planet level. Units are pixels; the screen is 1280 x 800.
// Solids are [x, y, w, h]; the player can stand on all of them and bonk
// their heads underneath. Falling into a gap is an "ouch".

export const GROUND_Y = 680;
const G = GROUND_Y, GH = 160;

export const LEVEL = {
  width: 7600,
  start: [140, G],

  ground: [
    [0, G, 1400, GH],
    [1560, G, 900, GH],
    [2620, G, 760, GH],
    [3540, G, 1200, GH],
    [4900, G, 600, GH],
    [5660, G, 1940, GH],
  ],

  // floating ledges sit high enough for the pig to walk underneath, and
  // never hang over a gap (bonking your head there would drop you in)
  platforms: [
    [600, 510, 220, 36],
    [1000, 390, 200, 36],
    [1740, 510, 200, 36],
    [2060, 400, 200, 36],
    [2860, 590, 110, 90],   // little rock you hop over
    [3150, 530, 110, 150],  // taller rock
    [3740, 510, 200, 36],
    [4040, 390, 220, 36],
    [4360, 510, 200, 36],
    [5080, 510, 180, 36],
    [5260, 390, 160, 36],
    // stairs up to the flag
    [6100, 620, 90, 60],
    [6190, 560, 90, 120],
    [6280, 500, 90, 180],
    [6370, 440, 90, 240],
  ],

  // enemies walk back and forth between their min and max x
  enemies: [
    { x: 900, min: 700, max: 1350 },
    { x: 1250, min: 700, max: 1380 },
    { x: 2000, min: 1580, max: 2440 },
    { x: 2300, min: 1580, max: 2440 },
    { x: 2700, min: 2630, max: 3130 },
    { x: 3300, min: 3270, max: 3370 },
    { x: 3800, min: 3560, max: 4720 },
    { x: 4100, min: 4040, max: 4260, y: 390 },
    { x: 4500, min: 3560, max: 4720 },
    { x: 5200, min: 4910, max: 5490 },
    { x: 5800, min: 5670, max: 6090 },
    { x: 6000, min: 5670, max: 6090 },
  ],

  rocks: [[300, 3], [1900, 1], [3600, 2], [5200, 3], [5900, 1], [6900, 2]],
  plants: [[480, '#e65ca0'], [1650, '#f7d35c'], [2750, '#7ec8f2'], [4200, '#e65ca0'], [5000, '#f7d35c'], [5760, '#7ec8f2'], [7300, '#e65ca0']],

  flagX: 6700,
  rocketX: 7050,
};
