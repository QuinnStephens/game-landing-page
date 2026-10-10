# Baba Boo Bee Ba

A red-planet platformer starring **Honky Pig**, made from a 7-year-old's drawing
(`assets/concept-art.jpg`). Stomp the green EMENYs, reach the flag, fly the
rocket to the blue planet, and knock the THE END letters around.

Plain static site: `index.html` + ES modules in `src/`, with PIXI.js loaded from
a CDN. No build step; any static host works (Cloudflare Pages: no build command,
output directory `/`). Opening `index.html` straight from disk won't work because
browsers block modules on `file://`, so serve it, e.g. `npx http-server .`

## Controls

| | Controller (Steam Deck) | Keyboard |
|---|---|---|
| Move | Left stick / D-pad | Arrows or A / D |
| Jump (hold for higher) | A or B | Space, Up, W or Z |
| Run | X, Y or right trigger | Shift or X |
| Full screen | Start | F (or the corner button) |
| Back to title | Select | R |

## Files

- `src/game.js` – scenes (title, level, ouch, space, the end), player and enemy
- `src/level.js` – where the ground, ledges, enemies and flag are
- `src/art.js` – crayon-style backgrounds, ground, rocket, flag, letters
- `src/crayon.js` – wobbly-line / scribble-fill helpers and hand-drawn letters
- `src/input.js` – keyboard + Gamepad API
- `src/audio.js` – little synth sound effects
- `assets/pig.png`, `assets/enemy.png` – cut out of the original drawing
