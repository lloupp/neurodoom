// FX — the game-feel layer: screen shake, damage/muzzle flashes, cinematic
// zone banners, hitmarkers, low-HP vignette, and the boss health bar.
// Pure DOM/CSS overlays + a per-frame transform on the render canvases;
// no coupling to the raycaster. All motion respects the reduce-motion setting.

const STYLE_ID = 'fx-style';
const CSS = `
#fx-flash { position: absolute; inset: 0; z-index: 8; pointer-events: none; opacity: 0; }
#fx-damage { position: absolute; inset: 0; z-index: 9; pointer-events: none; opacity: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(255,24,48,0.55) 100%); }
#fx-hitmarker { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; z-index: 11;
  transform: translate(-50%,-50%) rotate(45deg); pointer-events: none; opacity: 0; }
#fx-hitmarker::before, #fx-hitmarker::after { content: ''; position: absolute; background: #cfefff; }
#fx-hitmarker::before { left: 50%; top: 0; width: 2px; height: 100%; margin-left: -1px; }
#fx-hitmarker::after { top: 50%; left: 0; height: 2px; width: 100%; margin-top: -1px; }
#fx-hitmarker.show { opacity: 0.9; }
#fx-hitmarker.kill::before, #fx-hitmarker.kill::after { background: #ff2d55; box-shadow: 0 0 8px #ff2d55; }
#fx-banner { position: absolute; left: 0; right: 0; top: 22%; z-index: 12; text-align: center;
  pointer-events: none; opacity: 0; transition: opacity 0.5s ease, letter-spacing 0.6s ease; }
#fx-banner .fx-banner-title { font: 700 clamp(22px, 4.2vw, 44px)/1.1 ui-monospace, monospace;
  color: #cfefff; letter-spacing: 0.55em; text-transform: uppercase;
  text-shadow: 0 0 18px rgba(75,227,255,0.8), 0 0 4px rgba(75,227,255,0.9); }
#fx-banner .fx-banner-sub { font: 400 clamp(11px, 1.6vw, 15px)/1.4 ui-monospace, monospace;
  color: rgba(207,239,255,0.65); letter-spacing: 0.3em; text-transform: uppercase; margin-top: 8px; }
#fx-banner.show { opacity: 1; letter-spacing: 0.02em; }
#fx-banner.boss .fx-banner-title { color: #ff2d55;
  text-shadow: 0 0 22px rgba(255,45,85,0.9), 0 0 5px rgba(255,45,85,0.9); }
#fx-bossbar { position: absolute; left: 50%; top: 16%; transform: translateX(-50%); z-index: 11;
  width: min(46vw, 520px); pointer-events: none; opacity: 0; transition: opacity 0.4s ease; }
#fx-bossbar.show { opacity: 1; }
#fx-bossbar .fx-boss-name { font: 700 12px/1 ui-monospace, monospace; color: #ff2d55;
  letter-spacing: 0.4em; text-transform: uppercase; text-align: center; margin-bottom: 5px;
  text-shadow: 0 0 10px rgba(255,45,85,0.8); }
#fx-bossbar .fx-boss-track { height: 7px; border: 1px solid rgba(255,45,85,0.7);
  background: rgba(20,2,8,0.6); }
#fx-bossbar .fx-boss-fill { height: 100%; width: 100%; background: linear-gradient(90deg, #ff2d55, #ff7a45);
  box-shadow: 0 0 12px rgba(255,45,85,0.7); transition: width 0.15s linear; }
`;

export class FXSystem {
  private readonly canvases: HTMLCanvasElement[];
  private readonly flashEl: HTMLElement;
  private readonly damageEl: HTMLElement;
  private readonly hitEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly bannerTitle: HTMLElement;
  private readonly bannerSub: HTMLElement;
  private readonly bossEl: HTMLElement;
  private readonly bossName: HTMLElement;
  private readonly bossFill: HTMLElement;

  private reduceMotion = false;
  private time = 0;
  private shakeAmp = 0;
  private flashAlpha = 0;
  private damagePulseAlpha = 0;
  private lowHpFrac = 1;
  private hitTimer: ReturnType<typeof setTimeout> | null = null;
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: HTMLElement, canvases: HTMLCanvasElement[]) {
    this.canvases = canvases;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    const el = (id: string): HTMLElement => {
      const d = document.createElement('div');
      d.id = id;
      root.appendChild(d);
      return d;
    };
    this.flashEl = el('fx-flash');
    this.damageEl = el('fx-damage');
    this.hitEl = el('fx-hitmarker');
    this.bannerEl = el('fx-banner');
    this.bannerTitle = document.createElement('div');
    this.bannerTitle.className = 'fx-banner-title';
    this.bannerSub = document.createElement('div');
    this.bannerSub.className = 'fx-banner-sub';
    this.bannerEl.append(this.bannerTitle, this.bannerSub);
    this.bossEl = el('fx-bossbar');
    this.bossName = document.createElement('div');
    this.bossName.className = 'fx-boss-name';
    const track = document.createElement('div');
    track.className = 'fx-boss-track';
    this.bossFill = document.createElement('div');
    this.bossFill.className = 'fx-boss-fill';
    track.appendChild(this.bossFill);
    this.bossEl.append(this.bossName, track);
  }

  setReduceMotion(v: boolean): void { this.reduceMotion = v; }

  /** Kick the camera. 0..1; decays exponentially. */
  shake(intensity: number): void {
    this.shakeAmp = Math.min(1.2, Math.max(this.shakeAmp, intensity));
  }

  /** Fullscreen color pop (muzzle, explosion, boss death). */
  flash(color: string, peak = 0.4): void {
    this.flashEl.style.background = color;
    this.flashAlpha = Math.max(this.flashAlpha, peak);
  }

  /** Red edge pulse when the player takes a hit. */
  damagePulse(strength: number): void {
    this.damagePulseAlpha = Math.min(1, Math.max(this.damagePulseAlpha, 0.35 + strength * 0.6));
  }

  /** Persistent heartbeat vignette driver; pass hp/maxHp every tick. */
  setLowHp(frac: number): void { this.lowHpFrac = frac; }

  /** Crosshair hit-confirm; red + glow on a killing blow. */
  hitmarker(kill: boolean): void {
    this.hitEl.classList.toggle('kill', kill);
    this.hitEl.classList.add('show');
    if (this.hitTimer) clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => this.hitEl.classList.remove('show'), kill ? 220 : 120);
  }

  /** Cinematic location/boss title card. */
  banner(title: string, sub = '', boss = false): void {
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub;
    this.bannerSub.hidden = !sub;
    this.bannerEl.classList.toggle('boss', boss);
    // Restart the entrance animation even if a banner is already up.
    this.bannerEl.classList.remove('show');
    if (this.reduceMotion) this.bannerEl.style.transition = 'opacity 0.4s ease';
    else this.bannerEl.style.transition = '';
    void this.bannerEl.offsetWidth; // reflow so the transition re-triggers
    this.bannerEl.classList.add('show');
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.bannerEl.classList.remove('show'), boss ? 3200 : 2400);
  }

  /** Show/update the boss health bar; pass null to hide it. */
  bossBar(frac: number | null, name = 'THE WARDEN'): void {
    if (frac === null) {
      this.bossEl.classList.remove('show');
      return;
    }
    this.bossName.textContent = name;
    this.bossFill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    this.bossEl.classList.add('show');
  }

  /** Per-render-frame integration: shake transform + flash/vignette decay. */
  update(dt: number): void {
    this.time += dt;

    // Shake: random jitter scaled by decaying amplitude.
    this.shakeAmp *= Math.exp(-dt * 6.5);
    if (this.shakeAmp < 0.004) this.shakeAmp = 0;
    const motion = this.reduceMotion ? 0.25 : 1;
    const amp = this.shakeAmp * 13 * motion;
    const dx = (Math.random() * 2 - 1) * amp;
    const dy = (Math.random() * 2 - 1) * amp;
    const transform = amp > 0 ? `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` : '';
    for (const c of this.canvases) c.style.transform = transform;

    // Fullscreen flash decay
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.6);
    this.flashEl.style.opacity = this.flashAlpha > 0.01 ? this.flashAlpha.toFixed(3) : '0';

    // Damage vignette: instantaneous pulse + low-HP heartbeat floor
    this.damagePulseAlpha = Math.max(0, this.damagePulseAlpha - dt * 1.8);
    let lowHp = 0;
    if (this.lowHpFrac < 0.3) {
      const severity = 1 - this.lowHpFrac / 0.3;
      const beat = this.reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 5.5);
      lowHp = severity * (0.18 + 0.22 * beat);
    }
    const a = Math.max(this.damagePulseAlpha, lowHp);
    this.damageEl.style.opacity = a > 0.01 ? a.toFixed(3) : '0';
  }
}
