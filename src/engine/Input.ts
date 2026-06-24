// Pointer-lock input layer. One instance for the whole game.

export interface InputState {
  forward: number;
  backward: number;
  strafeL: number;
  strafeR: number;
  jump: boolean;
  crouch: boolean;
  fire: boolean;
  aim: boolean;
  interact: boolean;        // 'E' pressed this frame
  use: number;              // 1..6 quick slot
  inventoryToggle: boolean; // 'I'
  pause: boolean;           // 'Esc'
  mouseDX: number;          // delta since last sample
  mouseDY: number;
}

const emptyState = (): InputState => ({
  forward: 0, backward: 0, strafeL: 0, strafeR: 0,
  jump: false, crouch: false, fire: false, aim: false,
  interact: false, use: 0, inventoryToggle: false, pause: false,
  mouseDX: 0, mouseDY: 0,
});

/** Keyboard actions a player can rebind in the options menu. Movement keys
 *  keep their arrow-key fallback regardless of the bound primary key. */
export type RemappableAction =
  | 'forward' | 'backward' | 'strafeL' | 'strafeR'
  | 'jump' | 'crouch' | 'interact' | 'inventoryToggle' | 'pause';

const EDGE_ACTIONS: readonly RemappableAction[] = ['interact', 'inventoryToggle', 'pause'];

export const DEFAULT_BINDINGS: Record<RemappableAction, string> = {
  forward: 'w', backward: 's', strafeL: 'a', strafeR: 'd',
  jump: ' ', crouch: 'control', interact: 'e', inventoryToggle: 'i', pause: 'escape',
};

const BINDINGS_KEY = 'neurodoom:keybindings';

function loadBindings(): Record<RemappableAction, string> {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (raw) return { ...DEFAULT_BINDINGS, ...JSON.parse(raw) };
  } catch {
    // ignore corrupt/unavailable storage
  }
  return { ...DEFAULT_BINDINGS };
}

export class Input {
  readonly state: InputState = emptyState();
  private readonly pressed = new Set<string>();
  private keyBindings: Record<RemappableAction, string> = loadBindings();

  private readonly domTarget: HTMLElement;
  private locked = false;
  private listeners: Array<() => void> = [];

  constructor(target: HTMLElement) {
    this.domTarget = target;
    this.attach();
  }

  requestPointerLock(): void {
    if (document.pointerLockElement !== this.domTarget) {
      this.domTarget.requestPointerLock?.();
    }
  }

  /** Releases pointer lock so mouse events target visible elements again (e.g. panel buttons). */
  exitPointerLock(): void {
    if (document.pointerLockElement === this.domTarget) {
      document.exitPointerLock?.();
    }
  }

  isLocked(): boolean { return this.locked; }

  getBindings(): Record<RemappableAction, string> { return { ...this.keyBindings }; }

  setBinding(action: RemappableAction, key: string): void {
    this.keyBindings[action] = key.toLowerCase();
    try { localStorage.setItem(BINDINGS_KEY, JSON.stringify(this.keyBindings)); } catch { /* best-effort */ }
  }

  resetBindings(): void {
    this.keyBindings = { ...DEFAULT_BINDINGS };
    try { localStorage.setItem(BINDINGS_KEY, JSON.stringify(this.keyBindings)); } catch { /* best-effort */ }
  }

  /** Read & clear per-frame edge flags. Continuous flags stay live. */
  consume(): InputState {
    const out: InputState = { ...this.state };
    const b = this.keyBindings;
    // Re-read movement from key set
    out.forward  = (this.pressed.has(b.forward) || this.pressed.has('arrowup')) ? 1 : 0;
    out.backward = (this.pressed.has(b.backward) || this.pressed.has('arrowdown')) ? 1 : 0;
    out.strafeL  = (this.pressed.has(b.strafeL) || this.pressed.has('arrowleft')) ? 1 : 0;
    out.strafeR  = (this.pressed.has(b.strafeR) || this.pressed.has('arrowright')) ? 1 : 0;
    out.jump  = this.pressed.has(b.jump);
    out.crouch = this.pressed.has(b.crouch) || this.pressed.has('shift');
    out.fire  = this.pressed.has('mouse0') || this.pressed.has('control');
    out.aim   = this.pressed.has('mouse2');
    out.inventoryToggle = this.pressed.delete(`${b.inventoryToggle}-pressed`);
    out.pause = this.pressed.delete(`${b.pause}-pressed`);
    out.interact = this.pressed.delete(`${b.interact}-pressed`);
    for (let i = 1; i <= 6; i++) {
      const k = `digit${i}-pressed`;
      if (this.pressed.delete(k)) out.use = i;
    }
    return out;
  }

  private attach(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!this.pressed.has(key)) {
        for (const action of EDGE_ACTIONS) {
          if (this.keyBindings[action] === key) this.pressed.add(`${key}-pressed`);
        }
      }
      if (/^[1-6]$/.test(e.key)) this.pressed.add(`digit${e.key}-pressed`);
      this.pressed.add(key);
      // Prevent unintended browser scroll on game keys
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      this.pressed.delete(key);
    };

    const onMouseDown = (e: MouseEvent) => {
      this.pressed.add(`mouse${e.button}`);
    };

    const onMouseUp = (e: MouseEvent) => {
      this.pressed.delete(`mouse${e.button}`);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.locked) return;
      this.state.mouseDX += e.movementX;
      this.state.mouseDY += e.movementY;
    };

    const onLockChange = () => {
      this.locked = document.pointerLockElement === this.domTarget;
    };

    const preventContext = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    this.domTarget.addEventListener('contextmenu', preventContext);

    this.listeners.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => window.removeEventListener('mousedown', onMouseDown),
      () => window.removeEventListener('mouseup', onMouseUp),
      () => window.removeEventListener('mousemove', onMouseMove),
      () => document.removeEventListener('pointerlockchange', onLockChange),
      () => this.domTarget.removeEventListener('contextmenu', preventContext),
    );
  }

  /** Recompute mouse deltas back to 0 each frame. */
  resetMouseDelta(): void {
    this.state.mouseDX = 0;
    this.state.mouseDY = 0;
  }

  dispose(): void {
    for (const off of this.listeners) off();
    this.listeners = [];
  }
}
