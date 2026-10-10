# Photo Taker

Pick a boy (with his brown dog) or a girl (with her pink rabbit) and walk around taking pictures. Fill up the Photo Book by photographing everything: Mom, Dad, trees, flowers, the sun, the clouds, Cool World, the shops... and the bears.

- **Sleeping bears** wake up if you take their picture, and chase you. You can't jump, but you can outrun them: hold run and the bear gets tired, stops to huff and puff, then goes back to sleep. If it catches you, you fall over and it walks home.
- **Mom and Dad** stand near the start. Walk up to them to talk.
- **The Fancy Shop and the Cool Shop** give away clothes for free: hats, glasses, capes, a balloon and more. Pick one to put it on, and see it on your kid in the game. "My clothes" in the menu lets you change outfits any time.
- Photos, clothes and the Photo Book are saved in the browser.

Plain JavaScript drawing on a `<canvas>`, no libraries. Everything is in `game.js`.

## Controls

The button pictures on screen change to match whatever you last used: keyboard, Xbox, PlayStation, Nintendo or Steam Deck.

| | Keyboard | Controller |
| --- | --- | --- |
| Walk | Arrow keys or A / D | Left stick or d-pad |
| Run | Hold Shift | Hold B (right button) |
| Take a picture | Space | X (left button) or right trigger |
| Point the camera at the sky | Hold Up | Hold up |
| Talk / go in / read | E or Enter | A (bottom button) |
| Photos | Q | Y (top button) |
| Menu | Esc | Start |
| Fullscreen | F | Y on the title screen, or Fullscreen in the menu |

Hold Select + Start to go back to the launcher.

## Art

All the art is cut out of Violeta's drawings: the title screen, the kids and pets, Mom and Dad, the bear, the two shops, Cool World, the bear sign, trees, flowers, the sun, clouds and the ground. The sleeping and tired bear faces are drawn in code over a copy of the bear with its face painted out.

The clothes are placeholders drawn in code (`ITEMS` in `game.js`) until she draws them. Each item says which spot it goes on (`head`, `ears`, `face`, `neck`, `back`, `hand`) and how big it is next to the kid's head, and `KIDS` says where those spots are on each kid's drawing.

## Run locally

From the repo root:

```
python3 -m http.server
```

Then open http://localhost:8000/photo-taker/.
