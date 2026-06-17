/**
 * GameShell — the main loop.
 *
 * Strategy: Fixed-timestep simulation with render decoupling.
 *   - update() is called at exactly 60Hz (configurable).
 *   - render() may be called at any FPS the browser delivers (RAF).
 *   - Accumulator pattern: drop excess time, never spiral-of-death.
 *
 * Why this pattern: deterministic simulation, smooth animation.
 * DDA raycasting needs predictable dt or it glitches on tab refocus.
 */

export interface ShellConfig {
  readonly fixedHz?: number;       // default 60
  readonly maxFrameMs?: number;    // safe frame cap (default 250ms)
  readonly canvas: HTMLCanvasElement | null;
}

export interface ShellHooks {
  /** Called every fixed-timestep tick. Must be deterministic in dt. */
  update(dt: number, time: number): void;
  /** Called every RAF, after updates have caught up. */
  render(alpha: number, time: number): void;
  /** Fired when the tab becomes visible again, with the missed time. */
  resume?(skippedMs: number): void;
}

export class GameShell {
  private readonly fixedDt: number;
  private readonly maxFrameMs: number;
  private rafHandle = 0;
  private lastTs = 0;
  private acc = 0;
  private simTime = 0;
  private running = false;
  private paused = false;
  private hooks: ShellHooks | null = null;
  private cleanup: Array<() => void> = [];

  constructor(cfg: ShellConfig) {
    this.fixedDt = 1000 / (cfg.fixedHz ?? 60);
    this.maxFrameMs = cfg.maxFrameMs ?? 250;
    this.attachVisibility();
  }

  start(hooks: ShellHooks): void {
    this.hooks = hooks;
    this.running = true;
    this.lastTs = performance.now();
    this.rafHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = 0;
  }

  dispose(): void {
    this.stop();
    for (const off of this.cleanup) off();
    this.cleanup = [];
  }

  setPaused(p: boolean): void { this.paused = p; }

  /** A game tick — fixed-timestep with accumulator + RAF render. */
  private tick = (ts: number): void => {
    if (!this.running || !this.hooks) return;
    let frameMs = ts - this.lastTs;
    this.lastTs = ts;
    if (frameMs > this.maxFrameMs) {
      // Long pause (tab switch). Skip sim, drain accumulated time.
      this.hooks.resume?.(frameMs - this.fixedDt);
      frameMs = this.fixedDt;
    }
    if (!this.paused) {
      this.acc += frameMs;
      // Cap accumulator so we don't replay the world on a long pause
      if (this.acc > this.maxFrameMs) this.acc = this.maxFrameMs;
      while (this.acc >= this.fixedDt) {
        this.hooks.update(this.fixedDt / 1000, this.simTime);
        this.simTime += this.fixedDt / 1000;
        this.acc -= this.fixedDt;
      }
      // alpha = interpolation factor for render between fixed steps
      this.hooks.render(this.acc / this.fixedDt, ts / 1000);
    }
    this.rafHandle = requestAnimationFrame(this.tick);
  };

  private attachVisibility(): void {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        // Reset base so we don't dump accumulated dt on the first frame
        this.lastTs = performance.now();
        this.acc = 0;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    this.cleanup.push(() => document.removeEventListener('visibilitychange', onVis));
  }
}
