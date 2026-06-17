// Shared types — kept tiny on purpose.

export type EntityId = number;

export type Vec2 = { x: number; y: number };

export interface AABB {
  minX: number; minY: number;
  maxX: number; maxY: number;
}

export interface Watch<T> {
  (listener: (value: T) => void): () => void;
}

export type Listener<T> = (value: T) => void;

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rad2deg = (r: number) => (r * 180) / Math.PI;

export function normalizeAngle(r: number): number {
  let a = r % TAU;
  if (a < 0) a += TAU;
  return a;
}

export function angleDelta(from: number, to: number): number {
  const d = normalizeAngle(to) - normalizeAngle(from);
  return d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d;
}
