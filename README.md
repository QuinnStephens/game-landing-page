# Quinn, Mezzie and Violeta's Games

One Cloudflare Pages site for all the games. The root `index.html` is the launcher, and each game lives in its own folder and is served at that path:

| Game | Folder / path |
| --- | --- |
| My Kingdom | `my-kingdom/` |
| Baba Boo Bee Ba | `baba/` |
| In My Mom's Tummy | `in-my-moms-tummy/` |
| Jojo Finds Momo | `jojo-finds-momo/` |
| Photo Taker | `photo-taker/` |
| Escape the School | `escape-the-school/` |

Everything is static with no build step (Cloudflare Pages: no build command, output directory `/`). To try it locally, serve the repo root, e.g. `python3 -m http.server`, and open http://localhost:8000.

## Adding a game

1. Make a new folder with the game's `index.html` in it. Use relative paths for its files (`assets/x.png`, not `/assets/x.png`).
2. Add `<script src="../back-to-launcher.js"></script>` to its page, so holding Select + Start (or pressing Escape) goes back to the launcher. Add `data-no-escape` to that tag if the game uses Escape itself.
3. Add an entry to `games.json` with a `title`, `tagline`, `url` (`/folder-name/`) and `image` (a 16:9 picture in `images/`).
   Also give it `added` and `updated` dates (like `2026-10-11T18:44`), which the launcher's "Newest" and "Recently updated" sorts use. When you change a game, bump its `updated` date.

The launcher's order in `games.json` is the "Featured" sort. Players can switch to A to Z, Recently updated or Newest with the Sort button, the S key or the top face button on a controller, and the choice is remembered.

Each game's folder has its own README for how that game works. The games came from their own repos with `git subtree add`, so `git log -- <folder>` shows their full history.
