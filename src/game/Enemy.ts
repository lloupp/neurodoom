import type { LevelData } from './Level';
import type { Player } from './Player';
import { deg2rad, normalizeAngle, clamp, angleDelta } from '../engine/types';

export type EnemyState = 'IDLE' | 'PATROL' | 'ALERT' | 'CHASE' | 'ATTACK' | 'RETREAT' | 'DEAD';

export interface LootDrop {
  position: { x: number; y: number };
  kind: 'ammo' | 'medkit' | 'keycard' | 'credits';
}

/** Ambient + emissive-screen light at a world position (SPEC 4.4: light-modulated
 *  vision cones). Floors near an 'S' (emissive screen) wall tile are brightly lit;
 *  far from any screen, ambient gloom dominates and enemies are slower to spot
 *  a player moving through it. Returns 0.25 (dark) .. 1 (lit). */
export function lightLevelAt(tiles: string[], cell: number, x: number, y: number): number {
  const tx = Math.floor(x / cell);
  const ty = Math.floor(y / cell);
  const radius = 5;
  let light = 0.35; // ambient gloom floor
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (tiles[ty + dy]?.[tx + dx] === 'S') {
        const dist = Math.hypot(dx, dy);
        light += Math.max(0, 1 - dist / radius) * 0.6;
      }
    }
  }
  return clamp(light, 0.25, 1);
}

export type EnemyKind = 'drone' | 'heavy' | 'ghost' | 'turret';

/** Max HP / base speed / armor multiplier per enemy kind. `ghost` is a fast,
 *  fragile harasser (high-frequency low-damage melee-range attacks, flickers
 *  in the renderer); `turret` is a stationary, armored gun emplacement with
 *  long engagement range and zero patrol/chase movement. */
const MAX_HP: Record<EnemyKind, number> = { drone: 30, heavy: 70, ghost: 18, turret: 90 };
const BASE_SPEED: Record<EnemyKind, number> = { drone: 1.7, heavy: 1.3, ghost: 2.6, turret: 0 };
const ARMOR: Record<EnemyKind, number> = { drone: 1, heavy: 0.75, ghost: 1.3, turret: 0.6 };

export interface EnemySnapshot {
  id: number;
  position: { x: number; y: number };
  angle: number;
  kind: EnemyKind;
  hp: number;
  state: EnemyState;
  awareness: number;
  spottedAt: number;
  patrolIndex: number;
}

interface InternalEnemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  position: { x: number; y: number };
  angle: number;
  state: EnemyState;
  patrolPath: Array<{ x: number; y: number }>;
  patrolIndex: number;
  awareness: number;    // 0..1
  spottedAt: number;
  attackCooldown: number;
  retreatUntil: number;
  stateSince: number;
}

export class EnemySystem {
  private nextId = 100;
  private enemies: InternalEnemy[] = [];
  private timeTick = 0;

  constructor(private readonly level: LevelData, private readonly player: Player) {}

  spawn(kind: EnemyKind, x: number, y: number, patrol: Array<[number, number]>): number {
    const id = this.nextId++;
    this.enemies.push({
      id,
      kind,
      hp: MAX_HP[kind],
      position: { x, y },
      angle: 0,
      state: 'IDLE',
      patrolPath: patrol.map(([px, py]) => ({ x: px + 0.5, y: py + 0.5 })),
      patrolIndex: 0,
      awareness: 0,
      spottedAt: 0,
      attackCooldown: 0,
      retreatUntil: 0,
      stateSince: 0,
    });
    return id;
  }

  count(): number { return this.enemies.length; }
  alive(): number { return this.enemies.filter((e) => e.state !== 'DEAD').length; }

  snapshots(): EnemySnapshot[] {
    return this.enemies.map((e) => ({
      id: e.id,
      position: { x: e.position.x, y: e.position.y },
      angle: e.angle,
      kind: e.kind,
      hp: e.hp,
      state: e.state,
      awareness: e.awareness,
      spottedAt: e.spottedAt,
      patrolIndex: e.patrolIndex,
    }));
  }

  damageAtTile(x: number, y: number, radius: number, amount: number, knockDir: number): { hits: EnemySnapshot[]; loot: LootDrop[] } {
    const hits: EnemySnapshot[] = [];
    const loot: LootDrop[] = [];
    for (const e of this.enemies) {
      const dx = e.position.x - (x + 0.5);
      const dy = e.position.y - (y + 0.5);
      const r2 = radius * radius;
      if (dx * dx + dy * dy <= r2 && e.state !== 'DEAD') {
        e.hp -= amount * ARMOR[e.kind];
        e.position.x += Math.cos(knockDir) * 0.06;
        e.position.y += Math.sin(knockDir) * 0.06;
        if (e.hp <= 0) {
          e.state = 'DEAD';
          // Loot on death (SPEC 4.4 + new kinds): credits from everything;
          // medkits from drones, ammo from heavies/turrets, keycards from
          // heavies only; ghosts are scavenged husks (credits only).
          const pos = { ...e.position };
          if (e.kind === 'drone') {
            loot.push({ position: { ...pos }, kind: 'medkit' });
          } else if (e.kind === 'heavy' || e.kind === 'turret') {
            loot.push({ position: { ...pos }, kind: 'ammo' });
          }
          loot.push({ position: { ...pos }, kind: 'credits' });
          if (e.kind === 'heavy') loot.push({ position: { ...pos }, kind: 'keycard' });
        } else if (e.hp < MAX_HP[e.kind] * 0.25 && e.state !== 'RETREAT') {
          e.state = 'RETREAT';
          e.retreatUntil = 2.5;
        }
        hits.push(this.snap(e));
      }
    }
    return { hits, loot };
  }

  private snap(e: InternalEnemy): EnemySnapshot {
    return {
      id: e.id, position: { ...e.position }, angle: e.angle,
      kind: e.kind, hp: e.hp, state: e.state, awareness: e.awareness,
      spottedAt: e.spottedAt, patrolIndex: e.patrolIndex,
    };
  }

  update(dt: number, callbacks: {
    onAlertChanged?: (e: InternalEnemy) => void;
    onAttack?: (e: InternalEnemy) => void;
    onShootAt?: (e: InternalEnemy, target: { x: number; y: number }) => void;
  }): void {
    this.timeTick += dt;
    const player = this.player;
    const level = this.level;

    for (const e of this.enemies) {
      if (e.state === 'DEAD') continue;
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      e.retreatUntil = Math.max(0, e.retreatUntil - dt);
      e.stateSince += dt;

      // Awareness from line-of-sight
      const dx = player.position.x - e.position.x;
      const dy = player.position.y - e.position.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      const los = this.lineOfSight(e.position, player.position);
      const footstepAudible =
        dist < 5 && player.isMoving && los;
      const gunshotAudible =
        dist < (distSq > 0 ? 8 : 0) + 4 * (player.weapon === 'shotgun' ? 1 : 0);

      // Light-modulated vision (SPEC 4.4): the LOS gain is scaled by how lit the
      // player's tile is, so a player lurking away from emissive screens is
      // harder to spot even in plain sight.
      const light = los ? lightLevelAt(level.manifest.tiles, level.manifest.cellSize, player.position.x, player.position.y) : 1;
      const awarenessGain = (los && dist < 8 ? 0.7 * light : 0) + (footstepAudible ? 0.05 : 0) + (gunshotAudible ? 0.8 : 0);
      e.awareness = clamp(e.awareness + awarenessGain * dt - 0.05 * dt, 0, 1);

      const settled = e.state !== 'ATTACK' && e.state !== 'RETREAT';
      if (settled) {
        if (e.awareness > 0.6 && e.state !== 'CHASE') {
          e.state = 'CHASE';
          e.spottedAt = this.timeTick;
          e.stateSince = 0;
          callbacks.onAlertChanged?.(e);
        } else if (e.awareness >= 0.3 && e.awareness <= 0.6 && e.state !== 'ALERT' && e.state !== 'CHASE') {
          e.state = 'ALERT';
          e.stateSince = 0;
          callbacks.onAlertChanged?.(e);
        } else if (e.awareness < 0.2 && (e.state === 'ALERT' || e.state === 'CHASE')) {
          e.state = e.patrolPath.length > 0 ? 'PATROL' : 'IDLE';
          e.stateSince = 0;
        } else if (e.state === 'IDLE' && e.stateSince > 1.2) {
          e.state = e.patrolPath.length > 0 ? 'PATROL' : 'IDLE';
          e.stateSince = 0;
        }
      }

      // Speed/behavior per state
      const baseSpeed = BASE_SPEED[e.kind];
      // Ghosts harass at melee range; turrets are stationary but engage from
      // afar; drones/heavies keep the original close-quarters thresholds.
      const engageRange = e.kind === 'turret' ? 9 : e.kind === 'ghost' ? 1.6 : 2.5;
      const sustainRange = e.kind === 'turret' ? 11 : e.kind === 'ghost' ? 2.6 : 4;
      let speed = 0;
      let targetAngle = e.angle;
      switch (e.state) {
        case 'IDLE': {
          speed = 0;
          break;
        }
        case 'ALERT': {
          speed = 0;
          targetAngle = Math.atan2(player.position.y - e.position.y, player.position.x - e.position.x);
          break;
        }
        case 'PATROL': {
          speed = baseSpeed * 0.6;
          const goal = e.patrolPath[e.patrolIndex];
          if (!goal) break;
          const gdx = goal.x - e.position.x;
          const gdy = goal.y - e.position.y;
          if (gdx * gdx + gdy * gdy < 0.04) {
            e.patrolIndex = (e.patrolIndex + 1) % e.patrolPath.length;
          } else {
            targetAngle = Math.atan2(gdy, gdx);
          }
          break;
        }
        case 'CHASE': {
          speed = baseSpeed;
          const pdx = player.position.x - e.position.x;
          const pdy = player.position.y - e.position.y;
          targetAngle = Math.atan2(pdy, pdx);
          if (dist < engageRange && this.lineOfSight(e.position, player.position)) {
            e.state = 'ATTACK';
            e.attackCooldown = 0;
            callbacks.onAttack?.(e);
          }
          break;
        }
        case 'ATTACK': {
          if (dist > sustainRange || !this.lineOfSight(e.position, player.position)) {
            e.state = 'CHASE';
            break;
          }
          const pdx = player.position.x - e.position.x;
          const pdy = player.position.y - e.position.y;
          targetAngle = Math.atan2(pdy, pdx);
          if (e.attackCooldown <= 0) {
            // Fire at player hitscan — caller hooks emissive red tracer
            callbacks.onShootAt?.(e, { x: player.position.x, y: player.position.y });
            e.attackCooldown = e.kind === 'drone' ? 0.6 : e.kind === 'heavy' ? 0.9 : e.kind === 'turret' ? 1.3 : 0.35;
            const dmg = e.kind === 'heavy' ? 6 : e.kind === 'turret' ? 9 : e.kind === 'ghost' ? 4 : 3;
            this.player.damage(dmg);
          }
          break;
        }
        case 'RETREAT': {
          speed = baseSpeed;
          if (e.retreatUntil <= 0) e.state = 'CHASE';
          else targetAngle = Math.atan2(e.position.y - player.position.y, e.position.x - player.position.x);
          break;
        }
        default: break;
      }

      // Smooth turn toward target
      const delta = angleDelta(e.angle, targetAngle);
      e.angle = normalizeAngle(e.angle + clamp(delta, -3, 3) * dt * 3);

      // Move forward in facing direction
      if (speed > 0) {
        const tryX = e.position.x + Math.cos(e.angle) * speed * dt;
        const tryY = e.position.y + Math.sin(e.angle) * speed * dt;
        const ch = level.manifest.tiles[Math.floor(tryY / level.manifest.cellSize)]?.[Math.floor(tryX / level.manifest.cellSize)];
        if (!ch || ch === '.' || ch === 'D') {
          e.position.x = tryX;
          e.position.y = tryY;
        }
      }
    }
    void this;
  }

  /** Ray vs tile grid; quick horizontal + vertical step. */
  lineOfSight(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
    const cell = this.level.manifest.cellSize;
    const tiles = this.level.manifest.tiles;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const steps = Math.ceil(Math.hypot(dx, dy) / 0.1);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = from.x + dx * t;
      const py = from.y + dy * t;
      const tx = Math.floor(px / cell);
      const ty = Math.floor(py / cell);
      const ch = tiles[ty]?.[tx];
      if (ch && ch !== '.' && ch !== 'D') return false;
    }
    return true;
  }

  clear(): void { this.enemies = []; }
}

// silence unused
export type _unused = { deg2rad: typeof deg2rad };
