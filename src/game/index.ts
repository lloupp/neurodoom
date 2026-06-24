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
import { loadSettings, saveSettings, DIFFICULTY_DAMAGE_TAKEN, type GameSettings, type Difficulty } from '../engine/Settings';
import type { RemappableAction } from '../engine/Input';
import { MapRenderer } from './MapRenderer';
import { SpriteRenderer, type SpriteRef } from './SpriteRenderer';
import { Player, WEAPONS, type WeaponId, type WeaponDef } from './Player';
import { EnemySystem, type LootDrop, type EnemyKind } from './Enemy';
import { surfaceAt, collidesAt } from './Level';
import { TerminalSystem, type LogTag } from './Terminal';
import type { MapTrigger } from './MapSchema';
import { HUD, type HUDRefs } from './HUD';
import { GameAudio } from './Audio';
import { generatePuzzle, startHack, tickHack } from './Hacking';
import { writeSlot, readSlot, SAVE_SLOT } from '../engine/Persistence';
import { listLevels, findLevel } from './levels/registry';

/** A live rocket-launcher shot in flight; advanced each tick by
 *  Game.updateProjectiles() until it hits a wall, an enemy, or its max range. */
interface Projectile {
  position: { x: number; y: number };
  vx: number;
  vy: number;
  weapon: WeaponId;
  traveled: number;
}

export interface GameRefs {
  root: HTMLElement;
  worldCanvas: HTMLCanvasElement;
  spriteCanvas: HTMLCanvasElement;
  weaponCanvas: HTMLCanvasElement;
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
  hackingTargetId: string | null = null;
  isHacking = false;
  private firedTriggers = new Set<string>();
  isPaused = false;
  deathAt = 0;
  hasWon = false;
  weaponIndex = 0;
  weaponOrder: WeaponId[] = ['pistol', 'shotgun', 'pulse_rifle', 'rocket_launcher'];
  private projectiles: Projectile[] = [];
  settings: GameSettings = loadSettings();

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
      win: refs.win,
      prompt: refs.prompt,
      panelTerminal: refs.panelTerminal,
      panelHack: refs.panelHack,
      panelLogs: refs.panelLogs,
      panelInventory: refs.panelInventory,
      panelMenu: refs.panelMenu,
    };
    this.hud = new HUD(hudRefs);
    this.hud.onSelectWeapon = (id) => this.player.setWeapon(id);
    this.hud.onReorderInventory = (from, to) => this.player.reorderInventory(from, to);
    this.hud.populateMenu(this.settings, this.input.getBindings());
    this.applySettings();
    this.wireMenuCallbacks();

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.spriteRenderer.resize();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.audio.suspend();
      else void this.audio.resume();
    });
  }

  /** Pushes current settings into the live systems that own the actual
   *  knobs (AudioBus gain nodes, Player sensitivity, EnemySystem difficulty). */
  private applySettings(): void {
    this.audio.setMasterGain(this.settings.masterVolume);
    this.audio.setCategoryGain('sfx', this.settings.sfxVolume);
    this.audio.setCategoryGain('voice', this.settings.voiceVolume);
    this.audio.setCategoryGain('ambient', this.settings.ambientVolume);
    this.audio.setCategoryGain('music', this.settings.musicVolume);
    this.player.setSensitivity(this.settings.sensitivity);
    this.enemySystem?.setDamageMultiplier(DIFFICULTY_DAMAGE_TAKEN[this.settings.difficulty]);
  }

  private wireMenuCallbacks(): void {
    this.hud.onSetVolume = (cat, v) => {
      if (cat === 'master') this.settings.masterVolume = v;
      else if (cat === 'sfx') this.settings.sfxVolume = v;
      else if (cat === 'voice') this.settings.voiceVolume = v;
      else if (cat === 'ambient') this.settings.ambientVolume = v;
      else this.settings.musicVolume = v;
      this.applySettings();
      saveSettings(this.settings);
    };
    this.hud.onSetSensitivity = (v) => {
      this.settings.sensitivity = v;
      this.applySettings();
      saveSettings(this.settings);
    };
    this.hud.onSetDifficulty = (d: Difficulty) => {
      this.settings.difficulty = d;
      this.applySettings();
      saveSettings(this.settings);
    };
    this.hud.onSetReduceMotion = (v) => {
      this.settings.reduceMotion = v;
      saveSettings(this.settings);
    };
    this.hud.onRebindKey = (action: RemappableAction, key: string) => {
      this.input.setBinding(action, key);
      // setBinding may have swapped a conflicting action's key — refresh all labels, not just this one.
      this.hud.populateMenu(this.settings, this.input.getBindings());
    };
    this.hud.onResume = () => {
      this.isPaused = false;
      this.hud.setPanel(null);
      this.input.requestPointerLock();
    };
    this.hud.onMainMenu = () => {
      // Stay paused — the boot screen sits on top while the shell loop is
      // stopped outright, so no gameplay/AI ticks behind the main menu.
      this.shell.stop();
      this.hud.setPanel(null);
      this.input.exitPointerLock();
      void this.beginWithMenu();
    };
    this.hud.onExportSave = () => this.exportSave();
    this.hud.onImportSave = (file) => void this.importSave(file);
  }

  private exportSave(): void {
    const snap = {
      ...this.player.snapshot(),
      flags: [...this.flags],
      level: this.levelState.data!.manifest.id,
      time: this.playTimeMs,
    };
    const blob = new Blob([JSON.stringify({ schema_version: 1, saved_at: Date.now(), data: snap }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurodoom-save-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async importSave(file: File): Promise<void> {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { data: unknown };
      await writeSlot(SAVE_SLOT, parsed.data, this.playTimeMs);
      await this.load();
    } catch {
      // Malformed/foreign file — ignore rather than crash the session.
    }
  }

  begin(): void {
    this.hasWon = false;
    this.refs.win.hidden = true;
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
    this.enemySystem.setDamageMultiplier(DIFFICULTY_DAMAGE_TAKEN[this.settings.difficulty]);
    for (const e of rec.manifest.enemies) this.enemySystem.spawn(e.kind, e.x + 0.5, e.y + 0.5, e.patrol);
    this.terminalSystem = new TerminalSystem(loaded, items, this.flags);
    // Doors that aren't gated by a flag are open from the start — only the
    // tile char (not the interactable's `locked` flag) governs collision,
    // so they must be carved out of the grid here.
    for (const inter of rec.manifest.interactables) {
      if (inter.kind === 'door' && !inter.locked) this.terminalSystem.unlockDoor(inter.id);
    }
    this.firedTriggers.clear();
    void this.save();
    return true;
  }

  private update(dt: number, t: number): void {
    // Consumed even while paused so Esc can unpause (edge flags would
    // otherwise never be cleared and the player would be stuck in the menu).
    const rawInput = this.input.consume();
    if (rawInput.pause) {
      this.isPaused = !this.isPaused;
      this.hud.setPanel(this.isPaused ? 'menu' : null);
      if (this.isPaused) this.input.exitPointerLock();
      else this.input.requestPointerLock();
    }
    if (this.isPaused) return;
    if (this.player.stats.hp <= 0) {
      this.deathAt += dt;
      // Release the cursor so the death screen's buttons are actually clickable —
      // pointer lock otherwise keeps targeting the (now hidden-behind-overlay) canvas.
      this.input.exitPointerLock();
      return;
    }
    this.playTimeMs += dt * 1000;

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
          if (this.hackingTargetId) this.applyLogTags(this.terminalSystem.open(this.hackingTargetId));
        } else {
          // Failure: trace alarm + a ghost spawns near the player's position.
          const px = this.player.position.x;
          const py = this.player.position.y;
          this.gameAudio.playAlarm({ x: px, y: py, z: 0 });
          this.enemySystem.spawn('drone', px + 2, py + 2, []);
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
    if (rawInput.use === 4) this.player.setWeapon('rocket_launcher');

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

    // world.threat: highest enemy awareness drives the adaptive ambient/music mix
    const threat = this.enemySystem.snapshots().reduce((max, e) => Math.max(max, e.state === 'DEAD' ? 0 : e.awareness), 0);
    this.gameAudio.setThreat(threat);

    // Win condition: the boss (one per level, the run's climactic encounter) is dead.
    if (!this.hasWon && this.enemySystem.snapshots().some((e) => e.kind === 'boss' && e.state === 'DEAD')) {
      this.hasWon = true;
      this.input.exitPointerLock();
    }

    this.updateProjectiles(dt);

    // Persistent tile-coordinate triggers (manifest.triggers) — fire once per trigger when stepped on.
    const playerTileX = Math.floor(this.player.position.x);
    const playerTileY = Math.floor(this.player.position.y);
    for (const trig of this.levelState.manifest?.triggers ?? []) {
      const key = `${trig.x},${trig.y},${trig.type}`;
      if (trig.x === playerTileX && trig.y === playerTileY && !this.firedTriggers.has(key)) {
        this.firedTriggers.add(key);
        this.applyTrigger(trig);
      }
    }

    // Auto-save every ~30s
    if (Math.round(this.playTimeMs / 1000) % 30 === 0 && this.playTimeMs > 1000) {
      void this.save();
    }

    // Pointer-lock follows panel state: release the cursor so panel buttons (close,
    // hack/logs, weapon slots) are actually clickable — while locked, the Pointer
    // Lock spec keeps targeting every mouse event at the locked canvas regardless
    // of what's visually on top. Recapture it once gameplay resumes.
    const panelOpen = this.hud.getPanel() !== null;
    if (panelOpen || this.hasWon) {
      this.input.exitPointerLock();
    } else if (!this.input.isLocked()) {
      this.input.requestPointerLock();
    }

    // Interact prompt + approach detection
    const target = this.terminalSystem.pickApproach(this.player);
    // Doors aren't tracked by TerminalSystem — checked separately so `E` near a
    // locked door gives feedback instead of doing nothing (README: "E to interact
    // with terminals and doors"). Unlocked doors need no prompt; their tile is
    // already passable.
    const doorTarget = !target
      ? this.levelState.manifest?.interactables.find((i) => {
          if (i.kind !== 'door' || !i.locked) return false;
          const dx = (i.x + 0.5) - this.player.position.x;
          const dy = (i.y + 0.5) - this.player.position.y;
          return Math.hypot(dx, dy) < 1.5;
        }) ?? null
      : null;
    this.refs.prompt.hidden = !target && !doorTarget;
    if (doorTarget && !target) {
      this.refs.prompt.innerHTML = `[E] LOCKED — ${doorTarget.prompt ?? 'requires access'}`;
      if (rawInput.interact) this.gameAudio.playUi('error');
    }
    if (target) {
      const inter = this.levelState.manifest?.interactables.find((i) => i.id === target.id);
      this.refs.prompt.innerHTML = `[E] ${(inter?.prompt ?? target.label).slice(0, 40)}`;
      if (rawInput.interact) {
        if (inter?.kind === 'terminal' || inter?.kind === 'audio_log') {
          if (inter.locked) {
            // start hack minigame
            const puzzle = generatePuzzle(Date.now() & 0xFFFFFFFF, 'normal');
            this.hackState = startHack(puzzle);
            this.hackingTargetId = target.id;
            this.isHacking = true;
            this.hud.setPanel('hack');
          } else {
            const tags = this.terminalSystem.open(target.id);
            this.applyLogTags(tags);
            // Logs are heard, not just read (SPEC 4.7): play the transmission
            // from the interactable's world position so HRTF places it in space.
            this.gameAudio.playLog({ x: inter.x + 0.5, y: inter.y + 0.5, z: 0 });
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
        if (inter?.kind === 'credits') {
          this.player.addCredits(25);
          this.gameAudio.playUi('beep');
          this.flagsCleanup(inter);
        }
      }
    }

    // Room name based on player tile — a manifest-authored zone name takes
    // priority; falls back to an auto-derived coordinate label for tiles
    // designers haven't named.
    if (this.levelState.data) {
      const tx = Math.floor(this.player.position.x);
      const ty = Math.floor(this.player.position.y);
      const zone = this.levelState.manifest?.zones?.find((z) => tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h);
      if (zone) {
        this.roomCell.set(zone.name);
      } else {
        const room = this.levelState.data.rooms.find((r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
        if (room) {
          this.roomCell.set(`Room ${room.x + 0}-${room.y + 0} (${room.w}x${room.h})`);
        }
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

  private lootSeq = 0;

  private spawnLoot(drop: LootDrop): void {
    const m = this.levelState.manifest;
    if (!m) return;
    m.interactables.push({
      id: `loot_${this.lootSeq++}`,
      kind: drop.kind,
      x: Math.floor(drop.position.x),
      y: Math.floor(drop.position.y),
      prompt: drop.kind === 'ammo' ? 'Salvaged ammo'
        : drop.kind === 'medkit' ? 'Salvaged medkit'
        : drop.kind === 'credits' ? 'Salvaged credits'
        : 'Salvaged keycard',
    });
  }

  private flagsCleanup(inter: { x: number; y: number; id: string }) {
    // Remove the interactable so it can't be used twice (visual: brighten area later)
    const m = this.levelState.manifest;
    if (!m) return;
    const idx = m.interactables.findIndex((i) => i.id === inter.id);
    if (idx >= 0) m.interactables.splice(idx, 1);
    void inter.x; void inter.y;
  }

  /** Applies unlock/lock/spawn/flag tags parsed from a just-opened terminal log. */
  private applyLogTags(tags: LogTag[]): void {
    for (const tag of tags) {
      switch (tag.type) {
        case 'unlock': this.terminalSystem.unlockDoor(tag.value); break;
        case 'lock': this.terminalSystem.lockDoor(tag.value); break;
        case 'flag': this.flags.add(tag.value); break;
        case 'spawn': {
          const v = tag.value.toLowerCase();
          const kind: EnemyKind = v.includes('heavy') ? 'heavy' : v.includes('turret') ? 'turret' : v.includes('ghost') ? 'ghost' : 'drone';
          this.enemySystem.spawn(kind, this.player.position.x + 2, this.player.position.y + 2, []);
          break;
        }
      }
    }
  }

  /** Applies a persistent tile-coordinate trigger from manifest.triggers (fires once, see firedTriggers). */
  private applyTrigger(trig: MapTrigger): void {
    const data = trig.data ?? {};
    switch (trig.type) {
      case 'set_flag': {
        const key = data.key;
        if (typeof key === 'string') this.flags.add(key);
        break;
      }
      case 'spawn_ghost': {
        // Defaults to an actual 'ghost' kind (matching the trigger's own name)
        // unless data.kind explicitly overrides it.
        const kind: EnemyKind = data.kind === 'heavy' ? 'heavy' : data.kind === 'turret' ? 'turret' : data.kind === 'drone' ? 'drone' : 'ghost';
        this.enemySystem.spawn(kind, trig.x + 0.5, trig.y + 0.5, []);
        break;
      }
      case 'unlock': {
        const id = data.id;
        if (typeof id === 'string') this.terminalSystem.unlockDoor(id);
        break;
      }
      case 'lock': {
        const id = data.id;
        if (typeof id === 'string') this.terminalSystem.lockDoor(id);
        break;
      }
      case 'play_log': {
        const id = data.id;
        if (typeof id === 'string') {
          this.applyLogTags(this.terminalSystem.open(id));
          this.gameAudio.playLog({ x: trig.x + 0.5, y: trig.y + 0.5, z: 0 });
        }
        break;
      }
      case 'teleport': {
        const x = data.x;
        const y = data.y;
        if (typeof x === 'number' && typeof y === 'number') this.player.position = { x, y };
        break;
      }
    }
  }

  private handleFire(weapon: WeaponId): void {
    const pos = { x: this.player.position.x, y: this.player.position.y, z: 0 };
    const def = WEAPONS[weapon];
    const spread = def.spread;
    const angle = this.player.angle + (Math.random() - 0.5) * spread;

    // Projectile weapons (rocket launcher) spawn a travelling entity resolved
    // frame-by-frame in updateProjectiles() instead of an instant hitscan.
    if (def.projectileSpeed) {
      this.projectiles.push({
        position: { x: this.player.position.x, y: this.player.position.y },
        vx: Math.cos(angle) * def.projectileSpeed,
        vy: Math.sin(angle) * def.projectileSpeed,
        weapon,
        traveled: 0,
      });
      this.gameAudio.playFire(weapon, pos);
      return;
    }

    // Hitscan from center camera at slight random spread
    const r = this.renderer.hitscan(this.levelState.data!, this.player.position, angle, def.range);
    if (r.hit) {
      const tileX = Math.floor((r.pos.x + 0.0001) / (this.levelState.data?.manifest.cellSize ?? 1));
      const tileY = Math.floor((r.pos.y + 0.0001) / (this.levelState.data?.manifest.cellSize ?? 1));
      const radius = weapon === 'shotgun' ? 0.7 : weapon === 'pulse_rifle' ? 0.45 : 0.4;
      // Damage = base x crit x distance-falloff (per-target armor applied in EnemySystem)
      const dist = Math.hypot(r.pos.x - this.player.position.x, r.pos.y - this.player.position.y);
      const falloff = Math.max(0.5, 1 - 0.5 * (dist / WEAPONS[weapon].range));
      const crit = Math.random() < 0.12 ? 1.6 : 1;
      const damage = WEAPONS[weapon].damage * crit * falloff;
      const knockDir = angle;
      const { hits, loot } = this.enemySystem.damageAtTile(tileX, tileY, radius, damage, knockDir);
      // Subtract ammo based on weapon.pellets for shotgun (handled by Player.update which already decremented 1)
      if (weapon === 'shotgun') {
        this.player.refill('shotgun', this.player.ammo.shotgun + 7);
      }
      if (hits.length) {
        this.gameAudio.playHit({ x: r.pos.x, y: r.pos.y, z: 0 });
      }
      for (const drop of loot) this.spawnLoot(drop);
    }
    this.gameAudio.playFire(weapon, pos);
    void pos;
  }

  /** Advances in-flight projectiles (rocket launcher) and resolves impacts
   *  against walls (collidesAt) or enemies (proximity check), detonating
   *  splash damage via explodeProjectile() on either. */
  private updateProjectiles(dt: number): void {
    if (!this.projectiles.length) return;
    const manifest = this.levelState.manifest;
    if (!manifest) return;
    const remaining: Projectile[] = [];
    for (const p of this.projectiles) {
      const def = WEAPONS[p.weapon];
      const nx = p.position.x + p.vx * dt;
      const ny = p.position.y + p.vy * dt;
      p.traveled += Math.hypot(p.vx * dt, p.vy * dt);

      let exploded = false;
      if (collidesAt(manifest.tiles, manifest.cellSize, nx, ny, 0.1)) {
        this.explodeProjectile(p.position, def);
        exploded = true;
      } else {
        for (const e of this.enemySystem.snapshots()) {
          if (e.state === 'DEAD') continue;
          if (Math.hypot(e.position.x - nx, e.position.y - ny) < 0.4) {
            this.explodeProjectile({ x: nx, y: ny }, def);
            exploded = true;
            break;
          }
        }
      }
      if (exploded || p.traveled > def.range) continue;
      p.position = { x: nx, y: ny };
      remaining.push(p);
    }
    this.projectiles = remaining;
  }

  /** Splash damage on rocket impact: damages every enemy within splashRadius
   *  (reusing the same EnemySystem.damageAtTile() the hitscan path uses, just
   *  with a larger radius) plus a falloff-scaled hit on the player themself —
   *  Doom-style rocket-jump risk. */
  private explodeProjectile(pos: { x: number; y: number }, def: WeaponDef): void {
    this.gameAudio.playExplosion({ x: pos.x, y: pos.y, z: 0 });
    const radius = def.splashRadius ?? 2;
    const tileX = Math.floor(pos.x);
    const tileY = Math.floor(pos.y);
    const { hits, loot } = this.enemySystem.damageAtTile(tileX, tileY, radius, def.damage, 0);
    if (hits.length) this.gameAudio.playHit({ x: pos.x, y: pos.y, z: 0 });
    for (const drop of loot) this.spawnLoot(drop);

    const distToPlayer = Math.hypot(pos.x - this.player.position.x, pos.y - this.player.position.y);
    if (distToPlayer < radius) {
      const falloff = 1 - distToPlayer / radius;
      this.player.damage(def.damage * 0.6 * falloff);
    }
  }

  private handleStep(amp: number): void {
    if (amp < 0.1) return;
    const manifest = this.levelState.data?.manifest;
    const surface = manifest
      ? surfaceAt(manifest.tiles, manifest.cellSize, this.player.position.x, this.player.position.y)
      : 'concrete';
    this.gameAudio.playStep({ x: this.player.position.x, y: this.player.position.y, z: 0 }, surface);
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
    const motionScale = this.settings.reduceMotion ? 0.3 : 1;
    const bobAmp = this.player.snapshot().walking * motionScale;
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

    if (this.hasWon && this.refs.win.hidden) {
      this.hud.showWinScreen(() => {
        this.shell.stop();
        void this.beginWithMenu();
      });
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
        index: e.kind === 'drone' ? 0 : e.kind === 'heavy' ? 1 : e.kind === 'ghost' ? 2 : e.kind === 'turret' ? 3 : 4,
        flicker: e.kind === 'ghost' ? 0.7 : undefined,
        scale: e.kind === 'boss' ? 1.6 : undefined,
      });
    }
    // In-flight rocket projectiles
    for (const p of this.projectiles) {
      const dx = p.position.x - this.player.position.x;
      const dy = p.position.y - this.player.position.y;
      sprites.push({
        position: p.position,
        dist: dx * dx + dy * dy,
        type: 'projectile',
        index: 0,
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
        if (inter.kind === 'credits')   spriteIndex = 4;
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
    this.player.refill('rocket_launcher', 4);
    this.deathAt = 0;
  }

  /** Top-level start menu dispatcher. */
  async beginWithMenu(): Promise<void> {
    const rec = listLevels();
    void rec;
    this.hud.showBootScreen({
      onNewGame: async () => {
        await this.audio.init();
        this.applySettings();
        this.gameAudio.prime();
        this.input.requestPointerLock();
        this.begin();
        this.startMenuAudio();
      },
      hasSave: !!await readSlot(SAVE_SLOT).catch(() => null),
      onContinue: async () => {
        await this.audio.init();
        this.applySettings();
        this.gameAudio.prime();
        await this.load();
        this.input.requestPointerLock();
        this.begin();
        this.startMenuAudio();
      },
    });
  }

  private startMenuAudio(): void {
    // Ambient bed (ambient bus) + tension layer (music bus), mixed by world.threat.
    setTimeout(() => this.gameAudio.startAmbient(), 400);
  }
}

export type _Unused = ListLevelsResult;
type ListLevelsResult = ReturnType<typeof listLevels>;
