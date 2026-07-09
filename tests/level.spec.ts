import { describe, it, expect } from 'vitest';
import { isSolid, textureStyleFor, loadLevel } from '../src/engine/LevelLoader';
import type { MapManifest } from '../src/game/MapSchema';

const fixture: MapManifest = {
  id: 'fixture',
  name: 'Fixture',
  cellSize: 1,
  spawn: { x: 1.5, y: 1.5, face: 0 },
  tiles: [
    '######',
    '#....#',
    '#....#',
    '#....#',
    '#....#',
    '######',
  ],
  enemies: [],
  interactables: [],
  triggers: [],
};

describe('Level loader', () => {
  it('flags meta tiles as solid', () => {
    expect(isSolid('#')).toBe(true);
    expect(isSolid('P')).toBe(true);
    expect(isSolid('M')).toBe(true);
    expect(isSolid('C')).toBe(true);
    expect(isSolid('.')).toBe(false);
    expect(isSolid('D')).toBe(false);
  });

  it('assigns texture style indices', () => {
    expect(textureStyleFor('M')).toBe(0);
    expect(textureStyleFor('C')).toBe(1);
    expect(textureStyleFor('P')).toBe(2);
    expect(textureStyleFor('#')).toBe(2);
    expect(textureStyleFor('X')).toBe(3);
  });

  it('extracts at least one room from an open interior', () => {
    const data = loadLevel(fixture);
    expect(data.rooms.length).toBeGreaterThanOrEqual(1);
    expect(data.rooms.some((r) => r.w >= 4 && r.h >= 4)).toBe(true);
  });
});

// ── Level 2: Sector 9 — Garden ──

import level2 from '../src/game/levels/Level2';

describe('Level 2 — Sector 9 Garden', () => {
  it('has a valid manifest structure', () => {
    expect(level2.id).toBe('sector_9');
    expect(level2.name).toContain('Garden');
    expect(level2.cellSize).toBe(1);
    expect(level2.spawn.x).toBeGreaterThanOrEqual(1);
    expect(level2.spawn.y).toBeGreaterThanOrEqual(1);
  });

  it('has a rectangular tile grid (consistent row widths)', () => {
    const widths = new Set(level2.tiles.map((r) => r.length));
    expect(widths.size).toBe(1);
    const w = level2.tiles[0].length;
    expect(w).toBe(40);
    expect(level2.tiles.length).toBeGreaterThanOrEqual(25);
  });

  it('spawns on an open tile', () => {
    const spawnTile = level2.tiles[Math.floor(level2.spawn.y)]?.[Math.floor(level2.spawn.x)];
    expect(spawnTile).toBeDefined();
    expect(isSolid(spawnTile!)).toBe(false);
  });

  it('contains 12+ rooms after flood-compaction', () => {
    const data = loadLevel(level2);
    expect(data.rooms.length).toBeGreaterThanOrEqual(12);
  });

  it('has 4 enemy spawns with valid patrol paths', () => {
    expect(level2.enemies.length).toBe(4);
    for (const e of level2.enemies) {
      expect(e.kind).toMatch(/^(drone|heavy)$/);
      expect(e.patrol.length).toBeGreaterThanOrEqual(3);
      for (const [px, py] of e.patrol) {
        expect(px).toBeGreaterThanOrEqual(0);
        expect(py).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('has 10+ interactables including terminals and audio logs', () => {
    expect(level2.interactables.length).toBeGreaterThanOrEqual(10);
    const terminals = level2.interactables.filter((i) => i.kind === 'terminal');
    const audioLogs = level2.interactables.filter((i) => i.kind === 'audio_log');
    expect(terminals.length).toBeGreaterThanOrEqual(3);
    expect(audioLogs.length).toBeGreaterThanOrEqual(2);
  });

  it('includes level-transition trigger in Level 1', async () => {
    const { default: level1 } = await import('../src/game/levels/Level1');
    const exitTrigger = level1.triggers.find((t) => t.type === 'set_flag' && (t.data as Record<string, unknown>)?.key === 'flag_exit_level');
    expect(exitTrigger).toBeDefined();
  });
});
