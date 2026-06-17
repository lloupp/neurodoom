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
