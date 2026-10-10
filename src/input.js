// Keyboard + Gamepad API, merged into one simple state each frame.
// Steam Deck / Xbox layout: A or B jump, X / Y / right trigger run,
// Start toggles fullscreen, Select (View) restarts.

const keys = new Set();
const pressedKeys = new Set();

const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyK'],
  run: ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ'],
  start: ['KeyF'],
  back: ['KeyR'],
  confirm: ['Enter', 'Space', 'KeyZ'],
};

window.addEventListener('keydown', (e) => {
  if (!keys.has(e.code)) pressedKeys.add(e.code);
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const prevPad = {};

export const input = {
  left: false, right: false, down: false, jump: false, run: false,
  jumpPressed: false, startPressed: false, backPressed: false, confirmPressed: false,
  usingPad: false,

  poll() {
    const k = (name) => KEYMAP[name].some((c) => keys.has(c));
    const kp = (name) => KEYMAP[name].some((c) => pressedKeys.has(c));
    let left = k('left'), right = k('right'), down = k('down'), jump = k('jump'), run = k('run');
    let jumpPressed = kp('jump'), startPressed = kp('start'), backPressed = kp('back'), confirmPressed = kp('confirm');
    if (pressedKeys.size) this.usingPad = false;
    pressedKeys.clear();

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const b = (i) => !!(pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5));
      const prev = prevPad[pad.index] || {};
      const now = {};
      for (let i = 0; i < pad.buttons.length; i++) now[i] = b(i);
      const edge = (i) => now[i] && !prev[i];
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;

      const padLeft = ax < -0.35 || now[14];
      const padRight = ax > 0.35 || now[15];
      left ||= padLeft;
      right ||= padRight;
      down ||= ay > 0.5 || now[13];
      jump ||= now[0] || now[1];
      run ||= now[2] || now[3] || now[7];
      jumpPressed ||= edge(0) || edge(1);
      confirmPressed ||= edge(0) || edge(1);
      startPressed ||= edge(9);
      backPressed ||= edge(8);
      if (Object.values(now).some(Boolean) || padLeft || padRight) this.usingPad = true;
      prevPad[pad.index] = now;
    }

    Object.assign(this, { left, right, down, jump, run, jumpPressed, startPressed, backPressed, confirmPressed });
  },
};
