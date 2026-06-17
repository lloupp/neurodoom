import type { LevelData } from './Level';
import type { Player } from './Player';
import { deg2rad, normalizeAngle, clamp, angleDelta } from '../engine/types';

export type EnemyState = 'PATROL' | 'ALERT' | 'CHASE' | 'ATTACK' | 'RETREAT' | 'DEAD';

export interface EnemySnapshot {
  id: number;
  position: { x: number; y: number };
  angle: number;
  kind: 'drone' | 'heavy';
  hp: number;
  state: EnemyState;
  awareness: number;
  spottedAt: number;
  patrolIndex: number;
}

interface InternalEnemy {
  id: number;
  kind: 'drone' | 'heavy';
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

  spawn(kind: 'drone' | 'heavy', x: number, y: number, patrol: Array<[number, number]>): number {
    const id = this.nextId++;
    this.enemies.push({
      id,
      kind,
      hp: kind === 'drone' ? 30 : 70,
      position: { x, y },
      angle: 0,
      state: 'PATROL',
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

  damageAtTile(x: number, y: number, radius: number, amount: number, knockDir: number): EnemySnapshot[] {
    const hits: EnemySnapshot[] = [];
    for (const e of this.enemies) {
      const dx = e.position.x - (x + 0.5);
      const dy = e.position.y - (y + 0.5);
      const r2 = radius * radius;
      if (dx * dx + dy * dy <= r2 && e.state !== 'DEAD') {
        e.hp -= amount;
        e.position.x += Math.cos(knockDir) * 0.06;
        e.position.y += Math.sin(knockDir) * 0.06;
        if (e.hp <= 0) e.state = 'DEAD';
        hits.push(this.snap(e));
      }
    }
    return hits;
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

      const awarenessGain = (los && dist < 8 ? 0.7 : 0) + (footstepAudible ? 0.05 : 0) + (gunshotAudible ? 0.8 : 0);
      e.awareness = clamp(e.awareness + awarenessGain * dt - 0.05 * dt, 0, 1);

      if (e.awareness > 0.6 && e.state !== 'CHASE' && e.state !== 'ATTACK') {
        const prev = e.state;
        e.state = 'CHASE';
        e.spottedAt = this.timeTick;
        callbacks.onAlertChanged?.(e);
        void prev;
      }
      if (e.awareness < 0.2 && e.state === 'PATROL') {
        e.state = 'PATROL';
      }

      // Speed/behavior per state
      const baseSpeed = e.kind === 'drone' ? 1.7 : 1.3;
      let speed = 0;
      let targetAngle = e.angle;
      switch (e.state) {
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
          if (dist < 2.5 && this.lineOfSight(e.position, player.position)) {
            e.state = 'ATTACK';
            e.attackCooldown = 0;
            callbacks.onAttack?.(e);
          }
          break;
        }
        case 'ATTACK': {
          if (dist > 4 || !this.lineOfSight(e.position, player.position)) {
            e.state = 'CHASE';
            break;
          }
          const pdx = player.position.x - e.position.x;
          const pdy = player.position.y - e.position.y;
          targetAngle = Math.atan2(pdy, pdx);
          if (e.attackCooldown <= 0) {
            // Fire at player hitscan — caller hooks emissive red tracer
            callbacks.onShootAt?.(e, { x: player.position.x, y: player.position.y });
            e.attackCooldown = e.kind === 'drone' ? 0.6 : 0.9;
            this.player.damage(e.kind === 'heavy' ? 6 : 3);
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
      // lose target if no awareness long enough
      if (e.state === 'CHASE' && e.awareness < 0.2) e.state = 'PATROL';
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
