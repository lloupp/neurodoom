import { isSolid, textureStyleFor, loadLevel, type LevelData } from '../engine/LevelLoader';
import type { MapManifest } from './MapSchema';

// re-exports for convenience
export { isSolid, textureStyleFor, loadLevel };
export type { LevelData };

/** Convert world (x, y) to tile coords. */
export function worldToTile(x: number, y: number, cell: number): { tx: number; ty: number } {
  return { tx: Math.floor(x / cell), ty: Math.floor(y / cell) };
}

/** AABB vs solid tiles — fast slab test, classic Doom approach. */
export function collidesAt(
  rawTiles: string[],
  cell: number,
  px: number,
  py: number,
  radius: number,
): boolean {
  const minX = Math.floor((px - radius) / cell);
  const maxX = Math.floor((px + radius) / cell);
  const minY = Math.floor((py - radius) / cell);
  const maxY = Math.floor((py + radius) / cell);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const ch = rawTiles[ty]?.[tx];
      if (!ch) continue;
      if (isSolid(ch) || ch === 'D') {
        const tileCenterX = tx * cell + cell / 2;
        const tileCenterY = ty * cell + cell / 2;
        const cx = Math.max(tileCenterX - cell / 2, Math.min(px, tileCenterX + cell / 2));
        const cy = Math.max(tileCenterY - cell / 2, Math.min(py, tileCenterY + cell / 2));
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
  }
  return false;
}

/** Try to move — return a corrected position on collision (sliding). */
export function tryMove(
  tiles: string[],
  cell: number,
  fromX: number,
  fromY: number,
  dx: number,
  dy: number,
  radius: number,
): { x: number; y: number } {
  const nx = fromX + dx;
  const ny = fromY + dy;
  if (!collidesAt(tiles, cell, nx, fromY, radius)) fromX = nx;
  if (!collidesAt(tiles, cell, fromX, ny, radius)) fromY = ny;
  return { x: fromX, y: fromY };
}

export type Surface = 'concrete' | 'metal' | 'organic';

/** Walkable floor variants that carry a distinct footstep sound (SPEC 4.2).
 *  Lowercase so they stay non-solid (see isSolid) while their uppercase
 *  counterparts ('M', 'O') remain solid wall/hazard tiles. */
const SURFACE_BY_TILE: Record<string, Surface> = { g: 'metal', w: 'organic' };

/** Footstep surface under a world position (SPEC 4.2: step audio palette by surface). */
export function surfaceAt(tiles: string[], cell: number, x: number, y: number): Surface {
  const tx = Math.floor(x / cell);
  const ty = Math.floor(y / cell);
  const ch = tiles[ty]?.[tx];
  return (ch && SURFACE_BY_TILE[ch]) || 'concrete';
}

export type LevelRegistryEntry = {
  id: string;
  name: string;
  load: () => Promise<MapManifest>;
};

const registry: LevelRegistryEntry[] = [];

export const LEVELS: LevelRegistryEntry[] = registry;

export function registerLevel(entry: LevelRegistryEntry): void {
  registry.push(entry);
}
