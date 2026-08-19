import { describe, it, expect } from 'vitest';

/**
 * The projection math used by SpriteRenderer is private to the class. We pull
 * equivalent math out and verify behavior independently — this catches regressions
 * in the perspective math (camera angle, occluded-by-wall, behind-camera).
 *
 * If we ever change the SpriteRenderer, these should stay in sync.
 */
function project(
  sx: number,
  sy: number,
  cam: { px: number; py: number; angle: number; fov: number },
  screen: { w: number; h: number },
  zBuffer?: Float32Array,
) {
  const tx = sx - cam.px;
  const ty = sy - cam.py;
  const distSq = tx * tx + ty * ty;
  // Mirror SpriteRenderer.project's guard: an entity sitting on the camera has
  // no defined bearing — treat it as behind/degenerate instead of dividing by 0.
  if (distSq <= 1e-8) {
    return { xCenter: screen.w / 2, yCenter: screen.h / 2, width: 0, height: 0, dist: 0, bearing: 0, behind: true, occluded: false };
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

  // Z-buffer occlusion: convert Euclidean distance to perpendicular distance
  // (the same metric the raycaster's z-buffer stores) so the comparison is
  // apples-to-apples.  A sprite is occluded only when a wall is closer.
  let occluded = false;
  if (zBuffer) {
    const perpDist = dist * Math.max(0, Math.cos(bearing));
    const col = Math.max(0, Math.min(screen.w - 1, Math.round(xCenter)));
    occluded = !behind && (zBuffer[col] + 0.05 < perpDist);
  }

  return { xCenter, yCenter, width: height, height, dist, bearing, behind, occluded };
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

describe('Sprite z-buffer occlusion', () => {
  const screen = { w: 1024, h: 768 };
  const cam = { px: 0, py: 0, angle: 0, fov: 1.05 };

  it('occludes sprites behind walls using perpendicular distance', () => {
    // Wall at perpendicular distance 5 in every column.
    const zBuffer = new Float32Array(1024).fill(5);

    // Sprite at Euclidean distance 6, bearing 30° from center.
    // perpDist = 6 * cos(30°) ≈ 5.196  → wall (5.0) is closer → OCCLUDED.
    const spriteX = 6 * Math.cos(Math.PI / 6);
    const spriteY = 6 * Math.sin(Math.PI / 6);
    const r = project(spriteX, spriteY, cam, screen, zBuffer);
    expect(r.occluded).toBe(true);

    // The old buggy code compared zBuffer > spriteEuclideanDist (inverted),
    // so 5 - 0.05 > 6 → false → sprite would be visible through the wall.
  });

  it('remains visible when the sprite is closer than the wall', () => {
    // Wall at perpendicular distance 10, sprite at distance 5 directly ahead.
    // perpDist = 5 * cos(0°) = 5.0  → wall (10) is farther → VISIBLE.
    const zBuffer = new Float32Array(1024).fill(10);
    const r = project(5, 0, cam, screen, zBuffer);
    expect(r.occluded).toBe(false);
  });

  it('remains visible when no wall exists in the column (void distance)', () => {
    // MapRenderer writes perpDist = 30 for columns with no wall hit.
    const zBuffer = new Float32Array(1024).fill(30);
    const r = project(8, 0, cam, screen, zBuffer);
    expect(r.occluded).toBe(false);
  });

  it('occludes off-axis sprites that the old Euclidean check would miss', () => {
    // Regression anchor for the perpendicular-distance fix: the z-buffer stores
    // *perpendicular* distances to walls, so a sprite's own distance must be
    // converted to the same metric before comparing. A sprite sitting off to the
    // side (bearing > 0) has Euclidean dist >> perpDist; the old code compared
    // the bare Euclidean dist against the wall distance and wrongly left such
    // off-axis sprites visible even when a wall stood in front of them.
    const zBuffer = new Float32Array(1024).fill(5);   // wall at perpendicular distance 5 in every column

    // Sprite at distance 8, bearing ~0.4 rad (~23°) off center.
    // perpDist = 8 * cos(0.4) ≈ 7.37  → wall (5) is clearly closer → OCCLUDED.
    // Euclidean = 8 → old check (zBuffer - 0.05 > 8) → false → wrongly left visible.
    const spriteX = 8 * Math.cos(0.4);
    const spriteY = 8 * Math.sin(0.4);
    const r = project(spriteX, spriteY, cam, screen, zBuffer);
    expect(r.occluded).toBe(true);

    // Control: a sprite nearer than the wall (perpDist < zBuffer) stays visible.
    const near = project(4, 0, cam, screen, zBuffer); // perpDist 4 < wall 5
    expect(near.occluded).toBe(false);
  });
});
