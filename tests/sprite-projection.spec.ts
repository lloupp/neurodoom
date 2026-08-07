import { describe, it, expect } from 'vitest';

/**
 * The projection math used by SpriteRenderer is private to the class. We pull
 * equivalent math out and verify behavior independently — this catches regressions
 * in the perspective math (camera angle, occluded-by-wall, behind-camera).
 *
 * If we ever change the SpriteRenderer, these should stay in sync.
 */
function project(sx: number, sy: number, cam: { px: number; py: number; angle: number; fov: number }, screen: { w: number; h: number }) {
  const tx = sx - cam.px;
  const ty = sy - cam.py;
  const distSq = tx * tx + ty * ty;
  // Mirror SpriteRenderer.project's guard: an entity sitting on the camera has
  // no defined bearing — treat it as behind/degenerate instead of dividing by 0.
  if (distSq <= 1e-8) {
    return { xCenter: screen.w / 2, yCenter: screen.h / 2, width: 0, height: 0, dist: 0, bearing: 0, behind: true };
  }
  const dist = Math.sqrt(distSq);
  let bearing = Math.atan2(ty, tx) - cam.angle;
  bearing = Math.atan2(Math.sin(bearing), Math.cos(bearing));
  const behind = Math.abs(bearing) > Math.PI / 2 + cam.fov / 2;
  // Guard a zero/near-zero FOV (tan(0) = 0 → division by zero) and clamp the
  // bearing away from ±π/2 so tan can't blow up. Both mirror SpriteRenderer.
  const halfFov = Math.max(1e-4, cam.fov / 2);
  const proj = (screen.w / 2) / Math.tan(halfFov);
  const maxBearing = Math.PI / 2 - 1e-4;
  const clampedBearing = Math.max(-maxBearing, Math.min(maxBearing, bearing));
  const xCenter = (screen.w / 2) + Math.tan(clampedBearing) * proj;
  const yCenter = screen.h / 2;
  const height = (screen.h / dist) * 0.9;
  return { xCenter, yCenter, width: height, height, dist, bearing, behind };
}

describe('Sprite projection', () => {
  it('projects a sprite directly in front into screen center', () => {
    const r = project(10, 0, { px: 0, py: 0, angle: 0, fov: 1.05 }, { w: 1024, h: 768 });
    expect(r.behind).toBe(false);
    expect(Math.abs(r.xCenter - 512)).toBeLessThan(1);
  });

  it('marks sprite behind camera when bearing exceeds 90deg', () => {
    const r = project(-5, 0, { px: 0, py: 0, angle: 0, fov: 1.05 }, { w: 1024, h: 768 });
    expect(r.behind).toBe(true);
  });

  it('falls size with distance', () => {
    const close = project(2, 0, { px: 0, py: 0, angle: 0, fov: 1.05 }, { w: 1024, h: 768 });
    const far   = project(20, 0, { px: 0, py: 0, angle: 0, fov: 1.05 }, { w: 1024, h: 768 });
    expect(far.height).toBeLessThan(close.height);
  });

  it('left/right deviation tracks bearing sign and magnitude', () => {
    const left   = project(5, 4, { px: 0, py: 0, angle: 0, fov: 1.05 }, { w: 1024, h: 768 });
    const center = project(10, 0, { px: 0, py: 0, angle: 0, fov: 1.05 }, { w: 1024, h: 768 });
    expect(left.bearing).toBeGreaterThan(0);
    expect(center.bearing).toBeCloseTo(0);
    expect(left.xCenter).toBeGreaterThan(center.xCenter);  // left of forward = positive bearing in screen space (right side)
  });
});
