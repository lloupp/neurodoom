import type { MapManifest } from '../game/MapSchema';

export interface LevelData {
  manifest: MapManifest;
  /** Adjacency derived at load — used by minimap/AI room awareness. */
  rooms: Array<{ x: number; y: number; w: number; h: number }>;
  /** Wall segments simplified for collision debug. */
  wallSegments: Array<{ from: [number, number]; to: [number, number] }>;
}

const COMPACT_LIST: Array<[number, string]> = [];

function floodCompactRoom(map: string[], w: number, h: number): Array<{ x: number; y: number; w: number; h: number }> {
  // Simple rectangular rooms: walk orthogonal runs of '.'; merge if matched.
  const rooms: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let y = 0; y < h; y++) {
    let runStart = -1;
    for (let x = 0; x <= w; x++) {
      const ch = map[y]?.[x] ?? '#';
      const open = ch === '.' || ch === 'D' || ch === 'P';
      if (open && runStart < 0) runStart = x;
      if ((!open || x === w) && runStart >= 0) {
        // build a per-row run; we'll dedupe per col pass next
        const end = x;
        rooms.push({ x: runStart, y, w: end - runStart, h: 1 });
        runStart = -1;
      }
    }
  }
  // Coalesce vertically adjacent runs of same width+aligned origin
  const used = new Set<number>();
  const result: typeof rooms = [];
  for (let i = 0; i < rooms.length; i++) {
    if (used.has(i)) continue;
    let cur = rooms[i];
    for (let j = i + 1; j < rooms.length; j++) {
      if (used.has(j)) continue;
      const o = rooms[j];
      if (o.x === cur.x && o.w === cur.w && o.y === cur.y + cur.h) {
        cur = { ...cur, h: cur.h + o.h };
        used.add(j);
      }
    }
    used.add(i);
    result.push(cur);
  }
  return result;
}

export function loadLevel(manifest: import('../game/MapSchema').MapManifest): LevelData {
  // Authors bring spawn + tile grid + interactions; we derive rooms for minimap.
  const h = manifest.tiles.length;
  const w = manifest.tiles[0]?.length ?? 0;
  const rooms = floodCompactRoom(manifest.tiles, w, h);
  const wallSegments: LevelData['wallSegments'] = [];
  // Naive wall extraction — we let MapRenderer handle the real DDA.
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const ch = manifest.tiles[y]?.[x] ?? '#';
      if (ch === '#' || ch === 'P' || ch === 'M' || ch === 'C' || ch === 'X') {
        const r = manifest.tiles[y]?.[x + 1] ?? '#';
        const d = manifest.tiles[y + 1]?.[x] ?? '#';
        if (r === '.') wallSegments.push({ from: [x + 1, y], to: [x + 1, y + 1] });
        if (d === '.') wallSegments.push({ from: [x, y + 1], to: [x + 1, y + 1] });
        void COMPACT_LIST;
      }
    }
  }
  return { manifest, rooms, wallSegments };
}

export function isSolid(ch: string): boolean {
  return ch === '#' || ch === 'M' || ch === 'P' || ch === 'C' || ch === 'X' || ch === 'O' || ch === 'S';
}

export function textureStyleFor(ch: string): number {
  // Indexes match AssetLoader.buildWallAtlas() order.
  switch (ch) {
    case 'M': return 0; // metal
    case 'C': return 1; // concrete
    case 'P': return 2; // panel
    case '#': return 2; // default solid behaves like panel
    case 'X': return 3; // circuit
    case 'S': return 4; // screen (emissive)
    case 'O': return 5; // organic
    default:  return 2;
  }
}
