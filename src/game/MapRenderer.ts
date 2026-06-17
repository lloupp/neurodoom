import type { LevelData } from './Level';
import { textureStyleFor } from '../engine/LevelLoader';
import type { AssetLoader } from '../engine/Assets';
import type { Vec2 } from '../engine/types';
import { deg2rad, TAU } from '../engine/types';

export interface CameraState {
  /** player world position */
  px: number;
  py: number;
  /** facing angle, 0 = east, increases CCW (rad) */
  angle: number;
  /** vertical camera tilt (pitch, rad) - for headbob */
  pitch: number;
  /** FOV in radians (default ~1.047 ≈ 60°) */
  fov: number;
}

/**
 * MapRenderer — DDA column raycaster.
 * 
 * Per-pixel column scan: for each screen x, cast one ray, DDA-step through
 * the grid, find the wall hit, then paint a vertical slice of the wall's
 * texture, shaded by distance. Z-buffer (perpDistance array) is exposed to
 * the SpriteRenderer for ordering.
 */
export class MapRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  readonly canvas: HTMLCanvasElement;
  width = 0;
  height = 0;
  /** per-column perp distance, exposed to sprite system */
  zBuffer: Float32Array = new Float32Array(0);
  /** greyed column shading overlay — set by lighting/event systems */
  columnLight: Float32Array = new Float32Array(0);

  constructor(canvas: HTMLCanvasElement, private readonly assets: AssetLoader) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = cssW;
    this.height = cssH;
    this.zBuffer = new Float32Array(cssW);
    this.columnLight = new Float32Array(cssW).fill(1);
  }

  render(level: LevelData, cam: CameraState, weaponBob: number): void {
    const { manifest } = level;
    const tiles = manifest.tiles;
    const cell = manifest.cellSize;
    const w = this.width;
    const h = this.height;
    const atlas = this.assets.buildWallAtlas();

    // Sky gradient top of screen
    const sky = this.ctx.createLinearGradient(0, 0, 0, h / 2);
    sky.addColorStop(0, '#0a0f1a');
    sky.addColorStop(1, '#040608');
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(0, 0, w, h / 2);

    // Floor gradient bottom
    const floor = this.ctx.createLinearGradient(0, h / 2, 0, h);
    floor.addColorStop(0, '#080a0e');
    floor.addColorStop(1, '#020306');
    this.ctx.fillStyle = floor;
    this.ctx.fillRect(0, h / 2, w, h / 2);

    const camX = cam.angle;
    const halfFov = cam.fov / 2;

    // DDA per column
    for (let x = 0; x < w; x++) {
      const ndc = (2 * (x + 0.5)) / w - 1;     // -1..1
      const rayAngle = camX + ndc * halfFov;
      const dx = Math.cos(rayAngle);
      const dy = Math.sin(rayAngle);

      let mapX = Math.floor(cam.px / cell);
      let mapY = Math.floor(cam.py / cell);

      const deltaDistX = Math.abs(1 / (dx || 1e-9));
      const deltaDistY = Math.abs(1 / (dy || 1e-9));

      let stepX: number, stepY: number;
      let sideDistX: number, sideDistY: number;

      if (dx < 0) {
        stepX = -1;
        sideDistX = ((cam.px / cell) - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1 - (cam.px / cell)) * deltaDistX;
      }
      if (dy < 0) {
        stepY = -1;
        sideDistY = ((cam.py / cell) - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1 - (cam.py / cell)) * deltaDistY;
      }

      let hit = false;
      let side = 0;       // 0 = x side, 1 = y side
      let maxSteps = 64;
      while (!hit && maxSteps-- > 0) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        const ch = tiles[mapY]?.[mapX];
        if (ch && ch !== '.' && ch !== 'D') {
          hit = true;
        }
      }

      let perpDist: number;
      let wallX: number;            // wall intersect point
      let tileChar = '#';
      if (!hit) {
        // Render pure fog into the void
        perpDist = 30;
        wallX = 0;
      } else {
        if (side === 0) {
          perpDist = (sideDistX - deltaDistX);
        } else {
          perpDist = (sideDistY - deltaDistY);
        }
        perpDist *= cell;
        wallX = side === 0 ? (cam.py / cell + perpDist * dy / cell) : (cam.px / cell + perpDist * dx / cell);
        wallX -= Math.floor(wallX);
        tileChar = tiles[mapY]?.[mapX] ?? '#';
      }

      this.zBuffer[x] = perpDist;

      const lineHeight = (h / perpDist) * cell;
      const pitchPx = cam.pitch * h + weaponBob * 0.5;
      const drawStart = ((h - lineHeight) / 2) - pitchPx;
      const drawEnd = ((h + lineHeight) / 2) - pitchPx;

      if (lineHeight < h * 6 && tileChar !== '.') {
        const texIdx = textureStyleFor(tileChar);
        const tex = atlas[texIdx] ?? atlas[2];
        const texW = tex.width;
        const texH = tex.height;
        const texX = ((wallX * texW) | 0) % texW;

        // Distance shading
        const shade = Math.max(0.18, 1 - perpDist / 18);
        const sideShade = side === 1 ? 0.7 : 1;
        const light = this.columnLight[x] ?? 1;

        // Draw the column directly from the texture source
        this.ctx.save();
        this.ctx.globalAlpha = Math.min(1, shade * sideShade * light);
        // For lit panels/screens, keep emissive
        if (tileChar === 'S' || tileChar === 'X') this.ctx.globalAlpha = Math.max(0.5, this.ctx.globalAlpha);
        this.ctx.drawImage(tex, texX, 0, 1, texH, x, drawStart, 1, Math.max(1, drawEnd - drawStart));
        // For screens: overlay a subtle flicker by hue-shifting
        if (tileChar === 'S') {
          this.ctx.fillStyle = `rgba(75,227,255,${0.05 + ((Date.now() / 800) % 1) * 0.03})`;
          this.ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
        }
        this.ctx.restore();
      } else if (lineHeight >= h * 6) {
        // Sky/floor covers this column completely
        this.ctx.fillStyle = '#020306';
        this.ctx.fillRect(x, 0, 1, h);
      }

      // Floor and ceiling rasterization (cheap flat gradient based on row)
      if (perpDist < 14) {
        const floorY = drawEnd;
        // simple dithered floor
        const stripe = ((x + Math.floor(pitchPx)) & 1) === 0 ? 6 : 0;
        this.ctx.fillStyle = stripe ? '#101418' : '#080a0e';
        this.ctx.fillRect(x, floorY, 1, h - floorY);
      }
    }

    // Reset column light after each render (lighting sources rewrite this before render)
    this.columnLight.fill(1);
  }

  /** Cast ray from a screen coord; return world space impact. Used for hitscan weapons. */
  hitscan(level: LevelData, from: Vec2, angleRadians: number, maxRange = 24): { hit: boolean; pos: Vec2; distance: number; ch: string } {
    const tiles = level.manifest.tiles;
    const cell = level.manifest.cellSize;
    const dx = Math.cos(angleRadians);
    const dy = Math.sin(angleRadians);

    let x = from.x;
    let y = from.y;
    const step = 0.05;
    for (let t = 0; t < maxRange / step; t++) {
      x += dx * step;
      y += dy * step;
      const tx = Math.floor(x / cell);
      const ty = Math.floor(y / cell);
      const ch = tiles[ty]?.[tx];
      if (ch && ch !== '.' && ch !== 'D') {
        return { hit: true, pos: { x, y }, distance: Math.hypot(x - from.x, y - from.y), ch };
      }
    }
    return { hit: false, pos: { x, y }, distance: maxRange, ch: '' };
  }
  // silence unused imports
  protected _unused(): void {
    void deg2rad; void TAU;
  }
}
