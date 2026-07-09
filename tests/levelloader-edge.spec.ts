import { describe, it, expect } from 'vitest';
import { isSolid, textureStyleFor, loadLevel } from '../src/engine/LevelLoader';
import type { MapManifest } from '../src/game/MapSchema';

describe('isSolid', () => {
  it('flags all documented solid tiles', () => {
    expect(isSolid('#')).toBe(true);
    expect(isSolid('M')).toBe(true);
    expect(isSolid('P')).toBe(true);
    expect(isSolid('C')).toBe(true);
    expect(isSolid('X')).toBe(true);
    expect(isSolid('O')).toBe(true);
    expect(isSolid('S')).toBe(true);
  });

  it('treats open tiles as non-solid', () => {
    expect(isSolid('.')).toBe(false);
    expect(isSolid('D')).toBe(false);
  });

  it('treats unknown characters as non-solid', () => {
    expect(isSolid('Z')).toBe(false);
    expect(isSolid(' ')).toBe(false);
    expect(isSolid('')).toBe(false);
  });
});

describe('textureStyleFor', () => {
  it('maps all documented solid tile chars to correct indices', () => {
    expect(textureStyleFor('M')).toBe(0);
    expect(textureStyleFor('C')).toBe(1);
    expect(textureStyleFor('P')).toBe(2);
    expect(textureStyleFor('#')).toBe(2);  // default solid = panel
    expect(textureStyleFor('X')).toBe(3);
    expect(textureStyleFor('S')).toBe(4);
    expect(textureStyleFor('O')).toBe(5);
  });

  it('maps unknown chars to default panel style (2)', () => {
    expect(textureStyleFor('.')).toBe(2);
    expect(textureStyleFor('Z')).toBe(2);
    expect(textureStyleFor('D')).toBe(2);
  });
});

describe('loadLevel — floodCompactRoom edge cases', () => {
  it('returns no rooms for a fully solid map', () => {
    const manifest: MapManifest = {
      id: 'all-walls',
      name: 'All Walls',
      cellSize: 1,
      spawn: { x: 0.5, y: 0.5, face: 0 },
      tiles: ['####', '####', '####'],
      enemies: [],
      interactables: [],
      triggers: [],
    };
    const data = loadLevel(manifest);
    expect(data.rooms).toEqual([]);
  });

  it('handles single open tile map', () => {
    const manifest: MapManifest = {
      id: 'single-open',
      name: 'Single Open',
      cellSize: 1,
      spawn: { x: 0.5, y: 0.5, face: 0 },
      tiles: ['.'],
      enemies: [],
      interactables: [],
      triggers: [],
    };
    const data = loadLevel(manifest);
    expect(data.rooms.length).toBe(1);
    expect(data.rooms[0]).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('coalesces vertically adjacent rows of same width and alignment', () => {
    const manifest: MapManifest = {
      id: 'tall-room',
      name: 'Tall Room',
      cellSize: 1,
      spawn: { x: 1.5, y: 1.5, face: 0 },
      tiles: [
        '#####',
        '#...#',
        '#...#',
        '#...#',
        '#####',
      ],
      enemies: [],
      interactables: [],
      triggers: [],
    };
    const data = loadLevel(manifest);
    expect(data.rooms.length).toBeGreaterThanOrEqual(1);
    // The interior 3x3 block should coalesce into one room
    const big = data.rooms.find(r => r.w >= 3 && r.h >= 3);
    expect(big).toBeDefined();
    expect(big!.w).toBe(3);
    expect(big!.h).toBe(3);
  });

  it('does not coalesce rooms of different widths', () => {
    const manifest: MapManifest = {
      id: 'different-widths',
      name: 'Different Widths',
      cellSize: 1,
      spawn: { x: 0.5, y: 0.5, face: 0 },
      tiles: [
        '#..#',
        '#.#',
        '####',
      ],
      enemies: [],
      interactables: [],
      triggers: [],
    };
    const data = loadLevel(manifest);
    // Row 0 has a 2-wide run, Row 1 has a 1-wide run — should NOT coalesce
    expect(data.rooms.length).toBeGreaterThanOrEqual(2);
  });

  it('handles empty tile grid', () => {
    const manifest: MapManifest = {
      id: 'empty',
      name: 'Empty',
      cellSize: 1,
      spawn: { x: 0.5, y: 0.5, face: 0 },
      tiles: [],
      enemies: [],
      interactables: [],
      triggers: [],
    };
    const data = loadLevel(manifest);
    expect(data.rooms).toEqual([]);
  });

  it('treats D and P tiles as open for room detection', () => {
    const manifest: MapManifest = {
      id: 'door-panel-open',
      name: 'Door Panel',
      cellSize: 1,
      spawn: { x: 1.5, y: 1.5, face: 0 },
      tiles: [
        '####',
        '#DP#',
        '####',
      ],
      enemies: [],
      interactables: [],
      triggers: [],
    };
    const data = loadLevel(manifest);
    expect(data.rooms.length).toBeGreaterThanOrEqual(1);
  });
});

describe('loadLevel — wallSegment extraction', () => {
  it('extracts wall segments where solid meets open', () => {
    const manifest: MapManifest = {
      id: 'wall-seg',
      name: 'Wall Seg',
      cellSize: 1,
      spawn: { x: 1.5, y: 1.5, face: 0 },
      tiles: [
        '####',
        '#..#',
        '####',
      ],
      enemies: [],
      interactables: [],
      triggers: [],
    };
    const data = loadLevel(manifest);
    // Should have some wall segments (solid tiles adjacent to open)
    expect(data.wallSegments.length).toBeGreaterThan(0);
    // Each segment has from/to as [x,y] pairs
    for (const seg of data.wallSegments) {
      expect(seg.from.length).toBe(2);
      expect(seg.to.length).toBe(2);
    }
  });

  it('has no wall segments for a fully solid map', () => {
    const manifest: MapManifest = {
      id: 'no-walls',
      name: 'No Walls',
      cellSize: 1,
      spawn: { x: 0.5, y: 0.5, face: 0 },
      tiles: ['####', '####'],
      enemies: [],
      interactables: [],
      triggers: [],
    };
    const data = loadLevel(manifest);
    expect(data.wallSegments).toEqual([]);
  });
});
