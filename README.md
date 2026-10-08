# yetz-game

A Pixi + Matter.js physics game. It's a single static `index.html` with assets in `public/`, so there's no build step.

## Main menu

The game starts on the hand-drawn main menu. Pick a button with the arrow keys, the D-pad or the left stick (or the mouse), and press Enter, Space or A (or click). The selected button glows. **Explore** and **Survival** open the character creator first; **Creative** says "coming soon" for now.

The menu art lives in `public/img/menu/`: `background.jpg` and one PNG per button, cut from the layers of the original drawing, plus a `-glow.png` for each button's highlight. Button positions in `index.html` (`MENU_BUTTONS`) are the layer positions in that 2224x1668 drawing.

## Character creator

Before Explore starts you make your character, on a screen cut from the hand-drawn design. Every piece sits where it was drawn:

- **Lower left:** bear or human
- **Top:** skin colour
- **Tall oval:** hairstyles
- **Upper left:** pants and skirts
- **Far right:** shirts (the black one is a dress)

Only humans can change how they look: a bear is just a brown bear, so the other panels fade out while bear is picked. Click a piece to put it on, and click it again to take it off (hair and clothes only). With the keyboard or a controller, the arrow keys, D-pad or left stick move a red ring between the pieces without picking anything, and Enter or A picks the piece in the ring (or starts the game on the **Explore** button in the bottom right). Picked pieces glow orange. Start also starts the game. Esc or B goes back to the main menu. Your character rides in the car, and it's remembered next time.

The pieces are in `public/img/creator/`, with `layout.json` saying where each one sat in the 2224x1668 drawing. `tools/cut_creator_art.py` cut them out of the drawing (it needs numpy, scipy and Pillow), so changes to the drawing can be re-cut with `python3 tools/cut_creator_art.py character-creator-design.png`. How clothes and hair fit on the character is in `index.html` (`CLOTHES_BOXES`, `HAIR_BOXES`).

## Survival

A platformer level cut from the hand-drawn survival design: purple scribbles, black-outlined platforms and little blue blobs that patrol back and forth. You drive the same way as in Explore, but there's no build mode and no letter blocks, and you can only jump from something solid (Space jumps too). Jump on a blob to squish it; touch one any other way and it's back to the start, since you only get one hit. Reach the big star at the end for a burst of sparkles, and the level starts over a few seconds later.

The blobs and platforms are in `public/img/survival/`, cut out of the drawing by `tools/cut_survival_art.py` (`python3 tools/cut_survival_art.py survival-design.png`; it needs numpy, scipy and Pillow). `layout.json` has each piece's size and, for platforms, the outline of the solid part. The level itself is `SURVIVAL_PLATFORMS` and `SURVIVAL_ENEMIES` in `index.html`, and `JUMP_SPEED` sets how high the bear jumps.

## Pausing

Press Esc or Start (or the **Pause** button) to pause. The pause menu has **Keep Playing**, **Reset Bear** (**Restart Level** in Survival) and **Main Menu**. B, Start or Esc closes it.

## Controls

| Action | Keyboard | Controller (Steam Deck, Xbox, etc.) |
| --- | --- | --- |
| Drive left / right | Arrow keys | Left stick or D-pad |
| Jump | Up arrow | A or D-pad up |
| Spawn a letter block | Space | X |
| Pause menu | Esc | Start (Menu) |
| Build mode on / off | E | Y |
| Toggle debug view | D | Select (View) |
| Reset the bear (your build stays) | R | Pause menu > Reset Bear |
| Full screen on / off | F | |

The game fills the browser window, and everything (including the buttons along the top) is drawn by Pixi on one canvas.

The bear is fenced in: walls on both sides, the ground below and a cloud ceiling above.

## Build mode

Build mode pauses physics so you can build. A yellow square marks the cursor, and the bar at the bottom shows the piece you're placing.

| Action | Keyboard | Controller | Mouse |
| --- | --- | --- | --- |
| Move the cursor | Arrow keys | Left stick or D-pad | Move the mouse |
| Place the piece, or pick up / drop the block under the cursor | Space or Enter | A | Click (drag blocks to move them) |
| Pick up / drop anything, background pieces included | G | X | Shift-drag |
| Delete | X, Delete or Backspace | B | Right-click |
| Change piece | Q / W | LB / RB | Mouse wheel, or click the bar |
| Turn a piece | Z | LT | |
| Pin / unpin a block | P | RT | |

Pieces you place are pinned, so they stay where you put them when you go back to playing. Unpinned blocks (marked with an arrow) fall and tumble like the letter blocks. Background pieces (wallpaper, door, window, lamp, plant, picture, rug) sit behind the bear, so it can drive in front of them. If a block lands on the bear, the bear is moved to the nearest free spot.

Your build is saved in the browser and comes back next time. **Clear Built Blocks** wipes it (press it twice).

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
