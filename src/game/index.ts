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
import { EnemySystem, type LootDrop } from './Enemy';
import { TerminalSystem, type LogTag } from './Terminal';
import type { MapTrigger } from './MapSchema';
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
  hackingTargetId: string | null = null;
  isHacking = false;
  private firedTriggers = new Set<string>();
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
    this.hud.onSelectWeapon = (id) => this.player.setWeapon(id);

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.spriteRenderer.resize();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.audio.suspend();
      else void this.audio.resume();
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
    if (panelOpen) {
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

  private lootSeq = 0;

  private spawnLoot(drop: LootDrop): void {
    const m = this.levelState.manifest;
    if (!m) return;
    m.interactables.push({
      id: `loot_${this.lootSeq++}`,
      kind: drop.kind,
      x: Math.floor(drop.position.x),
      y: Math.floor(drop.position.y),
      prompt: drop.kind === 'ammo' ? 'Salvaged ammo' : drop.kind === 'medkit' ? 'Salvaged medkit' : 'Salvaged keycard',
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
          const kind = tag.value.toLowerCase().includes('heavy') ? 'heavy' : 'drone';
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
        const kind = data.kind === 'heavy' ? 'heavy' : 'drone';
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
        if (typeof id === 'string') this.applyLogTags(this.terminalSystem.open(id));
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
    // Hitscan from center camera at slight random spread
    const spread = WEAPONS[weapon].spread;
    const angle = this.player.angle + (Math.random() - 0.5) * spread;
    const r = this.renderer.hitscan(this.levelState.data!, this.player.position, angle, WEAPONS[weapon].range);
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
    // Ambient bed (ambient bus) + tension layer (music bus), mixed by world.threat.
    setTimeout(() => this.gameAudio.startAmbient(), 400);
  }
}

export type _Unused = ListLevelsResult;
type ListLevelsResult = ReturnType<typeof listLevels>;
