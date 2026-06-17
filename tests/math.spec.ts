import { describe, it, expect } from 'vitest';
import { normalizeAngle, angleDelta, clamp, deg2rad, TAU } from '../src/engine/types';

describe('Math primitives', () => {
  it('normalizes angles into [0, 2π)', () => {
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo(1.5 * Math.PI);
    expect(normalizeAngle(TAU * 3)).toBeCloseTo(0);
    expect(normalizeAngle(0)).toBe(0);
  });

  it('angleDelta wraps in [-π, π]', () => {
    expect(angleDelta(0, 0.1)).toBeCloseTo(0.1);
    expect(angleDelta(0.1, 0)).toBeCloseTo(-0.1);
    expect(angleDelta(0, 3 * Math.PI)).toBeCloseTo(Math.PI);
  });

  it('clamps correctly', () => {
    expect(clamp(-3, 0, 5)).toBe(0);
    expect(clamp(7, 0, 5)).toBe(5);
    expect(clamp(2, 0, 5)).toBe(2);
  });

  it('deg2rad/rad2deg round-trip', () => {
    expect(deg2rad(180)).toBeCloseTo(Math.PI);
    expect(deg2rad(0)).toBe(0);
  });
});
