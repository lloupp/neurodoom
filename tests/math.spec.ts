import { describe, it, expect } from 'vitest';
import { normalizeAngle, angleDelta, clamp, lerp, deg2rad, rad2deg, TAU } from '../src/engine/types';

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

describe('lerp', () => {
  it('returns start at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns end at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it('extrapolates beyond [0,1]', () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });

  it('works with negative ranges', () => {
    expect(lerp(-20, -10, 0.5)).toBe(-15);
  });

  it('no-ops when start === end', () => {
    expect(lerp(5, 5, 0.7)).toBe(5);
  });
});

describe('rad2deg', () => {
  it('converts π to 180', () => {
    expect(rad2deg(Math.PI)).toBeCloseTo(180);
  });

  it('converts 0 to 0', () => {
    expect(rad2deg(0)).toBe(0);
  });

  it('round-trips with deg2rad', () => {
    const angles = [0, 45, 90, 180, 270, 360];
    for (const deg of angles) {
      expect(rad2deg(deg2rad(deg))).toBeCloseTo(deg);
    }
  });
});

describe('normalizeAngle edge cases', () => {
  it('maps TAU to 0', () => {
    expect(normalizeAngle(TAU)).toBeCloseTo(0);
  });

  it('wraps large positive multiples', () => {
    expect(normalizeAngle(TAU * 5 + 0.5)).toBeCloseTo(0.5);
  });

  it('wraps large negative multiples', () => {
    expect(normalizeAngle(-TAU * 3 + 1)).toBeCloseTo(1);
  });

  it('preserves angles already in [0, 2π)', () => {
    expect(normalizeAngle(1.5)).toBeCloseTo(1.5);
  });

  it('normalizes π correctly', () => {
    expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe('angleDelta edge cases', () => {
  it('returns 0 for same angle', () => {
    expect(angleDelta(2.0, 2.0)).toBeCloseTo(0);
  });

  it('wraps short path across 0/2π boundary', () => {
    // From 355° to 5° should be +10° (short path, not -350°)
    const from = deg2rad(355);
    const to = deg2rad(5);
    const delta = angleDelta(from, to);
    expect(delta).toBeCloseTo(deg2rad(10), 5);
  });

  it('returns negative delta for reverse direction', () => {
    const delta = angleDelta(deg2rad(5), deg2rad(355));
    expect(delta).toBeCloseTo(deg2rad(-10), 5);
  });
});

describe('clamp edge cases', () => {
  it('returns lo when value is NaN', () => {
    // NaN comparisons are false, so both < lo and > hi fail → returns lo (first ternary)
    expect(clamp(NaN, 0, 10)).toBeNaN();
  });

  it('handles lo === hi', () => {
    expect(clamp(5, 3, 3)).toBe(3);
    expect(clamp(1, 3, 3)).toBe(3);
  });

  it('handles negative bounds', () => {
    expect(clamp(-5, -10, -3)).toBe(-5);
    expect(clamp(-15, -10, -3)).toBe(-10);
  });
});
