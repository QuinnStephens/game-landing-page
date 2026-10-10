// Every game loads this with <script src="../back-to-launcher.js"></script>.
// Hold Select + Start (Share + Options on a PS4 pad) for 1 second to return to the launcher.
// Escape also returns to the launcher, unless the script tag has data-no-escape
// (for games that use Escape themselves, like My Kingdom's pause menu).
(() => {
  const LAUNCHER_URL = '/';
  const HOLD_MS = 1000;
  const useEscape = !document.currentScript?.hasAttribute('data-no-escape');
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
  if (useEscape) addEventListener('keydown', (e) => { if (e.key === 'Escape') location.href = LAUNCHER_URL; });
})();
