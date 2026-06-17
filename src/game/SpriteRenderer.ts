import type { CameraState } from './MapRenderer';
import type { AssetLoader } from '../engine/Assets';
import type { EnemySnapshot } from './Enemy';

// Re-export type for callers that import from SpriteRenderer
export type { EnemySnapshot };

export interface ItemSnapshotRef {
  id: string;
  kind: 'key' | 'medkit' | 'ammo' | 'data' | 'keycard_red' | 'keycard_blue';
  position: { x: number; y: number };
  label: string;
  stackable?: boolean;
}
export type ItemSnapshot = ItemSnapshotRef;

/**
 * SpriteRenderer — drops entities on top of the raycasted world.
 *
 * Each entity with a screen-pos is drawn with size = 1/distance (perspective).
 * Z-ordering uses the raycaster's per-column zbuffer — sprites get cut off
 * if they're behind the stored wall distance.
 */

export interface SpriteRef {
  position: { x: number; y: number };
  /** Distance from camera squared — used for ordering & size. */
  dist: number;
  type: 'enemy' | 'item';
  /** index into atlas */
  index: number;
  /** Optional anim frame tick. */
  frame?: number;
  /** If non-zero, blink in/out (e.g., ghost spawn). */
  flicker?: number;
}

export class SpriteRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  readonly canvas: HTMLCanvasElement;
  width = 0;
  height = 0;
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

  render(
    cam: CameraState,
    zBuffer: Float32Array,
    sprites: SpriteRef[],
    atlas: { enemies: HTMLCanvasElement[]; items: HTMLCanvasElement[]; weapons: HTMLCanvasElement[] },
  ): void {
    void this._assets;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Sort back-to-front (farthest first)
    const sorted = sprites.slice().sort((a, b) => b.dist - a.dist);

    for (const s of sorted) {
      const tx = s.position.x - cam.px;
      const ty = s.position.y - cam.py;
      const dist = Math.hypot(tx, ty);
      if (dist < 0.001) continue;

      // Camera-relative angle
      const ang = Math.atan2(ty, tx) - cam.angle;
      const correctedAng = Math.atan2(Math.sin(ang), Math.cos(ang));

      // Perspective projection
      const proj = (this.width / 2) / Math.tan(cam.fov / 2);
      const xCenter = (this.width / 2) + Math.tan(correctedAng) * proj;
      const yCenter = this.height / 2 + cam.pitch * this.height;

      const spriteHeight = (this.height / dist) * 0.9;
      const spriteWidth = spriteHeight;
      const x = xCenter - spriteWidth / 2;
      const y = yCenter - spriteHeight / 2;
      const col = Math.max(0, Math.min(this.width - 1, Math.round(xCenter)));

      if (zBuffer[col] - 0.05 > dist) continue; // occluded

      const atlas2 = s.type === 'enemy' ? atlas.enemies : s.type === 'item' ? atlas.items : atlas.weapons;
      const img = atlas2[s.index];
      if (!img) continue;
      const alpha = s.flicker ? ((Date.now() % 200) < 100 ? s.flicker : 0) : 1;

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(img, 0, 0, img.width, img.height, x, y, spriteWidth, spriteHeight);
      if (s.type === 'item') {
        this.ctx.font = '10px ui-monospace, monospace';
        this.ctx.fillStyle = '#aaff39';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('item', xCenter, y - 6);
      }
      this.ctx.restore();
    }
  }
}
