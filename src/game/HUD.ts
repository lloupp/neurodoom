/**
 * HUD — wires the DOM HUD into game state. Idempotent; can subscribe/unsubscribe.
 *
 * Strategy: listen for player snapshots from a fixed interval (every 33ms = 30fps
 * HUD refresh) instead of every game tick. The game loop runs 60Hz; the HUD
 * doesn't need that fidelity and the DOM is happiest at 30Hz.
 */

import type { PlayerSnapshot, WeaponId } from './Player';
import type { EnemySnapshot } from './Enemy';
import type { TerminalState } from './Terminal';
import { renderInventory } from './Inventory';
import type { RemappableAction } from '../engine/Input';
import type { Difficulty, GameSettings } from '../engine/Settings';

export interface HUDRefs {
  hud: HTMLElement;
  boot: HTMLElement;
  dead: HTMLElement;
  win: HTMLElement;
  prompt: HTMLElement;
  panelTerminal: HTMLElement;
  panelHack: HTMLElement;
  panelLogs: HTMLElement;
  panelInventory: HTMLElement;
  panelMenu: HTMLElement;
}

export interface HUDState {
  player: PlayerSnapshot | null;
  enemies: EnemySnapshot[];
  terminal: TerminalState | null;
  objective: string;
  room: string;
  tip: string;
  currentPanel: null | 'terminal' | 'hack' | 'logs' | 'inventory' | 'menu';
  ammo: { name: string; clip: number; reserve: number };
  weaponName: string;
  hackState?: ReturnType<typeof import('./Hacking').startHack>;
}

export class HUD {
  private lastPlayerTick = 0;
  private accum = 0;
  private currentPanel: HUDState['currentPanel'] = null;
  onSelectWeapon?: (id: WeaponId) => void;
  onReorderInventory?: (from: number, to: number) => void;
  onSetVolume?: (cat: 'master' | 'sfx' | 'voice' | 'ambient' | 'music', v: number) => void;
  onSetSensitivity?: (v: number) => void;
  onSetDifficulty?: (d: Difficulty) => void;
  onSetReduceMotion?: (v: boolean) => void;
  onRebindKey?: (action: RemappableAction, key: string) => void;
  onResume?: () => void;
  onMainMenu?: () => void;
  onExportSave?: () => void;
  onImportSave?: (file: File) => void;
  private dragFromSlot: number | null = null;
  private rebindArming: RemappableAction | null = null;
  private state: HUDState = {
    player: null,
    enemies: [],
    terminal: null,
    objective: 'Plug in. Jack out. Don\u2019t be seen.',
    room: '— Facility Sublevel 3 —',
    tip: 'Tip: terminals are loud. Guards hear.',
    currentPanel: null,
    ammo: { name: '—', clip: 0, reserve: 0 },
    weaponName: '— unarmed —',
  };

  constructor(private readonly refs: HUDRefs) {
    this.attachUI();
    void this.lastPlayerTick;
  }

  setState(s: Partial<HUDState>): void {
    this.state = { ...this.state, ...s };
    if (s.currentPanel !== undefined) this.currentPanel = s.currentPanel;
  }

  /** Called every render frame from the game loop. */
  render(dt: number): void {
    this.accum += dt;
    if (this.accum > 0.033) {
      this.accum = 0;
      this.refresh();
    }
  }

  private refresh(): void {
    const p = this.state.player;
    if (!p) {
      (this.refs.hud as HTMLElement).hidden = true;
      return;
    }
    (this.refs.hud as HTMLElement).hidden = false;

    // Vitals
    const hpEl  = this.refs.hud.querySelector<HTMLElement>('[data-display="hp"]')!;
    const stEl  = this.refs.hud.querySelector<HTMLElement>('[data-display="stamina"]')!;
    const crEl  = this.refs.hud.querySelector<HTMLElement>('[data-display="credits"]')!;
    const hpBar = this.refs.hud.querySelector<HTMLElement>('[data-bar="hp"] span')!;
    const stBar = this.refs.hud.querySelector<HTMLElement>('[data-bar="stamina"] span')!;
    hpBar.style.width = `${(p.stats.hp / p.stats.maxHp) * 100}%`;
    stBar.style.width = `${(p.stats.stamina / p.stats.maxStamina) * 100}%`;
    hpBar.classList.toggle('low', p.stats.hp / p.stats.maxHp < 0.25);
    stBar.classList.toggle('low', p.stats.stamina / p.stats.maxStamina < 0.15);
    hpEl.textContent = `${Math.ceil(p.stats.hp)}`;
    stEl.textContent = `${Math.ceil(p.stats.stamina)}`;
    crEl.textContent = `${p.stats.credits}`;

    // Compass
    const deg = ((-p.angle * 180) / Math.PI + 90 + 360) % 360;
    const degEl = this.refs.hud.querySelector<HTMLElement>('[data-compass-deg]')!;
    degEl.textContent = `${Math.round(deg)}\u00b0`;

    // Weapon/ammo
    const wpName = this.refs.hud.querySelector<HTMLElement>('[data-weapon-name]')!;
    const wpAmmo = this.refs.hud.querySelector<HTMLElement>('[data-weapon-ammo]')!;
    wpName.textContent = this.state.weaponName;
    if (this.state.ammo.clip >= 0) {
      wpAmmo.textContent = `${this.state.ammo.clip} / ${this.state.ammo.reserve}`;
    } else {
      wpAmmo.textContent = '— / —';
    }

    // Objective / room
    const obj = this.refs.hud.querySelector<HTMLElement>('[data-objective]')!;
    const rm = this.refs.hud.querySelector<HTMLElement>('[data-room]')!;
    obj.textContent = this.state.objective;
    rm.textContent = this.state.room;

    // Inventory (top facing row of HUD hot bar)
    const invEl = this.refs.hud.querySelector<HTMLElement>('[data-inventory]')!;
    if (invEl.children.length !== p.inventory.length || invEl.dataset.idstamp !== p.inventory.join(',')) {
      invEl.dataset.idstamp = p.inventory.join(',');
      invEl.innerHTML = '';
      for (const item of p.inventory) {
        const li = document.createElement('li');
        li.textContent = item.slice(0, 3).toUpperCase();
        if (item === p.weapon) li.classList.add('active');
        invEl.appendChild(li);
      }
    }

    // Tip
    const tipEl = this.refs.hud.querySelector<HTMLElement>('[data-tip]')!;
    tipEl.textContent = this.state.tip;

    // Interact prompt
    this.refs.prompt.hidden = !this.state.terminal;

    // Panels
    for (const p of ['terminal', 'hack', 'logs', 'inventory', 'menu'] as const) {
      const el = this.refs[`panel${p.charAt(0).toUpperCase() + p.slice(1) as 'Terminal' | 'Hack' | 'Logs' | 'Inventory' | 'Menu'}`];
      if (el) (el as HTMLElement).hidden = this.currentPanel !== p;
    }

    // Hack panel rendering
    if (this.currentPanel === 'hack' && this.state.hackState) {
      this.renderHackPanel(this.state.hackState);
    }
    // Logs
    if (this.currentPanel === 'logs') {
      this.renderLogsPanel();
    }
    // Terminal
    if (this.currentPanel === 'terminal' && this.state.terminal) {
      this.renderTerminalPanel(this.state.terminal);
    }
    // Inventory
    if (this.currentPanel === 'inventory') {
      this.renderInventoryPanel(p);
    }
  }

  private renderInventoryPanel(p: PlayerSnapshot): void {
    const grid = this.refs.panelInventory.querySelector<HTMLElement>('[data-inv-grid]')!;
    const stamp = `${p.inventory.join(',')}|${p.weapon}`;
    if (grid.dataset.idstamp === stamp) return;
    grid.dataset.idstamp = stamp;
    renderInventory(grid, { inventory: p.inventory, weapon: p.weapon });
  }

  private renderTerminalPanel(t: TerminalState): void {
    const titleEl = this.refs.panelTerminal.querySelector<HTMLElement>('[data-terminal-title]')!;
    const screenEl = this.refs.panelTerminal.querySelector<HTMLElement>('[data-terminal-screen]')!;
    titleEl.textContent = t.label;
    const lines = t.logs.map((l) => `> ${l.title}\n> ${l.transcript.replace(/\n/g, '\n> ')}`).join('\n\n');
    screenEl.textContent =
      `${t.label.toUpperCase()} [${t.locked ? 'LOCKED' : 'OPEN'}]\n\n` +
      (lines || '(no logs captured)\n') +
      (t.hacked ? '\n[HACKED] extra diagnostics available' : '');
  }

  private renderHackPanel(h: NonNullable<HUDState['hackState']>): void {
    const grid = this.refs.panelHack.querySelector<HTMLElement>('[data-hack-grid]')!;
    const time = this.refs.panelHack.querySelector<HTMLElement>('[data-hack-time]')!;
    const traces = this.refs.panelHack.querySelector<HTMLElement>('[data-hack-traces]')!;
    const puzzle = h.puzzle;
    const lines: string[] = [];
    puzzle.program.forEach((node, i) => {
      // Separate the 3 lines visually (SPEC 4.6: "three lines of tokens").
      if (i > 0 && i % puzzle.lineWidth === 0) lines.push(`  --- LINE ${i / puzzle.lineWidth} ---`);
      const filled = h.userInput.get(i) ?? '';
      const isMissing = puzzle.missingIndices.includes(i);
      lines.push(
        isMissing
          ? `  ${String(i).padStart(2)}: ${(filled || '??').padEnd(4)} // cipher: ${node.hint}${filled ? '' : ' <--'}`
          : `  ${String(i).padStart(2)}: ${node.text.padEnd(4)}`,
      );
    });
    grid.textContent =
      `// 3 lines — decode cipher (Caesar +1, e.g. NPW -> MOV):\n  --- LINE 0 ---\n${lines.join('\n')}\n\n// tokens: ${puzzle.tokenBank.join(' ')}`;
    time.textContent = `${h.timeLeft.toFixed(1)}`;
    traces.textContent = `${h.tracesLeft}`;
  }

  private renderLogsPanel(): void {
    const list = this.refs.panelLogs.querySelector<HTMLElement>('[data-log-list]')!;
    list.innerHTML = '';
    for (const e of this.state.enemies) {
      // info logs about enemies are shown elsewhere
      void e;
    }
    if (this.state.terminal) {
      for (const log of this.state.terminal.logs) {
        const li = document.createElement('li');
        li.innerHTML = `<time>[${log.played ? 'PLAYED' : 'NEW'}]</time> ${log.title}`;
        li.classList.toggle('played', !!log.played);
        list.appendChild(li);
      }
    }
  }

  showDeathScreen(onReload: () => void, onMenu: () => void): void {
    this.refs.dead.hidden = false;
    const reloadBtn = this.refs.dead.querySelector<HTMLButtonElement>('[data-act="reload"]')!;
    const menuBtn = this.refs.dead.querySelector<HTMLButtonElement>('[data-act="menu"]')!;
    reloadBtn.onclick = () => {
      this.refs.dead.hidden = true;
      onReload();
    };
    menuBtn.onclick = () => {
      this.refs.dead.hidden = true;
      onMenu();
    };
  }

  showWinScreen(onMenu: () => void): void {
    this.refs.win.hidden = false;
    const menuBtn = this.refs.win.querySelector<HTMLButtonElement>('[data-act="menu"]')!;
    menuBtn.onclick = () => {
      this.refs.win.hidden = true;
      onMenu();
    };
  }

  showBootScreen(opts: { onNewGame: () => void; onContinue?: () => void; hasSave?: boolean }): void {
    const boot = this.refs.boot;
    boot.dataset.screen = 'boot';
    boot.hidden = false;
    const newBtn = boot.querySelector<HTMLButtonElement>('[data-act="newgame"]')!;
    const cont = boot.querySelector<HTMLButtonElement>('[data-act="continue"]')!;
    newBtn.onclick = () => {
      boot.hidden = true;
      opts.onNewGame();
    };
    cont.hidden = !opts.hasSave;
    if (opts.hasSave) cont.onclick = () => {
      boot.hidden = true;
      opts.onContinue?.();
    };
  }

  /** Sets the options panel's controls to reflect the current persisted
   *  settings + key bindings. Call once at startup (values only change via
   *  the panel itself afterwards, so no need to re-sync on every pause). */
  populateMenu(settings: GameSettings, bindings: Record<RemappableAction, string>): void {
    const panel = this.refs.panelMenu;
    const volEl = (cat: string) => panel.querySelector<HTMLInputElement>(`[data-vol="${cat}"]`)!;
    volEl('master').value = String(Math.round(settings.masterVolume * 100));
    volEl('sfx').value = String(Math.round(settings.sfxVolume * 100));
    volEl('voice').value = String(Math.round(settings.voiceVolume * 100));
    volEl('ambient').value = String(Math.round(settings.ambientVolume * 100));
    volEl('music').value = String(Math.round(settings.musicVolume * 100));
    const sensEl = panel.querySelector<HTMLInputElement>('[data-sens]')!;
    sensEl.value = String(Math.round(((settings.sensitivity - 0.0005) / 0.0055) * 100));
    const diffEl = panel.querySelector<HTMLSelectElement>('[data-difficulty]')!;
    diffEl.value = settings.difficulty;
    const motionEl = panel.querySelector<HTMLInputElement>('[data-reduce-motion]')!;
    motionEl.checked = settings.reduceMotion;
    for (const [action, key] of Object.entries(bindings)) {
      const btn = panel.querySelector<HTMLButtonElement>(`[data-rebind="${action}"]`);
      if (btn) btn.textContent = key === ' ' ? 'SPACE' : key.toUpperCase();
    }
  }

  private attachUI(): void {
    // close buttons
    for (const panel of [this.refs.panelTerminal, this.refs.panelHack, this.refs.panelLogs, this.refs.panelInventory]) {
      const close = panel.querySelector('[data-close]')!;
      close.addEventListener('click', () => {
        this.currentPanel = null;
      });
    }
    // terminal buttons
    this.refs.panelTerminal.querySelector('[data-act="hack"]')!.addEventListener('click', () => {
      this.currentPanel = 'hack';
    });
    this.refs.panelTerminal.querySelector('[data-act="logs"]')!.addEventListener('click', () => {
      this.currentPanel = 'logs';
    });
    // inventory weapon slots (click to equip)
    const grid = this.refs.panelInventory.querySelector<HTMLElement>('[data-inv-grid]')!;
    grid.addEventListener('click', (ev) => {
      const slot = (ev.target as HTMLElement).closest<HTMLElement>('.weapon-slot');
      const id = slot?.dataset.weapon as WeaponId | undefined;
      if (id) this.onSelectWeapon?.(id);
    });
    // inventory hot slots: drag-drop reorder (SPEC 4.5)
    grid.addEventListener('dragstart', (ev) => {
      const slot = (ev.target as HTMLElement).closest<HTMLElement>('.slot[data-slot-index]');
      this.dragFromSlot = slot ? Number(slot.dataset.slotIndex) : null;
    });
    grid.addEventListener('dragover', (ev) => {
      if (this.dragFromSlot !== null) ev.preventDefault(); // allow drop
    });
    grid.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const slot = (ev.target as HTMLElement).closest<HTMLElement>('.slot[data-slot-index]');
      const to = slot ? Number(slot.dataset.slotIndex) : null;
      if (this.dragFromSlot !== null && to !== null) this.onReorderInventory?.(this.dragFromSlot, to);
      this.dragFromSlot = null;
    });

    this.attachMenuUI();
  }

  private attachMenuUI(): void {
    const panel = this.refs.panelMenu;
    for (const cat of ['master', 'sfx', 'voice', 'ambient', 'music'] as const) {
      const el = panel.querySelector<HTMLInputElement>(`[data-vol="${cat}"]`)!;
      el.addEventListener('input', () => this.onSetVolume?.(cat, Number(el.value) / 100));
    }
    const sensEl = panel.querySelector<HTMLInputElement>('[data-sens]')!;
    sensEl.addEventListener('input', () => {
      const sensitivity = 0.0005 + (Number(sensEl.value) / 100) * 0.0055;
      this.onSetSensitivity?.(sensitivity);
    });
    const diffEl = panel.querySelector<HTMLSelectElement>('[data-difficulty]')!;
    diffEl.addEventListener('change', () => this.onSetDifficulty?.(diffEl.value as Difficulty));
    const motionEl = panel.querySelector<HTMLInputElement>('[data-reduce-motion]')!;
    motionEl.addEventListener('change', () => this.onSetReduceMotion?.(motionEl.checked));

    for (const btn of Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-rebind]'))) {
      btn.addEventListener('click', () => {
        const action = btn.dataset.rebind as RemappableAction;
        this.rebindArming = action;
        const prevText = btn.textContent;
        btn.textContent = '...';
        const onKey = (e: KeyboardEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.key.toLowerCase() === 'escape') {
            btn.textContent = prevText;
          } else {
            const key = e.key.toLowerCase();
            this.onRebindKey?.(action, key);
            btn.textContent = key === ' ' ? 'SPACE' : key.toUpperCase();
          }
          this.rebindArming = null;
          window.removeEventListener('keydown', onKey, true);
        };
        window.addEventListener('keydown', onKey, true);
      });
    }

    panel.querySelector('[data-act="export-save"]')!.addEventListener('click', () => this.onExportSave?.());
    const fileInput = panel.querySelector<HTMLInputElement>('[data-import-file]')!;
    panel.querySelector('[data-act="import-save"]')!.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) this.onImportSave?.(file);
      fileInput.value = '';
    });

    panel.querySelector('[data-act="resume"]')!.addEventListener('click', () => this.onResume?.());
    panel.querySelector('[data-act="mainmenu"]')!.addEventListener('click', () => this.onMainMenu?.());
  }

  getPanel(): HUDState['currentPanel'] { return this.currentPanel; }
  setPanel(p: HUDState['currentPanel']): void { this.currentPanel = p; }
}
