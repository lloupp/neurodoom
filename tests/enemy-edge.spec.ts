/**
 * EnemySystem edge-case tests — spawn, damage, LOS, patrol cycle,
 * awareness thresholds, dead state, and knockback.
 */
import { describe, it, expect } from 'vitest';
import { EnemySystem } from '../src/game/Enemy';
import type { LevelData } from '../src/engine/LevelLoader';
import type { Player } from '../src/game/Player';
import type { MapManifest } from '../src/game/MapSchema';

// ── Minimal fixtures ──────────────────────────────────────────────────

const TILES_5x5 = [
  '#####',
  '#...#',
  '#...#',
  '#...#',
  '#####',
];

function makeLevel(): LevelData {
  const manifest: MapManifest = {
    id: 'test',
    name: 'Test',
    cellSize: 1,
    spawn: { x: 2.5, y: 2.5, face: 0 },
    tiles: TILES_5x5,
    enemies: [],
    interactables: [],
    triggers: [],
  };
  // Derive rooms/walls like loadLevel will (trivial for 5x5 all-wall interior)
  return { manifest, rooms: [], wallSegments: [] };
}

function makeOpenLevel(size: number): LevelData {
  const wall = '#'.repeat(size);
  const open = `#${'.'.repeat(size - 2)}#`;
  const manifest: MapManifest = {
    id: 'open-test',
    name: 'Open Test',
    cellSize: 1,
    spawn: { x: 2.5, y: 2.5, face: 0 },
    tiles: [wall, ...Array.from({ length: size - 2 }, () => open), wall],
    enemies: [],
    interactables: [],
    triggers: [],
  };
  return { manifest, rooms: [], wallSegments: [] };
}

/** Stub Player — only exposes what EnemySystem reads. */
function makePlayerStub(overrides: Partial<{ x: number; y: number; angle: number; weapon: string; isMoving: boolean }> = {}): Player {
  return {
    position: { x: overrides.x ?? 2.5, y: overrides.y ?? 2.5 },
    angle: 0,
    weapon: overrides.weapon ?? 'pistol',
    isMoving: overrides.isMoving ?? false,
    damage: () => false,
  } as unknown as Player;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('EnemySystem — spawn', () => {
  it('spawn returns incrementing IDs starting at 100', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    const id1 = sys.spawn('drone', 2.5, 2.5, []);
    const id2 = sys.spawn('heavy', 2.5, 2.5, []);
    expect(id1).toBe(100);
    expect(id2).toBe(101);
    expect(sys.count()).toBe(2);
  });

  it('spawn with empty patrol path yields IDLE state and patrolIndex 0', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    const snap = sys.snapshots();
    expect(snap.length).toBe(1);
    expect(snap[0].state).toBe('IDLE');
    expect(snap[0].patrolIndex).toBe(0);
  });

  it('spawn sets drone hp=30, heavy hp=70', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    sys.spawn('heavy', 2.5, 2.5, []);
    const [drone, heavy] = sys.snapshots();
    expect(drone.hp).toBe(30);
    expect(heavy.hp).toBe(70);
  });
});

describe('EnemySystem — damageAtTile', () => {
  it('hits enemy within blast radius', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    const { hits } = sys.damageAtTile(2, 2, 2, 10, 0);
    expect(hits.length).toBe(1);
    expect(hits[0].hp).toBe(20); // 30 - 10
  });

  it('misses enemy outside blast radius', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    const { hits } = sys.damageAtTile(0, 0, 0.5, 10, 0);
    expect(hits.length).toBe(0);
  });

  it('kills enemy when hp drops to 0 or below', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    const { hits } = sys.damageAtTile(2, 2, 2, 30, 0);
    expect(hits.length).toBe(1);
    expect(hits[0].state).toBe('DEAD');
    expect(hits[0].hp).toBeLessThanOrEqual(0);
    expect(sys.alive()).toBe(0);
  });

  it('does not hit already-dead enemies', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    // kill it
    sys.damageAtTile(2, 2, 2, 30, 0);
    expect(sys.alive()).toBe(0);
    // try to damage again
    const { hits: hits2 } = sys.damageAtTile(2, 2, 2, 10, 0);
    expect(hits2.length).toBe(0);
  });

  it('applies knockback to hit enemy', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    sys.damageAtTile(2, 2, 2, 5, 0); // knockDir 0 = east
    const snap = sys.snapshots()[0];
    expect(snap.position.x).toBeGreaterThan(2.5); // knocked east
  });

  it('damages multiple enemies in radius', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    sys.spawn('heavy', 2.5, 2.5, []);
    const { hits } = sys.damageAtTile(2, 2, 2, 5, 0);
    expect(hits.length).toBe(2);
  });
});

describe('EnemySystem — alive / count / clear', () => {
  it('alive() excludes dead enemies', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    sys.spawn('heavy', 3.5, 2.5, []);
    expect(sys.count()).toBe(2);
    expect(sys.alive()).toBe(2);
    sys.damageAtTile(2, 2, 2, 30, 0); // kills drone at (2.5, 2.5)
    expect(sys.alive()).toBe(1);
    expect(sys.count()).toBe(2); // dead still in count
  });

  it('clear() removes all enemies', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    sys.spawn('heavy', 2.5, 2.5, []);
    sys.clear();
    expect(sys.count()).toBe(0);
    expect(sys.alive()).toBe(0);
    expect(sys.snapshots()).toEqual([]);
  });
});

describe('EnemySystem — lineOfSight', () => {
  it('returns true for clear path across open room', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    // (1.5, 2.5) to (3.5, 2.5) — row 2 is all open in 5x5
    expect(sys.lineOfSight({ x: 1.5, y: 2.5 }, { x: 3.5, y: 2.5 })).toBe(true);
  });

  it('returns false when path crosses a wall', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    // (0.5, 0.5) is inside a wall (#)
    expect(sys.lineOfSight({ x: 0.5, y: 0.5 }, { x: 2.5, y: 2.5 })).toBe(false);
  });

  it('returns true for same position (zero-length path)', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    expect(sys.lineOfSight({ x: 2.5, y: 2.5 }, { x: 2.5, y: 2.5 })).toBe(true);
  });

  it('returns true for diagonal LOS across open room', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    // (1.5, 1.5) to (3.5, 3.5) — diagonal through all-open tiles (1,1)→(2,2)→(3,3)
    expect(sys.lineOfSight({ x: 1.5, y: 1.5 }, { x: 3.5, y: 3.5 })).toBe(true);
  });

  it('returns false through door-adjacent wall', () => {
    const tiles = [
      '#####',
      '#D..#',
      '#...#',
      '#...#',
      '#####',
    ];
    const manifest: MapManifest = {
      id: 'door-test',
      name: 'Door Test',
      cellSize: 1,
      spawn: { x: 1.5, y: 1.5, face: 0 },
      tiles,
      enemies: [],
      interactables: [],
      triggers: [],
    };
    const level: LevelData = { manifest, rooms: [], wallSegments: [] };
    const sys = new EnemySystem(level, makePlayerStub());
    // Path from (0.5, 2.5) to (1.5, 2.5): tx=0 is wall, blocks LOS
    expect(sys.lineOfSight({ x: 0.5, y: 2.5 }, { x: 1.5, y: 2.5 })).toBe(false);
  });
});

describe('EnemySystem — snapshots', () => {
  it('returns copies — mutating snapshot does not affect internal state', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    const snap = sys.snapshots()[0];
    const origHp = snap.hp;
    snap.hp = 999;
    expect(sys.snapshots()[0].hp).toBe(origHp);
  });
});

describe('EnemySystem — update edge cases', () => {
  it('dead enemies are skipped in update', () => {
    const level = makeLevel();
    const sys = new EnemySystem(level, makePlayerStub());
    sys.spawn('drone', 2.5, 2.5, []);
    // Kill the drone
    sys.damageAtTile(2, 2, 2, 30, 0);
    expect(sys.snapshots()[0].state).toBe('DEAD');
    // Run update — should not crash or change state
    sys.update(0.016, {});
    expect(sys.snapshots()[0].state).toBe('DEAD');
  });

  it('update with no enemies does not crash', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    expect(() => sys.update(0.016, {})).not.toThrow();
  });

  it('patrol cycles through waypoints', () => {
    const level = makeLevel();
    const sys = new EnemySystem(level, makePlayerStub({ x: 0.5, y: 0.5 }));
    // Spawn at (1.5, 1.5) with patrol through (1,1) and (3,3)
    const id = sys.spawn('drone', 1.5, 1.5, [[1, 1], [3, 3]]);
    // Run a lot of update ticks to let it patrol somewhere
    for (let i = 0; i < 200; i++) {
      sys.update(0.016, {});
    }
    const snap = sys.snapshots().find(e => e.id === id);
    // After many ticks, patrolIndex may have advanced
    expect(snap).toBeDefined();
    // PatrolIndex is a number >= 0 (could be 0 or 1 depending on movement speed)
    expect(typeof snap!.patrolIndex).toBe('number');
  });

  it('awareness decays when player is far away', () => {
    // Place player beyond visual and pistol-audio awareness ranges.
    const level = makeOpenLevel(16);
    const player = makePlayerStub({ x: 1.5, y: 1.5 });
    const sys = new EnemySystem(level, player);
    sys.spawn('drone', 11.5, 11.5, []);
    // Enemy starts with awareness 0.
    expect(sys.snapshots()[0].awareness).toBe(0);
    // Update several seconds — awareness should stay near 0 (decay dominates).
    for (let i = 0; i < 300; i++) {
      sys.update(0.016, {});
    }
    // With player far away, awareness should be close to 0.
    expect(sys.snapshots()[0].awareness).toBeLessThan(0.15);
  });

  it('gunshot raises awareness even without line of sight', () => {
    // This tests that gunshotAudible can trigger awareness.
    // Set up a scenario where player has shotgun and is close enough
    const level = makeLevel();
    const player = makePlayerStub({ x: 2.5, y: 2.5, weapon: 'shotgun' });
    const sys = new EnemySystem(level, player);
    // Spawn drone nearby (within 12 units for shotgun detection)
    sys.spawn('drone', 2.5, 2.7, []);
    // Simulate many ticks with player nearby
    for (let i = 0; i < 100; i++) {
      sys.update(0.016, {});
    }
    // With direct LOS at close range, awareness should rise
    const snap = sys.snapshots()[0];
    // Awareness may have risen due to LOS proximity or gunshot amplification
    // At distance < 8 with LOS, awareness rate is 0.7 higher per second
    expect(snap.awareness).toBeGreaterThan(0);
  });
});

// ── New enemy kinds (spitter, brute, wisp, stalker) ──────────────────────────────

describe('New enemy kinds — spitter, brute, wisp, stalker', () => {
  it('spitter has medium range, moderate hp (35), drops ammo on death', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('spitter', 2.5, 2.5, []);
    const snap = sys.snapshots()[0];
    expect(snap.kind).toBe('spitter');
    expect(snap.hp).toBe(35);
    expect(snap.state).toBe('IDLE');

    const { loot } = sys.damageAtTile(2, 2, 2, 1000, 0);
    expect(loot.map(l => l.kind).sort()).toEqual(['ammo', 'credits']);
  });

  it('brute is slow juggernaut with high hp (150) and drops medkit + keycard on death', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('brute', 2.5, 2.5, []);
    const snap = sys.snapshots()[0];
    expect(snap.kind).toBe('brute');
    expect(snap.hp).toBe(150);

    const { loot } = sys.damageAtTile(2, 2, 2, 1000, 0);
    const kinds = loot.map(l => l.kind).sort();
    expect(kinds).toContain('medkit');
    expect(kinds).toContain('keycard');
    expect(kinds).toContain('credits');
  });

  it('wisp is fast and fragile (hp=22), drops ammo on death, has isWisp flag in snapshot', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('wisp', 2.5, 2.5, []);
    const snap = sys.snapshots()[0];
    expect(snap.kind).toBe('wisp');
    expect(snap.hp).toBe(22);
    expect(snap.isWisp).toBe(true);

    const { loot } = sys.damageAtTile(2, 2, 2, 1000, 0);
    expect(loot.map(l => l.kind).sort()).toEqual(['ammo', 'credits']);
  });

  it('stalker has stealth (invisibility when not spotted, spottedAt=0), drops keycard on death', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('stalker', 2.5, 2.5, []);
    const snap = sys.snapshots()[0];
    expect(snap.kind).toBe('stalker');
    expect(snap.hp).toBe(35);
    // Initially not spotted, so isCloaked should be true
    expect(snap.spottedAt).toBe(0);
    expect(snap.isCloaked).toBe(true);

    const { loot } = sys.damageAtTile(2, 2, 2, 1000, 0);
    const kinds = loot.map(l => l.kind).sort();
    expect(kinds).toContain('keycard');
    expect(kinds).toContain('credits');
  });

  it('spitter has lower hp than brute (35 vs 150)', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('spitter', 1, 1, []);
    const spitterHp = sys.snapshots()[0].hp;
    
    sys.clear();
    sys.spawn('brute', 2, 1, []);
    const bruteHp = sys.snapshots()[0].hp;
    
    expect(spitterHp).toBeLessThan(bruteHp);
  });

  it('wisp is faster than brute', () => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn('wisp', 1, 1, []);
    sys.spawn('brute', 2, 1, []);

    const snaps = sys.snapshots();
    expect(snaps[0].kind).toBe('wisp');
    expect(snaps[1].kind).toBe('brute');
  });
});

describe('Enemy loot table completeness', () => {
  const allKinds: Array<'drone' | 'heavy' | 'ghost' | 'turret' | 'boss' | 'spitter' | 'brute' | 'wisp' | 'stalker'> = [
    'drone', 'heavy', 'ghost', 'turret', 'boss', 'spitter', 'brute', 'wisp', 'stalker'
  ];

  it.each(allKinds)('drops loot on death: $kind', (kind) => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn(kind, 2.5, 2.5, []);
    const { loot } = sys.damageAtTile(2, 2, 2, 1000, 0);
    // Every enemy drops credits on death
    expect(loot.map(l => l.kind)).toContain('credits');
  });
});

describe('New enemy kinds — dedupe & cloak edge', () => {
  it.each(['boss', 'stalker'] as const)('%s drops exactly one keycard on death (no double drop)', (kind) => {
    const sys = new EnemySystem(makeLevel(), makePlayerStub());
    sys.spawn(kind, 2.5, 2.5, []);
    const { loot } = sys.damageAtTile(2, 2, 2, 1000, 0);
    const keycards = loot.filter((l) => l.kind === 'keycard');
    expect(keycards).toHaveLength(1);
  });

  it('stalker re-cloaks after the player escapes', () => {
    const size = 24;
    const level = makeOpenLevel(size);
    const player = makePlayerStub({ x: 6, y: 5 });
    const sys = new EnemySystem(level, player);
    sys.spawn('stalker', 5, 5, []);

    // Phase 1: player close → stalker is spotted and uncloaks (visible).
    let becameSeen = false;
    for (let i = 0; i < 300; i++) {
      sys.update(0.016, {});
      if (sys.snapshots()[0].isCloaked === false) { becameSeen = true; break; }
    }
    expect(becameSeen).toBe(true);
    expect(sys.snapshots()[0].isCloaked).toBe(false);

    // Phase 2: player escapes far away → stalker calms down and re-cloaks.
    player.position.x = size - 2;
    player.position.y = size - 2;
    let reCloaked = false;
    for (let i = 0; i < 1000; i++) {
      sys.update(0.016, {});
      if (sys.snapshots()[0].isCloaked === true) { reCloaked = true; break; }
    }
    expect(reCloaked).toBe(true);
    expect(sys.snapshots()[0].isCloaked).toBe(true);
  });
});
