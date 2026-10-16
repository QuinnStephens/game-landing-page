# Escape the School

Mezzie's game. Pick one of the two girls, walk down the hallway and into Room 9, and sit in the open seat next to the only other student. The teacher announces 1000 tests and turns to write them on the chalkboard, the other student falls asleep, and the teacher's not looking... escape the school!

- **The classroom** is seen from above, like Zelda. You always get caught just before the door. Say "Sorry, sir, I'll sit back down" and you can try again, or say "I'm escaping!" to run for it.
- **The hallway chase** is side on. The teacher comes after you (he's slower than you), and the janitor is mopping between you and the hiding spots. He looks up every few seconds, with a "?" first as a warning: if you're in front of him and not hiding, he sees you. Get past him and hide in his cart, a locker, the janitor's closet or another classroom, and the teacher walks right past.
- Getting caught just sends you back to your seat to try again.

**Chapter 2: revenge.** Once you've hidden, the teacher (Mr. Richards) gives up and heads to the teachers' lounge for a break.

- Go to **Room 11** to find your best friend. Her teacher and the other kid have fallen asleep. Talk to her and she gives you the **Fart Spray**.
- Then go to the **Teachers' Lounge** at the end of the hall. Mr. Richards is getting coffee with his back to you. The other teachers take turns looking up from their coffee, with a "?" first, and if you're in the circle where they're looking, they send you back. Sneak to his chair, spray it, and sneak back out.
- He sits down, and the other teachers tell him exactly what they think: "P.U.! You stink!"

Once you've reached chapter 2, the title screen lets you start straight from it.

Plain JavaScript drawing on a `<canvas>`, no libraries. Everything is in `game.js`.

## Controls

The button pictures on screen change to match whatever you last used: keyboard, Xbox, PlayStation, Nintendo or Steam Deck.

| | Keyboard | Controller |
| --- | --- | --- |
| Walk | Arrow keys or WASD | Left stick or d-pad |
| Sit, stand up, go in, hide, talk, spray, OK | E, Enter or Space | A (bottom button) |
| Pick an answer | Up / Down | Up / down |
| Menu | Esc | Start |
| Fullscreen | F | Y (top button) on the title screen, or Fullscreen in the menu |

If the button pictures don't match your controller (Steam Input can make every controller look like an Xbox one), pick Xbox, PlayStation or Switch under "Buttons" in the menu. The menu also shows the name the browser gives the controller.

On a touch screen (or with a mouse), tap where you want to go: tap the classroom door to go in, tap the empty seat to sit, tap a hiding spot to run there and hide, and tap anywhere to come back out. In chapter 2, tap your friend to talk to her and tap Mr. Richards' chair to spray it. Tap an answer to pick it, and the button in the top corner opens the menu.

Hold Select + Start to go back to the launcher.

## Art

The characters and props are cut out of Mezzie's drawing (still black and white, to be colored in later): the two girls, the teacher (from the front, and from behind writing on the board), the janitor, both girls sitting at their desks (from behind), the sleeping student at her desk, the janitor's cart, the lockers and the classroom door. Chapter 2 adds her drawings of Room 11 (the sleeping teacher at her desk and the sleeping kid), the best friend at her desk, and the teachers in the lounge (two standing with coffee, one sitting behind the table). Each is a PNG in `assets/` and can be swapped for a colored version with the same name.

The hallway, the classrooms, the lounge (counter, Mr. Richards' chair, sofa), the Fart Spray can, the desks and the janitor's mop are drawn in code with wobbly pencil lines (the `Sketch` class in `game.js`) to match her style.

## Run locally

From the repo root:

```
python3 -m http.server
```

Then open http://localhost:8000/escape-the-school/.
