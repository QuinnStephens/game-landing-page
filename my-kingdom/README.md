# yetz-game

A Pixi + Matter.js physics game. It's a single static `index.html` with assets in `public/`, so there's no build step.

## Main menu

The game starts on the hand-drawn main menu. Pick a button with the arrow keys, the D-pad or the left stick (or the mouse), and press Enter, Space or A (or click). The selected button glows. **Explore** and **Survival** open the character creator first; **Creative** opens the town (see below).

The menu art lives in `public/img/menu/`: `background.jpg` and one PNG per button, cut from the layers of the original drawing, plus a `-glow.png` for each button's highlight. Button positions in `index.html` (`MENU_BUTTONS`) are the layer positions in that 2224x1668 drawing.

## Creative

A dollhouse-style town, like Avatar World, at `creative/` (its own page, `creative/game.js`, plain canvas with no libraries). The town shows six places from Violeta's drawings: Home, Park, Restaurant, Library, School and Zoo. Pick one to go inside, then look around (drag the floor or wall, use the mouse wheel, or push the hand against the side of the screen) and move everything around. The teacher, the zookeeper and the waiter always live at the school, the zoo and the restaurant: you can move them but not put them away. **+ Add** opens a drawer of toys (phone, book, teddy bear, doll, block, dollhouse) and furniture (baby bed, big kid bed, chair, fridge, table and chairs, baby swing, toilet); drag one out, or drag anything onto **Put away** to take it out. Everything is remembered in the browser, and the pause menu can start a place over.

The park has swings, a slide and a ball pit. Drop any character, or the teacher, zookeeper or waiter, on the swings and they swing (two seats; the baby swing at home has one). Only babies go on the slide: drop a baby on it and they climb up, slide down and land in the nearest ball pit. Drop a baby straight in the ball pit too. Anyone else dropped on the slide gets told it's just for babies. Pick a rider up to take them off.

The pause menu also has **Make a character** (the same as **New** in the People drawer) and **Buttons**, which picks which controller's buttons are shown: Automatic (from the controller), Xbox, PlayStation, Switch or Steam Deck. That helps when Steam hides what the controller really is. With a controller or the keyboard, the on-screen buttons show the button to press, and moving past the end of a drawer goes on to the next drawer.

The **People** drawer has your own characters. **New** opens the same hand-drawn character creator as Explore (bear or human, skin, hair, shirts and pants), plus **Big** or **Baby** in the empty top-left corner (placeholder figures until she draws them). Press the **Creative** button in the bottom right (or Start on a controller) to finish, and the character goes into the place you're in. Every character you make stays in the People drawer, so you can put them in any place, as many times as you like. Babies have the same big head on a small body; baby bears are small bears. The creator starts from your Explore character.

| Action | Keyboard | Controller | Mouse / touch |
| --- | --- | --- | --- |
| Move the hand / pick a place | Arrow keys or WASD | Left stick or D-pad | |
| Go inside, pick up, put down | Space, Enter or E | A (B on Nintendo) | Click / tap, drag |
| Open the drawer | T | Y (X on Nintendo) | **+ Add** |
| Put away | X or Delete | X (Y on Nintendo) | Drag onto **Put away** |
| Turn a thing around | R | RT | |
| Switch drawer tab | Q / Tab | LB / RB | Tap the tab |
| Finish a new character | Space on **Creative** | Start, or A on **Creative** | Tap **Creative** |
| Back to the town / main menu | Backspace or B | B (A on Nintendo) | **← Town** / **Menu** |
| Pause | Esc | Start | |
| Full screen | F | | The corner button |

Button prompts follow whatever you last used, including Switch Pro, PlayStation and Steam Deck button names.

Her drawings are cut out of the notebook photos by `tools/cut_creative_art.py` (`python3 tools/cut_creative_art.py <folder of photos>`; it needs numpy, scipy and Pillow) into `public/img/creative/`, each on a white paper "sticker" so light pencil shows up. The box each piece is cut from is listed at the top of the script. The insides of the places (walls, floors, windows, the blackboard, the zoo's fences and so on) are placeholders painted in code to look like her pencil and crayon (`PAINTERS` in `creative/game.js`), ready to be swapped for her drawings. What each place starts with is `PLACES` there, and how big each thing is, and which drawer it's in, is `THINGS`.

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

A platformer level cut from the hand-drawn survival design: purple scribbles, black-outlined platforms and little blue blobs that patrol back and forth. You drive the same way as in Explore, but there's no build mode and no letter blocks, and you can only jump from something solid (Space jumps too). Run into a blob with the car (or land on it) to squish it. Every few seconds a blob crouches and hops; if one bonks your character instead of the car, it's back to the start, since you only get one hit. Reach the big star at the end for a burst of sparkles, and the level starts over a few seconds later.

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
