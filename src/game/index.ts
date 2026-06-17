/**
 * Game bootstrap. Wires up:
 *   - GameShell loop (60Hz fixed, RAF render)
 *   - Player + MapRenderer + SpriteRenderer
 *   - AudioBus + GameAudio (SFX palette)
 *   - HUD (DOM overlay, 30Hz refresh)
 *   - EnemySystem, TerminalSystem, Inventory
 *   - Save / load via IndexedDB
 */

import { Input, AudioBus, GameShell, AssetLoader, cell } from '../engine';
import { loadLevel } from '../engine/LevelLoader';
import { MapRenderer } from './MapRenderer';
import { SpriteRenderer, type SpriteRef } from './SpriteRenderer';
import { Player, WEAPONS, type WeaponId } from './Player';
import { EnemySystem } from './Enemy';
import { TerminalSystem } from './Terminal';
import { HUD, type HUDRefs } from './HUD';
import { GameAudio } from './Audio';
import { generatePuzzle, startHack, tickHack, submitToken, describeProgram } from './Hacking';
import { writeSlot, readSlot, SAVE_SLOT } from '../engine/Persistence';
import { listLevels, findLevel } from './levels/registry';

export interface GameRefs {
  root: HTMLElement;
  worldCanvas: HTMLCanvasElement;
  spriteCanvas: HTMLCanvasElement;
  weaponCanvas: HTMLCanvasElement;
  hud: HTMLElement;
  boot: HTMLElement;
  dead: HTMLElement;
  prompt: HTMLElement;
  panelTerminal: HTMLElement;
  panelHack: HTMLElement;
  panelLogs: HTMLElement;
  panelInventory: HTMLElement;
}

export class Game {
  readonly input: Input;
  readonly audio: AudioBus = new AudioBus();
  readonly gameAudio: GameAudio;
  readonly shell: GameShell;
  readonly assets = new AssetLoader();
  readonly renderer: MapRenderer;
  readonly spriteRenderer: SpriteRenderer;
  readonly player = new Player({ x: 2.5, y: 2.5, face: 0 });
  enemySystem!: EnemySystem;
  terminalSystem!: TerminalSystem;
  hud!: HUD;
  levelState = { manifest: null as null | ReturnType<typeof loadLevel>['manifest'], data: null as null | ReturnType<typeof loadLevel> };
  flags = new Set<string>();
  playTimeMs = 0;
  hackState: ReturnType<typeof startHack> | null = null;
  isHacking = false;
  isPaused = false;
  deathAt = 0;
  weaponIndex = 0;
  weaponOrder: WeaponId[] = ['pistol', 'shotgun', 'pulse_rifle'];

  // reactive cells for HUD refresh
  private readonly ammoCell = cell<{ name: string; clip: number; reserve: number }>({ name: '—', clip: 0, reserve: 0 });
  private readonly objectiveCell = cell<string>('Plug in. Jack out. Don\u2019t be seen.');
  private readonly roomCell = cell<string>('— Facility Sublevel 3 —');

  constructor(public readonly refs: GameRefs) {
    this.input = new Input(refs.root);
    this.shell = new GameShell({
      fixedHz: 60,
      maxFrameMs: 250,
      canvas: refs.worldCanvas,
    });
    this.renderer = new MapRenderer(refs.worldCanvas, this.assets);
    this.spriteRenderer = new SpriteRenderer(refs.spriteCanvas, this.assets);
    this.gameAudio = new GameAudio(this.audio);

    const hudRefs: HUDRefs = {
      hud: refs.hud,
      boot: refs.boot,
      dead: refs.dead,
      prompt: refs.prompt,
      panelTerminal: refs.panelTerminal,
      panelHack: refs.panelHack,
      panelLogs: refs.panelLogs,
      panelInventory: refs.panelInventory,
    };
    this.hud = new HUD(hudRefs);

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.spriteRenderer.resize();
    });
  }

  begin(): void {
    this.loadLevelById('sublevel_3');
    this.shell.start({
      update: (dt, t) => this.update(dt, t),
      render: (alpha, t) => this.render(alpha, t),
    });
  }

  loadLevelById(id: string): boolean {
    const rec = findLevel(id);
    if (!rec) return false;
    const loaded = loadLevel(rec.manifest);
    this.levelState.data = loaded;
    this.levelState.manifest = loaded.manifest;
    this.player.position = { x: rec.manifest.spawn.x, y: rec.manifest.spawn.y };
    this.player.angle = (rec.manifest.spawn.face * Math.PI) / 180;
    this.player.pitch = 0;

    // Items placed in level (read from tiles via logic below; for the sliver we wire data item spawns separately).
    // For the vertical slice we let the enemies/terminals drive things; items are discoverable via interactable manifest.
    const items = rec.manifest.interactables
      .filter((i) => i.kind === 'audio_log')
      .map((i, idx) => {
        if (i.kind === 'audio_log') {
          return [{ id: `data_${idx}`, kind: 'data' as const, position: { x: i.x + 0.5, y: i.y + 0.5 }, label: 'RECOVERED DATA' }];
        }
        return [];
      })
      .flat();
    this.enemySystem = new EnemySystem(loaded, this.player);
    for (const e of rec.manifest.enemies) this.enemySystem.spawn(e.kind, e.x + 0.5, e.y + 0.5, e.patrol);
    this.terminalSystem = new TerminalSystem(loaded, items, this.flags);
    return true;
  }

  private update(dt: number, t: number): void {
    if (this.isPaused) return;
    if (this.player.stats.hp <= 0) {
      this.deathAt += dt;
      if (this.deathAt > 2 && !this.refs.dead.hidden) {
        // already shown
      }
      // outside the game-shell render we still want the HUD shell to tick for the death screen
      return;
    }
    this.playTimeMs += dt * 1000;

    const rawInput = this.input.consume();
    // Pause / inventory toggle
    if (rawInput.pause) {
      this.isPaused = !this.isPaused;
      this.hud.setPanel(this.isPaused ? 'menu' : null);
    }
    if (rawInput.inventoryToggle && !this.isHacking) {
      this.hud.setPanel(this.hud.getPanel() === 'inventory' ? null : 'inventory');
    }
    if (this.isHacking && this.hackState) {
      tickHack(this.hackState, dt);
      // Number keys select token index from a fixed bank
      // For UX: support a tiny preview in the HUD
      if (this.hackState.status !== 'running') {
        if (this.hackState.status === 'won') {
          this.terminalSystem.unlockDoor('door_secure_lab');
          this.flags.add('flag_lab_terminal');
        }
        this.isHacking = false;
        this.hackState = null;
        this.hud.setPanel(null);
      }
    }

    // Quick weapon swap via 1/2/3
    if (rawInput.use === 1) this.player.setWeapon('pistol');
    if (rawInput.use === 2) this.player.setWeapon('shotgun');
    if (rawInput.use === 3) this.player.setWeapon('pulse_rifle');

    // Move/shoot
    const moveResult = this.player.update(this.levelState.data!, dt, rawInput, {
      fire: (w) => this.handleFire(w),
      step: (amp) => this.handleStep(amp),
    });

    // Aim sway → pitch recovery
    this.player.pitch = Math.max(-0.5, Math.min(0.5, this.player.pitch - moveResult.recoil * 0.2));

    // Enemy AI tick
    this.enemySystem.update(dt, {
      onAlertChanged: () => {},
      onAttack: () => { this.gameAudio.playUi('beep'); },
      onShootAt: (e, target) => {
        this.gameAudio.playFire('pistol', { x: target.x, y: target.y, z: 0 });
      },
    });

    // Auto-save every ~30s
    if (Math.round(this.playTimeMs / 1000) % 30 === 0 && this.playTimeMs > 1000) {
      void this.save();
    }

    // Pointer-lock recovery
    if (this.input.isLocked() === false) {
      this.input.requestPointerLock();
    }

    // Interact prompt + approach detection
    const target = this.terminalSystem.pickApproach(this.player);
    const refX = (target?.bounds.x ?? 0) + 1;
    const refY = (target?.bounds.y ?? 0) + 1;
    void refX; void refY;
    this.refs.prompt.hidden = !target;
    if (target) {
      const inter = this.levelState.manifest?.interactables.find((i) => i.id === target.id);
      this.refs.prompt.innerHTML = `[E] ${(inter?.prompt ?? target.label).slice(0, 40)}`;
      if (rawInput.interact) {
        if (inter?.kind === 'door' && !inter.locked) {
          // no-op for now — door opens mechanically
        }
        if (inter?.kind === 'terminal' || inter?.kind === 'audio_log') {
          if (inter.locked) {
            // start hack minigame
            const puzzle = generatePuzzle(Date.now() & 0xFFFFFFFF, 'normal');
            this.hackState = startHack(puzzle);
            this.isHacking = true;
            this.hud.setPanel('hack');
          } else {
            this.terminalSystem.open(target.id);
            this.hud.setPanel('terminal');
          }
        }
        if (inter?.kind === 'medkit') {
          this.player.heal(40);
          this.gameAudio.playUi('beep');
          this.flagsCleanup(inter);
        }
        if (inter?.kind === 'ammo') {
          this.player.refill('pulse_rifle', this.player.ammo.pulse_rifle + 30);
          this.gameAudio.playUi('beep');
          this.flagsCleanup(inter);
        }
        if (inter?.kind === 'keycard') {
          this.player.addInventory('keycard_red');
          this.flags.add('flag_lab_terminal');
          this.gameAudio.playUi('beep');
          this.flagsCleanup(inter);
        }
      }
    }

    // Room name based on player tile
    if (this.levelState.data) {
      const tx = Math.floor(this.player.position.x);
      const ty = Math.floor(this.player.position.y);
      const room = this.levelState.data.rooms.find((r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
      if (room) {
        this.roomCell.set(`Room ${room.x + 0}-${room.y + 0} (${room.w}x${room.h})`);
      }
    }

    // Audio listener follows player
    this.audio.setListener(
      { x: this.player.position.y * 0.05, y: 0, z: this.player.position.x * 0.05 }, // swap so x and z feed panner
      { x: Math.cos(this.player.angle), y: 0, z: Math.sin(this.player.angle) },
      { x: 0, y: 1, z: 0 },
    );

    // Update cells
    this.ammoCell.set({
      name: WEAPONS[this.player.weapon].name,
      clip: Math.max(0, this.player.ammo[this.player.weapon]),
      reserve: 0,
    });

    // HUD subscription via setState
    this.hud.setState({
      player: this.player.snapshot(),
      enemies: this.enemySystem.snapshots(),
      terminal: this.terminalSystem.current_(),
      ammo: { name: WEAPONS[this.player.weapon].name, clip: this.player.ammo[this.player.weapon], reserve: 0 },
      weaponName: WEAPONS[this.player.weapon].name,
      objective: this.objectiveCell.get(),
      room: this.roomCell.get(),
      hackState: this.hackState ?? undefined,
      tip: this.tip(),
    });

    void t;
    this.input.resetMouseDelta();
  }

  private tip(): string {
    if (this.player.stats.hp < 30) return 'HEV: HP critical. Find a medkit.';
    if (this.player.ammo[this.player.weapon] < 5) return 'Reload or swap to sidearm.';
    if (this.enemySystem.alive() > 0 && this.enemySystem.snapshots().some((e) => e.awareness > 0.5)) return 'Detected. Silenced weapons preferred.';
    return 'Tip: terminals are loud. Guards hear.';
  }

  private flagsCleanup(inter: { x: number; y: number; id: string }) {
    // Remove the interactable so it can't be used twice (visual: brighten area later)
    const m = this.levelState.manifest;
    if (!m) return;
    const idx = m.interactables.findIndex((i) => i.id === inter.id);
    if (idx >= 0) m.interactables.splice(idx, 1);
    void inter.x; void inter.y;
  }

  private handleFire(weapon: WeaponId): void {
    const pos = { x: this.player.position.x, y: this.player.position.y, z: 0 };
    // Hitscan from center camera at slight random spread
    const spread = WEAPONS[weapon].spread;
    const angle = this.player.angle + (Math.random() - 0.5) * spread;
    const r = this.renderer.hitscan(this.levelState.data!, this.player.position, angle, WEAPONS[weapon].range);
    if (r.hit) {
      const tileX = Math.floor((r.pos.x + 0.0001) / (this.levelState.data?.manifest.cellSize ?? 1));
      const tileY = Math.floor((r.pos.y + 0.0001) / (this.levelState.data?.manifest.cellSize ?? 1));
      const radius = weapon === 'shotgun' ? 0.7 : weapon === 'pulse_rifle' ? 0.45 : 0.4;
      const damage = WEAPONS[weapon].damage;
      const knockDir = angle;
      const hits = this.enemySystem.damageAtTile(tileX, tileY, radius, damage, knockDir);
      // Subtract ammo based on weapon.pellets for shotgun (handled by Player.update which already decremented 1)
      if (weapon === 'shotgun') {
        this.player.refill('shotgun', this.player.ammo.shotgun + 7);
      }
      if (hits.length) {
        this.gameAudio.playHit({ x: r.pos.x, y: r.pos.y, z: 0 });
      }
    }
    this.gameAudio.playFire(weapon, pos);
    void pos;
  }

  private handleStep(amp: number): void {
    if (amp < 0.1) return;
    this.gameAudio.playStep({ x: this.player.position.x, y: this.player.position.y, z: 0 });
  }

  private render(alpha: number, t: number): void {
    if (!this.levelState.data) return;
    if (this.player.stats.hp <= 0) {
      if (!this.refs.dead.hidden) {
        // already shown
      }
    }
    // World
    const cam = this.player.camera();
    const bobAmp = this.player.snapshot().walking;
    cam.pitch += Math.sin(this.player.bobPhase) * 0.04 * bobAmp;
    this.renderer.render(this.levelState.data, cam, Math.sin(this.player.bobPhase) * bobAmp * 0.05);
    // Sprites
    const sprites = this.buildSprites();
    const atlas = this.assets.buildSpriteAtlas();
    this.spriteRenderer.render(cam, this.renderer.zBuffer, sprites, atlas);
    // HUD
    this.hud.render(1 / 60);
    void alpha; void t;

    if (this.player.stats.hp <= 0 && !this.refs.dead.hidden === false) {
      this.hud.showDeathScreen(
        () => this.respawn(),
        () => { this.isPaused = true; },
      );
    }
  }

  private buildSprites(): SpriteRef[] {
    const sprites: SpriteRef[] = [];
    // Enemies
    for (const e of this.enemySystem.snapshots()) {
      const dx = e.position.x - this.player.position.x;
      const dy = e.position.y - this.player.position.y;
      sprites.push({
        position: e.position,
        dist: dx * dx + dy * dy,
        type: 'enemy',
        index: e.kind === 'drone' ? 0 : 1,
      });
    }
    // Items (level interactables with item kinds)
    if (this.levelState.manifest) {
      for (const inter of this.levelState.manifest.interactables) {
        let spriteIndex = -1;
        if (inter.kind === 'audio_log') spriteIndex = 0;
        if (inter.kind === 'medkit')    spriteIndex = 1;
        if (inter.kind === 'ammo')      spriteIndex = 2;
        if (inter.kind === 'keycard')   spriteIndex = 3;
        if (spriteIndex >= 0) {
          const dx = inter.x + 0.5 - this.player.position.x;
          const dy = inter.y + 0.5 - this.player.position.y;
          sprites.push({
            position: { x: inter.x + 0.5, y: inter.y + 0.5 },
            dist: dx * dx + dy * dy,
            type: 'item',
            index: spriteIndex,
          });
        }
      }
    }
    return sprites;
  }

  async save(): Promise<void> {
    const snap = {
      ...this.player.snapshot(),
      flags: [...this.flags],
      level: this.levelState.data!.manifest.id,
      time: this.playTimeMs,
    };
    await writeSlot(SAVE_SLOT, snap, this.playTimeMs);
  }

  async load(): Promise<boolean> {
    const rec = await readSlot(SAVE_SLOT);
    if (!rec) return false;
    const data = rec.data as {
      px: number; py: number; angle: number; pitch: number; fov: number;
      stats: Player['stats']; weapon: WeaponId; ammo: Player['ammo']; inventory: string[];
      flags: string[]; level: string; time: number;
    };
    this.loadLevelById(data.level);
    this.player.position = { x: data.px, y: data.py };
    this.player.angle = data.angle;
    this.player.pitch = data.pitch;
    this.player.stats = data.stats;
    this.player.ammo = data.ammo;
    this.player.setInventory(data.inventory);
    this.flags = new Set(data.flags);
    this.playTimeMs = data.time;
    return true;
  }

  respawn(): void {
    this.player.stats = { hp: this.player.stats.maxHp, stamina: this.player.stats.maxStamina, maxHp: this.player.stats.maxHp, maxStamina: this.player.stats.maxStamina, credits: 0 };
    this.player.position = { x: 2.5, y: 2.5 };
    this.player.angle = 0;
    this.player.pitch = 0;
    this.player.refill('pistol', 18);
    this.player.refill('shotgun', 0);
    this.player.refill('pulse_rifle', 30);
    this.deathAt = 0;
  }

  /** Top-level start menu dispatcher. */
  async beginWithMenu(): Promise<void> {
    const rec = listLevels();
    void rec;
    this.hud.showBootScreen({
      onNewGame: async () => {
        await this.audio.init();
        this.gameAudio.prime();
        this.input.requestPointerLock();
        this.begin();
        this.startMenuAudio();
      },
      hasSave: !!await readSlot(SAVE_SLOT).catch(() => null),
      onContinue: async () => {
        await this.audio.init();
        this.gameAudio.prime();
        await this.load();
        this.input.requestPointerLock();
        this.begin();
        this.startMenuAudio();
      },
    });
  }

  private startMenuAudio(): void {
    // A subtle ambient bed synthesized as a low drone on the master bus
    setTimeout(() => {
      const ctx = this.audio.ctxInstance();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 56;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.value = 0.0008;
      osc.connect(lp).connect(g).connect((this.audio as unknown as { master: GainNode }).master);
      osc.start();
    }, 400);
  }
}

export type _Unused = ListLevelsResult;
type ListLevelsResult = ReturnType<typeof listLevels>;
