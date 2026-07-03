// On-screen touch controls for mobile / Android (Capacitor WebView).
// Feeds the shared Input instance: left virtual stick = movement,
// drag anywhere else = look (yaw), plus FIRE / E / JUMP / PAUSE buttons.
// Auto-shows only during active gameplay (HUD visible, no panel open).

import type { Input } from './Input';

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
}

const STYLE_ID = 'touch-controls-style';
const CSS = `
#touch-controls { position: absolute; inset: 0; z-index: 15; pointer-events: none;
  touch-action: none; -webkit-user-select: none; user-select: none; }
#touch-controls[hidden] { display: none; }
#touch-controls .tc-look { position: absolute; inset: 0; pointer-events: auto; touch-action: none; }
#touch-controls .tc-stick { position: absolute; left: 4vw; bottom: 5vh; width: 34vw; max-width: 190px;
  aspect-ratio: 1; border-radius: 50%; pointer-events: auto; touch-action: none;
  background: rgba(75,227,255,0.06); border: 1px solid rgba(75,227,255,0.35); }
#touch-controls .tc-knob { position: absolute; left: 50%; top: 50%; width: 42%; aspect-ratio: 1;
  border-radius: 50%; transform: translate(-50%,-50%);
  background: rgba(75,227,255,0.22); border: 1px solid rgba(75,227,255,0.6);
  box-shadow: 0 0 16px rgba(75,227,255,0.35); }
#touch-controls .tc-btn { position: absolute; pointer-events: auto; touch-action: none;
  display: flex; align-items: center; justify-content: center; border-radius: 50%;
  font: 600 clamp(13px,3.4vw,20px)/1 system-ui, sans-serif; letter-spacing: 0.05em; color: #cfefff;
  background: rgba(75,227,255,0.08); border: 1px solid rgba(75,227,255,0.4); }
#touch-controls .tc-btn.tc-active { background: rgba(75,227,255,0.4); color: #050608; }
#touch-controls .tc-fire { right: 5vw; bottom: 6vh; width: 24vw; max-width: 132px; aspect-ratio: 1;
  font-size: clamp(15px,3.8vw,22px); }
#touch-controls .tc-e     { right: 30vw; bottom: 7vh; width: 15vw; max-width: 82px; aspect-ratio: 1; }
#touch-controls .tc-jump  { right: 5vw; bottom: 26vh; width: 15vw; max-width: 82px; aspect-ratio: 1; }
#touch-controls .tc-pause { right: 3vw; top: 3vh; width: 12vw; max-width: 56px; aspect-ratio: 1; font-size: 18px; }
`;

/** Sensitivity of drag-to-look, in "mouse pixels" per screen pixel dragged. */
const LOOK_SCALE = 1.4;

/** setPointerCapture can throw on some WebViews / synthetic pointers — never let it break input. */
function capture(el: Element, id: number): void {
  try { el.setPointerCapture?.(id); } catch { /* non-fatal */ }
}

interface ButtonSpec {
  cls: string;
  label: string;
  onDown: () => void;
  onUp?: () => void;
}

export class TouchControls {
  private readonly root: HTMLElement;
  private readonly input: Input;
  private readonly hud: HTMLElement;
  private readonly container: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly observer: MutationObserver;
  private stickPointer: number | null = null;
  private lookPointer: number | null = null;
  private lookX = 0;
  private lookY = 0;
  private stickRadius = 60;

  constructor(root: HTMLElement, input: Input, hud: HTMLElement) {
    this.root = root;
    this.input = input;
    this.hud = hud;

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    this.container = document.createElement('div');
    this.container.id = 'touch-controls';
    this.container.hidden = true;

    // Look surface sits behind the stick/buttons so drags on empty space turn the view.
    const look = document.createElement('div');
    look.className = 'tc-look';
    this.container.appendChild(look);

    const stick = document.createElement('div');
    stick.className = 'tc-stick';
    this.knob = document.createElement('div');
    this.knob.className = 'tc-knob';
    stick.appendChild(this.knob);
    this.container.appendChild(stick);

    const buttons: ButtonSpec[] = [
      { cls: 'tc-fire', label: 'FIRE', onDown: () => this.input.setTouchFire(true), onUp: () => this.input.setTouchFire(false) },
      { cls: 'tc-e', label: 'E', onDown: () => this.input.touchInteract() },
      { cls: 'tc-jump', label: 'JMP', onDown: () => this.input.setTouchJump(true), onUp: () => this.input.setTouchJump(false) },
      { cls: 'tc-pause', label: '☰', onDown: () => this.input.touchPause() },
    ];
    for (const spec of buttons) this.container.appendChild(this.makeButton(spec));

    root.appendChild(this.container);

    this.bindLook(look);
    this.bindStick(stick);

    // Show only while playing: HUD visible and no panel/overlay on top.
    this.observer = new MutationObserver(() => this.refreshVisibility());
    this.observer.observe(root, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
    this.refreshVisibility();
  }

  private refreshVisibility(): void {
    const overlayOpen = this.root.querySelector('.panel:not([hidden])');
    const visible = !this.hud.hidden && !overlayOpen;
    if (this.container.hidden === visible) this.container.hidden = !visible;
    if (!visible) this.resetStick();
  }

  private makeButton(spec: ButtonSpec): HTMLElement {
    const btn = document.createElement('div');
    btn.className = `tc-btn ${spec.cls}`;
    btn.textContent = spec.label;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('tc-active');
      spec.onDown();
      capture(btn, e.pointerId);
    });
    const release = () => {
      btn.classList.remove('tc-active');
      spec.onUp?.();
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    return btn;
  }

  private bindLook(look: HTMLElement): void {
    look.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.lookPointer = e.pointerId;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
      capture(look, e.pointerId);
    });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointer) return;
      this.input.addLook((e.clientX - this.lookX) * LOOK_SCALE, (e.clientY - this.lookY) * LOOK_SCALE);
      this.lookX = e.clientX;
      this.lookY = e.clientY;
    });
    const end = (e: PointerEvent) => { if (e.pointerId === this.lookPointer) this.lookPointer = null; };
    look.addEventListener('pointerup', end);
    look.addEventListener('pointercancel', end);
  }

  private bindStick(stick: HTMLElement): void {
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.stickPointer = e.pointerId;
      this.stickRadius = stick.getBoundingClientRect().width / 2;
      capture(stick, e.pointerId);
      this.updateStick(stick, e);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointer) return;
      this.updateStick(stick, e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.resetStick();
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }

  private updateStick(stick: HTMLElement, e: PointerEvent): void {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(dist, this.stickRadius);
    dx = (dx / dist) * clamped;
    dy = (dy / dist) * clamped;
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    // Normalize to -1..1; screen-up (negative dy) drives forward.
    this.input.setTouchMove(dx / this.stickRadius, -dy / this.stickRadius);
  }

  private resetStick(): void {
    this.knob.style.transform = 'translate(-50%,-50%)';
    this.input.setTouchMove(0, 0);
  }

  dispose(): void {
    this.observer.disconnect();
    this.container.remove();
  }
}
