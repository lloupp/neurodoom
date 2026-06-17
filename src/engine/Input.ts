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

export class Input {
  readonly state: InputState = emptyState();
  private readonly pressed = new Set<string>();

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

  isLocked(): boolean { return this.locked; }

  /** Read & clear per-frame edge flags. Continuous flags stay live. */
  consume(): InputState {
    const out: InputState = { ...this.state };
    // Re-read movement from key set
    out.forward  = (this.pressed.has('w') || this.pressed.has('arrowup')) ? 1 : 0;
    out.backward = (this.pressed.has('s') || this.pressed.has('arrowdown')) ? 1 : 0;
    out.strafeL  = (this.pressed.has('a') || this.pressed.has('arrowleft')) ? 1 : 0;
    out.strafeR  = (this.pressed.has('d') || this.pressed.has('arrowright')) ? 1 : 0;
    out.jump  = this.pressed.has(' ');
    out.crouch = this.pressed.has('control') || this.pressed.has('shift');
    out.fire  = this.pressed.has('mouse0') || this.pressed.has('control');
    out.aim   = this.pressed.has('mouse2');
    out.inventoryToggle = this.pressed.delete('i-pressed'); // edge-triggered
    out.pause = this.pressed.delete('escape-pressed');
    out.interact = this.pressed.delete('e-pressed');
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
        if (key === 'e') this.pressed.add('e-pressed');
        if (key === 'i') this.pressed.add('i-pressed');
        if (key === 'escape') this.pressed.add('escape-pressed');
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
