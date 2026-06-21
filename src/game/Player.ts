import { tryMove } from './Level';
import type { LevelData } from './Level';
import type { CameraState } from './MapRenderer';
import type { Input } from '../engine/Input';
import { deg2rad, clamp, TAU, normalizeAngle } from '../engine/types';

export interface PlayerStats {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  credits: number;
}

export interface PlayerSnapshot extends CameraState {
  stats: PlayerStats;
  weapon: WeaponId;
  ammo: Record<WeaponId, number>;
  inventory: string[];
  isMoving: boolean;
  walking: number;  // 0..1 audio amplitude
  bobPhase: number;
}

export type WeaponId = 'pistol' | 'shotgun' | 'pulse_rifle';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  damage: number;
  fireRate: number;       // shots/s
  spread: number;         // radians
  pellets: number;
  range: number;          // tiles
  recoilPitch: number;    // visual kick
  recoilYaw: number;
  ammoType: 'light' | 'heavy' | 'energy' | 'none';
  ammoCapacity: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol:      { id: 'pistol',      name: 'VanBrck-7 Pistol',  damage: 18, fireRate: 4,  spread: 0.012, pellets: 1, range: 22, recoilPitch: 0.04, recoilYaw: 0.02, ammoType: 'light', ammoCapacity: 12 },
  shotgun:     { id: 'shotgun',     name: 'HX Disruptor',      damage: 9,  fireRate: 1.4,spread: 0.18,  pellets: 8, range: 12, recoilPitch: 0.08, recoilYaw: 0.05, ammoType: 'heavy', ammoCapacity: 6 },
  pulse_rifle: { id: 'pulse_rifle', name: 'SHIVA Pulse Cannon', damage: 24, fireRate: 7,  spread: 0.02,  pellets: 1, range: 28, recoilPitch: 0.05, recoilYaw: 0.025,ammoType: 'energy', ammoCapacity: 30 },
};

export class Player {
  readonly id = 1;
  position: { x: number; y: number };
  angle: number;        // radians; 0 = east, increases CCW
  pitch: number;
  fov: number;
  stats: PlayerStats;
  weapon: WeaponId = 'pistol';
  ammo: Record<WeaponId, number> = { pistol: 36, shotgun: 12, pulse_rifle: 60 };
  readonly inventory = new Set<string>();
  isMoving = false;
  bobPhase = 0;
  private cooldown = 0;
  private bobAmp = 0;
  private readonly radius: number;
  private recentFootstep = 0;
  private staminaRegen = 30;     // per second when not sprinting
  private staminaDrain = 35;     // per second when sprinting
  private mouseSensitivity = 0.0022;

  constructor(spawn: { x: number; y: number; face: number }, radius = 0.18) {
    this.position = { x: spawn.x, y: spawn.y };
    this.angle = deg2rad(spawn.face);
    this.pitch = 0;
    this.fov = 1.05;
    this.radius = radius;
    this.stats = { hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, credits: 0 };
  }

  setSensitivity(v: number): void { this.mouseSensitivity = v; }

  apply(p: PlayerSnapshot): void {
    this.position.x = p.px; this.position.y = p.py;
    this.angle = p.angle;
    this.pitch = p.pitch;
    this.fov = p.fov;
    this.weapon = p.weapon;
    this.ammo = { ...p.ammo };
    this.stats = { ...p.stats };
    this.inventory.clear();
    for (const it of p.inventory) this.inventory.add(it);
  }

  snapshot(): PlayerSnapshot {
    return {
      px: this.position.x,
      py: this.position.y,
      angle: this.angle,
      pitch: this.pitch,
      fov: this.fov,
      stats: { ...this.stats },
      weapon: this.weapon,
      ammo: { ...this.ammo },
      inventory: Array.from(this.inventory),
      isMoving: this.isMoving,
      walking: this.bobAmp,
      bobPhase: this.bobPhase,
    };
  }

  setInventory(items: string[]): void {
    this.inventory.clear();
    for (const it of items) this.inventory.add(it);
    void this.inventory;  // satisfies Set iteration requirement under strict target
  }

  addInventory(item: string): void {
    this.inventory.add(item);
  }

  removeInventory(item: string): void {
    this.inventory.delete(item);
  }

  damage(dmg: number): boolean {  // returns fatal
    this.stats.hp = Math.max(0, this.stats.hp - dmg);
    return this.stats.hp <= 0;
  }

  heal(amount: number): void {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  refill(weapon: WeaponId, count: number): void {
    this.ammo[weapon] = Math.min(WEAPONS[weapon].ammoCapacity * 2, count);
  }

  camera(): CameraState {
    return {
      px: this.position.x,
      py: this.position.y,
      angle: this.angle,
      pitch: this.pitch,
      fov: this.fov,
    };
  }

  /** Apply input + level collision to player state. Returns any callbacks for events. */
  update(level: LevelData, dt: number, input: ReturnType<Input['consume']>, callbacks: { fire: (w: WeaponId) => void; step: (amp: number) => void }): { fired: boolean; weaponId?: WeaponId; recoil: number } {
    const tiles = level.manifest.tiles;
    const cell  = level.manifest.cellSize;

    // Mouse look
    this.angle = normalizeAngle(this.angle - input.mouseDX * this.mouseSensitivity);
    this.pitch = clamp(this.pitch + input.mouseDY * this.mouseSensitivity * 0.5, -0.5, 0.5);

    // Stamina bookkeeping
    const sprint = (input.forward || input.backward) && (input.fire || input.aim);
    if (sprint && this.stats.stamina > 1) {
      this.stats.stamina = Math.max(0, this.stats.stamina - this.staminaDrain * dt);
    } else {
      this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina + this.staminaRegen * dt);
    }
    const speed = sprint && this.stats.stamina > 1 ? 5.4 : 3.0;
    const turnSpeed = 0; // mouse-only turning (Doom style)

    // Movement
    let mx = 0;
    let my = 0;
    if (input.forward)  my += 1;
    if (input.backward) my -= 1;
    if (input.strafeL)  mx -= 1;
    if (input.strafeR)  mx += 1;
    const movLen = Math.hypot(mx, my);
    if (movLen > 0) {
      mx /= movLen; my /= movLen;
    }

    // Apply rotation to movement vector
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);
    const wx = (my * cosA - mx * sinA) * speed * dt;
    const wy = (my * sinA + mx * cosA) * speed * dt;

    const before = { ...this.position };
    const moved = tryMove(tiles, cell, this.position.x, this.position.y, wx, wy, this.radius);
    const displaced = Math.hypot(moved.x - before.x, moved.y - before.y);

    this.isMoving = displaced > 0.005;
    if (this.isMoving) {
      this.bobPhase += dt * (sprint ? 13 : 9);
      this.bobAmp = clamp(displaced / (dt * speed), 0, 1);
      this.recentFootstep -= dt;
      if (this.recentFootstep <= 0) {
        callbacks.step(this.bobAmp);
        this.recentFootstep = sprint ? 0.32 : 0.45;
      }
    } else {
      this.bobAmp *= Math.max(0, 1 - dt * 6);
    }

    this.position.x = moved.x;
    this.position.y = moved.y;

    // Fire handling
    this.cooldown -= dt;
    let recoil = 0;
    let fired = false;
    if (input.fire && this.cooldown <= 0) {
      const w = WEAPONS[this.weapon];
      if (this.ammo[this.weapon] > 0 || w.ammoType === 'none') {
        this.ammo[this.weapon] = Math.max(0, this.ammo[this.weapon] - 1);
        this.cooldown = 1 / w.fireRate;
        recoil = w.recoilPitch;
        callbacks.fire(this.weapon);
        fired = true;
      }
    }
    if (recoil > 0) {
      this.pitch = clamp(this.pitch - recoil, -0.6, 0.6);
    }

    void TAU;
    void turnSpeed;
    return { fired, weaponId: fired ? this.weapon : undefined, recoil };
  }

  /** Switch ammo/active weapon. `use` is 1..6 from 1–6 keys (mapping: 1=pistol 2=shotgun 3=pulseRifle). */
  setWeapon(id: WeaponId): void {
    this.weapon = id;
  }
}
