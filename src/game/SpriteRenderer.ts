import type { CameraState } from './MapRenderer';
import type { AssetLoader } from '../engine/Assets';
import type { EnemySnapshot } from './Enemy';

export type { EnemySnapshot };

export interface ItemSnapshotRef {
  id: string;
  kind: 'key' | 'medkit' | 'ammo' | 'data' | 'keycard_red' | 'keycard_blue';
  position: { x: number; y: number };
  label: string;
  stackable?: boolean;
}
export type ItemSnapshot = ItemSnapshotRef;

export interface SpriteRef {
  position: { x: number; y: number };
  /** Squared distance from camera (used for ordering & size). */
  dist: number;
  type: 'enemy' | 'item' | 'projectile';
  /** Index into atlas for that sprite type. */
  index: number;
  /** Optional anim frame tick. */
  frame?: number;
  /** If non-zero, blink in/out (e.g., ghost spawn). */
  flicker?: number;
  /** Size multiplier on top of the standard distance-based projection (e.g. boss). */
  scale?: number;
  /** Just-damaged white flash (FX feedback). */
  tint?: boolean;
  /** Dead entity: rendered darker, squashed, and sunk toward the floor. */
  dead?: boolean;
}

/** Camera-relative projection for a single billboard entity. */
interface Projected {
  xCenter: number;
  yCenter: number;
  width: number;
  height: number;
  dist: number;
  bearing: number;   // signed angle from camera forward to entity (-π..π)
  behind: boolean;
  occluded: boolean;
}

/**
 * SpriteRenderer — projects billboard entities onto the screen
 * using the raycaster's per-column z-buffer to decide occlusion.
 *
 * Improvements over v0.1:
 *   - Single source of projective math (projectSprite())
 *   - Aspect-correct sprite height (texHeight) via canvas ratio
 *   - Off-screen culling before draw
 *   - Clean behind-camera handling (no upside-down ghosts)
 *   - Aspect-ratio passed by caller (viewport)
 */
export class SpriteRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  readonly canvas: HTMLCanvasElement;
  width = 0;
  height = 0;
  /** Asset loader reference kept for future sprite-frame pipelines. */
  private readonly _assets: AssetLoader;

  constructor(canvas: HTMLCanvasElement, assets: AssetLoader) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this._assets = assets;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }

  /**
   * Project a single sprite to screen coordinates using camera math.
   *
   * We transform world deltas into camera-relative space, then multiply by `tan(bearing)`
   * to get horizontal screen offset (classic DOOM trick). Far objects are smaller.
   * If the entity sits behind the camera (bearing outside ±FOV/2 + π/2), we mark
   * `behind=true` so the caller can skip it cleanly without flip-backs.
   */
  private project(s: SpriteRef, cam: CameraState, zBuffer: Float32Array): Projected {
    const tx = s.position.x - cam.px;
    const ty = s.position.y - cam.py;
    const distSq = s.dist;
    // Guard against zero/near-zero distance (entity at camera position)
    if (distSq <= 1e-8) {
      return {
        xCenter: this.width / 2,
        yCenter: this.height / 2,
        width: 0,
        height: 0,
        dist: 0,
        bearing: 0,
        behind: true,
        occluded: true,
      };
    }
    const dist = Math.sqrt(distSq);
    // Bearing, normalized to [-π, π]
    let bearing = Math.atan2(ty, tx) - cam.angle;
    bearing = Math.atan2(Math.sin(bearing), Math.cos(bearing));
    const behind = Math.abs(bearing) > Math.PI / 2 + cam.fov / 2;

    // Distance scaling for size — clamp minimum distance to avoid huge sprites
    // when an entity passes extremely close to the camera.
    const clampedDist = Math.max(dist, 0.25);
    const scale = (1 / clampedDist) * (s.scale ?? 1);
    const heightPx = Math.min(this.height * 2, (this.height * scale) * 0.9);
    const widthPx = heightPx;

    // Projected screen X (relative to camera forward)
    // Guard against division by zero if fov is 0 or very small
    const halfFov = Math.max(1e-4, cam.fov / 2);
    const proj = (this.width / 2) / Math.tan(halfFov);
    // Clamp bearing to avoid tan blowing up near ±π/2
    const maxBearing = Math.PI / 2 - 1e-4;
    const clampedBearing = Math.max(-maxBearing, Math.min(maxBearing, bearing));
    const xCenter = (this.width / 2) + Math.tan(clampedBearing) * proj;
    const yCenter = this.height / 2 + cam.pitch * this.height;

    // Z-buffer occlusion test (sample column at projected center)
    const col = Math.max(0, Math.min(this.width - 1, Math.round(xCenter)));
    // The z-buffer stores *perpendicular* distances to wall hits (smaller = wall
    // is closer to camera).  The sprite's Euclidean `dist` is too large when it
    // sits at a screen edge (bearing away from center), so we convert it to the
    // same perpendicular metric: perpDist = dist * cos(bearing).  A sprite is
    // occluded only when a wall is closer than the sprite itself; the old
    // `zBuffer > spriteDist` comparison was both inverted (it hid sprites that
    // were in front of walls and showed ones behind them) and used the wrong
    // distance metric, letting distant enemies render through walls.
    const perpDist = dist * Math.max(0, Math.cos(bearing));
    const occluded = !behind && (zBuffer[col] + 0.05 < perpDist);

    return {
      xCenter,
      yCenter,
      width: widthPx,
      height: heightPx,
      dist,
      bearing,
      behind,
      occluded,
    };
  }

  render(
    cam: CameraState,
    zBuffer: Float32Array,
    sprites: SpriteRef[],
    atlas: { enemies: HTMLCanvasElement[]; items: HTMLCanvasElement[]; weapons: HTMLCanvasElement[]; projectiles: HTMLCanvasElement[] },
  ): void {
    void this._assets;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Sort back-to-front; tie-break by index for stable ordering
    const sorted = sprites.slice().sort((a, b) => {
      if (b.dist !== a.dist) return b.dist - a.dist;
      if (a.type !== b.type) return a.type < b.type ? -1 : 1;
      return a.index - b.index;
    });

    for (const s of sorted) {
      // Fast off-screen culling — too close, behind, or too far
      if (s.dist < 0.04 || s.dist > 60 * 60) continue;
      const proj = this.project(s, cam, zBuffer);
      if (proj.behind) continue;
      if (proj.occluded) continue;
      if (proj.xCenter < -proj.width || proj.xCenter > this.width + proj.width) continue;

      const atlasArr = s.type === 'enemy' ? atlas.enemies : s.type === 'item' ? atlas.items : s.type === 'projectile' ? atlas.projectiles : atlas.weapons;
      const img = atlasArr[s.index];
      if (!img) continue;
      const alpha = s.flicker ? ((Date.now() % 200) < 100 ? s.flicker : 0) : 1;

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.imageSmoothingEnabled = false;
      let drawY = proj.yCenter - proj.height / 2;
      let drawH = proj.height;
      if (s.dead) {
        // Corpse: squashed toward the floor, dimmed — reads as down, not idle.
        drawH = proj.height * 0.35;
        drawY = proj.yCenter + proj.height / 2 - drawH;
        this.ctx.globalAlpha = alpha * 0.55;
        this.ctx.filter = 'brightness(0.45) saturate(0.5)';
      } else if (s.tint) {
        // Hit flash: momentary overbright pop so landed shots read instantly.
        this.ctx.filter = 'brightness(2.4) saturate(0.4)';
      }
      this.ctx.drawImage(
        img, 0, 0, img.width, img.height,
        proj.xCenter - proj.width / 2,
        drawY,
        proj.width, drawH,
      );
      if (s.type === 'item') {
        this.ctx.font = '10px ui-monospace, monospace';
        this.ctx.fillStyle = '#aaff39';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('item', proj.xCenter, proj.yCenter - proj.height / 2 - 6);
      }
      this.ctx.restore();
    }
  }
}
