import { describe, it, expect } from 'vitest';
import { worldToTile, collidesAt, tryMove } from '../src/game/Level';

// 5x5 map: solid border, open interior
const TILES = [
  '#####',
  '#...#',
  '#...#',
  '#...#',
  '#####',
];
const CELL = 1;

describe('worldToTile', () => {
  it('converts world coords to tile indices', () => {
    const r = worldToTile(2.5, 1.5, CELL);
    expect(r.tx).toBe(2);
    expect(r.ty).toBe(1);
  });

  it('floors negative coords toward zero', () => {
    const r = worldToTile(-0.3, 0.1, CELL);
    expect(r.tx).toBe(-1);
    expect(r.ty).toBe(0);
  });

  it('maps the origin to tile 0,0', () => {
    const r = worldToTile(0, 0, CELL);
    expect(r.tx).toBe(0);
    expect(r.ty).toBe(0);
  });
});

describe('collidesAt', () => {
  it('does NOT collide when fully inside open area', () => {
    // Player at center of map (2.5, 2.5), radius 0.2 — well inside #### border
    expect(collidesAt(TILES, CELL, 2.5, 2.5, 0.2)).toBe(false);
  });

  it('collides when touching the north wall', () => {
    // Row 0 is all '#'. Player at y=1.1 with radius 0.2 reaches into row 0 territory.
    // y - radius = 0.9, which is in tile row 0 (solid)
    expect(collidesAt(TILES, CELL, 2.5, 1.05, 0.2)).toBe(true);
  });

  it('collides when touching the west wall', () => {
    // Col 0 is all '#'. Player at x=1.05 with radius 0.2 → x-radius = 0.85 → tile col 0
    expect(collidesAt(TILES, CELL, 1.05, 2.5, 0.2)).toBe(true);
  });

  it('does NOT collide with zero radius (point collision in open area)', () => {
    expect(collidesAt(TILES, CELL, 2.5, 2.5, 0)).toBe(false);
  });

  it('does NOT collide just inside the boundary', () => {
    // At x=1.3, radius 0.2 → minX = floor(1.1) = 1 (open). Should be safe.
    expect(collidesAt(TILES, CELL, 1.3, 2.5, 0.2)).toBe(false);
  });

  it('collides at map edge corner', () => {
    // Top-left corner interior: x=1.1, y=1.1, radius=0.15
    // minX=floor(0.95)=0 (solid), so collision
    expect(collidesAt(TILES, CELL, 1.1, 1.1, 0.15)).toBe(true);
  });

  it('collidesAt treats doors as collision boundaries (matching implementation)', () => {
    const map = [
      '#####',
      '#D..#',
      '#...#',
      '#...#',
      '#####',
    ];
    // Door at tile (1,1). collidesAt checks isSolid() OR ch==='D'
    // Player at (1.5,1.5) with radius 0.2 → minX=floor(1.3)=1 which is door 'D' → collides
    expect(collidesAt(map, CELL, 1.5, 1.5, 0.2)).toBe(true);
  });

  it('collidesAt does not collide near open tile orthogonal to door', () => {
    const map = [
      '#####',
      '#D..#',
      '#...#',
      '#...#',
      '#####',
    ];
    // Player at (2.5,1.5) near door but not overlapping it → tile at (2,1) is '.' so no collision
    expect(collidesAt(map, CELL, 2.5, 1.5, 0.2)).toBe(false);
  });
});

describe('tryMove', () => {
  it('moves freely in open space', () => {
    const r = tryMove(TILES, CELL, 2.5, 2.5, 0.5, 0, 0.2);
    expect(r.x).toBeCloseTo(3.0);
    expect(r.y).toBeCloseTo(2.5);
  });

  it('slides along X when Y is blocked', () => {
    // Moving diagonally toward a vertical wall (east wall, col 4).
    // X blocked by wall, Y is open → should slide along Y.
    const r = tryMove(TILES, CELL, 3.5, 2.5, 0.6, 0.3, 0.2);
    // X movement to 4.1 collides with wall at col 4, so X stays at 3.5
    // Y movement to 2.8 is open, so Y updates
    expect(r.x).toBe(3.5);  // X blocked (would put us in solid)
    expect(r.y).toBeCloseTo(2.8);  // Y slides
  });

  it('slides along Y when X is blocked', () => {
    // Moving diagonally toward a horizontal wall (south wall, row 4).
    const r = tryMove(TILES, CELL, 2.5, 3.5, 0.3, 0.6, 0.2);
    // X is open, Y would push into row 4 (solid)
    expect(r.x).toBeCloseTo(2.8);
    expect(r.y).toBe(3.5);  // Y blocked
  });

  it('stays put when both X and Y are blocked', () => {
    // Corner: both movements blocked
    const r = tryMove(TILES, CELL, 3.7, 3.7, 0.5, 0.5, 0.2);
    expect(r.x).toBe(3.7);
    expect(r.y).toBe(3.7);
  });

  it('allows movement with zero delta', () => {
    const r = tryMove(TILES, CELL, 2.5, 2.5, 0, 0, 0.2);
    expect(r.x).toBe(2.5);
    expect(r.y).toBe(2.5);
  });

  it('wall-slides against a corridor wall (Doom-style)', () => {
    // Player hugging the left wall of a corridor, moving diagonally left-forward.
    // The X component is blocked (into wall) but Y is free → slides along wall.
    const r = tryMove(TILES, CELL, 1.3, 2.5, -0.4, 0.5, 0.2);
    // dx=-0.4 would put us at x=0.9, radius 0.2 → minX=floor(0.7)=0 in col 0 (solid), blocked
    expect(r.x).toBe(1.3);  // X blocked
    expect(r.y).toBeCloseTo(3.0);  // Y slides forward
  });
});
