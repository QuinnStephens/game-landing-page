// Paste into each game (or load with <script src="...">).
// Hold Select + Start (Share + Options on a PS4 pad) for 1 second to return to the launcher.
(() => {
  const LAUNCHER_URL = 'https://YOUR-LAUNCHER.pages.dev/'; // <- change this
  const HOLD_MS = 1000;
  let since = null;

  function tick(now) {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const combo = pads.some((p) => p.buttons[8]?.pressed && p.buttons[9]?.pressed);
    if (combo) {
      since = since ?? now;
      if (now - since >= HOLD_MS) { location.href = LAUNCHER_URL; return; }
    } else {
      since = null;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Keyboard fallback for desktop testing: Escape
  addEventListener('keydown', (e) => { if (e.key === 'Escape') location.href = LAUNCHER_URL; });
})();
