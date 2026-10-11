# Jojo Finds Momo

Walk Jojo around the jungle and find all the Momo monkeys before the clock runs out. Each Momo you find follows you in a line; find them all to start a bigger jungle with more Momos. Each level gives you 20 seconds per Momo (2:00 for the first level's six). If time runs out, Jojo walks up to you holding a sign that says "oh well, too bad", and you can try the level again.

Built with plain JavaScript and [PixiJS](https://pixijs.com) loaded from the jsDelivr CDN.

Art is from the title screen drawing (`assets/`), with Jojo and Momo cut out of it. The sign (`assets/sign.png`) is a placeholder in the same marker style; swap in Violeta's drawing with the same name to replace it (the board should fill the top 70% of the picture, with the stick below).

## Play

- Keyboard: arrow keys or WASD. `M` toggles sound.
- Controller (Steam Deck, Xbox, PlayStation): left stick or d-pad to walk, A or Start to begin, continue and try again, Y toggles sound.
- Touch or mouse: hold your finger anywhere and Jojo walks toward it.
- The clock under the Momo counter shows how much time is left. It turns red for the last 10 seconds.

## Run locally

It's a static site with no build step:

```
python3 -m http.server
```

Then open http://localhost:8000. Cloudflare Pages serves the repo root as-is (no build command, output directory `/`).
