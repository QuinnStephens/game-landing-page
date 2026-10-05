# yetz-game

A Pixi + Matter.js physics game. It's a single static `index.html` with assets in `public/`, so there's no build step.

## Controls

| Action | Keyboard | Controller (Steam Deck, Xbox, etc.) |
| --- | --- | --- |
| Drive left / right | Arrow keys | Left stick or D-pad |
| Jump | Up arrow | A or D-pad up |
| Spawn a letter block | Space | X |
| Toggle debug view | D | Select (View) |
| Reset | R | Start (Menu) |

## Running locally

Serve the folder with any static server, for example:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploying to Cloudflare Pages

One-time setup in the Cloudflare dashboard:

1. Go to **Workers & Pages** > **Create** > **Pages** > **Connect to Git**.
2. Pick the `yetz-game` repository.
3. Build settings: Framework preset **None**, Build command **empty**, Build output directory **`/`**.
4. Click **Save and Deploy**.

The site will be at `https://yetz-game.pages.dev` (or whatever project name you chose). Every push to `main` redeploys it, and other branches get their own preview URLs.

## Playing on a Steam Deck

1. Switch to **Desktop Mode** (Steam button > Power > Switch to Desktop).
2. Open Steam, then **Games** > **Add a Non-Steam Game to My Library**. If Chrome isn't already in your library, tick **Google Chrome** and add it. If it is (Steam hides programs you've already added), click **Browse…**, set the filter to **All Files**, and pick `/usr/bin/flatpak` instead.
3. Right-click the new entry > **Properties** and rename it (e.g. "Bear Game"). For Launch Options, copy the line from your existing Chrome entry (it starts with `run --branch=stable ... com.google.Chrome`), then put these at the end in place of the old URL:

   ```
   --kiosk --autoplay-policy=no-user-gesture-required https://yetz-game.pages.dev
   ```

4. Return to Gaming Mode, open the new entry's controller settings, and choose the **Gamepad** layout (not the Web Browser layout), so the Deck's buttons reach the game as a controller.
