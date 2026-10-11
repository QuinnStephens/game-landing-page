# Notes for agents working on these games

These are small browser games, mostly made with (and drawn by) Violeta. Keep new games and changes in the same spirit:

- **Simple browser canvas games.** No build step and no dependencies other than [Pixi.js](https://pixijs.com) from a CDN, and skip Pixi when drawing to a plain `<canvas>` is easy enough. Static files only; Cloudflare Pages serves the repo root as-is.
- **One folder per game**, served at `/<folder>/`, with a link in `games.json` so it shows up in the launcher. See the README for the steps, including the shared `../back-to-launcher.js` script. When you change a game, bump its `updated` date in `games.json` so it shows up in the launcher's "Recently updated" sort.
- **Use her art.** Her drawings (usually PSDs) go in the game's `assets/` as cut-out PNGs. When something she hasn't drawn yet is needed, make a placeholder that matches her style: thick, bright marker lines and simple shapes on white. Make placeholders easy to swap for her drawings later.
- **Fullscreen and controller support**, so every game plays well on a Steam Deck: stick and d-pad to move, face buttons for actions, Start for a menu, and a way to go fullscreen.
- **Button prompts follow the controller.** Show keyboard keys after keyboard input, and the right button names after controller input: Xbox (A B X Y), PlayStation (✕ ○ □ △), Nintendo (B A Y X by position) and Steam Deck. Read it from the gamepad's `id`.
- **Made for a kid.** Big readable text, forgiving rules, nothing scary or punishing.
