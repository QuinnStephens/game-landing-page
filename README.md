# Jojo Finds Momo

Walk Jojo around the jungle and find all the Momo monkeys. Each Momo you find follows you in a line; find them all to start a bigger jungle with more Momos.

Built with plain JavaScript and [PixiJS](https://pixijs.com) loaded from the jsDelivr CDN.

Art is from the title screen drawing (`assets/`), with Jojo and Momo cut out of it.

## Play

- Keyboard: arrow keys or WASD. `M` toggles sound.
- Touch or mouse: hold your finger anywhere and Jojo walks toward it.
- Yellow arrows at the screen edge point toward Momos you haven't found yet.

## Run locally

It's a static site with no build step:

```
python3 -m http.server
```

Then open http://localhost:8000. Cloudflare Pages serves the repo root as-is (no build command, output directory `/`).
