// Asset cache — procedural-first, with optional file URL fallback.

import { generateTileTexture } from './Procedural';

export type TextureStyle = 'metal' | 'concrete' | 'panel' | 'circuit' | 'screen' | 'organic';

export interface TextureAtlas {
  wallTextures: HTMLCanvasElement[];
  spriteTextures: HTMLCanvasElement[];
}

const TILE_SIZE = 64;

export class AssetLoader {
  private cache = new Map<string, HTMLCanvasElement>();

  textureFor(seed: number, style: TextureStyle): HTMLCanvasElement {
    const key = `${seed}:${style}:${TILE_SIZE}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const cv = generateTileTexture({
      size: TILE_SIZE,
      seed,
      style,
      baseColor: this.baseFor(style),
      accent: this.accentFor(style),
    });
    this.cache.set(key, cv);
    return cv;
  }

  buildWallAtlas(): HTMLCanvasElement[] {
    const styles: TextureStyle[] = ['metal', 'concrete', 'panel', 'circuit', 'screen', 'organic'];
    return styles.map((s, i) => this.textureFor(0xCA11 * (i + 1), s));
  }

  buildSpriteAtlas(): { enemies: HTMLCanvasElement[]; weapons: HTMLCanvasElement[]; items: HTMLCanvasElement[]; projectiles: HTMLCanvasElement[] } {
    return {
      enemies: [
        this.makeEnemySprite('#ff7090', 'patrol_drone'),
        this.makeEnemySprite('#ff4040', 'heavy_grunt'),
        this.makeEnemySprite('#4be3ff', 'ghost'),
        this.makeTurretSprite(),
      ],
      weapons: [
        this.makeWeaponSprite('pistol'),
        this.makeWeaponSprite('shotgun'),
        this.makeWeaponSprite('pulse_rifle'),
        this.makeWeaponSprite('rocket_launcher'),
      ],
      items: [
        this.makeItemSprite('#4be3ff', 'KEY'),
        this.makeItemSprite('#ffb048', 'MED'),
        this.makeItemSprite('#aaff39', 'AMO'),
        this.makeItemSprite('#ff3aa1', 'DAT'),
        this.makeItemSprite('#ffe24b', 'CRD'),
      ],
      projectiles: [
        this.makeProjectileSprite(),
      ],
    };
  }

  /** Stationary gun emplacement — a boxy console silhouette instead of the
   *  humanoid drone/heavy shape, so it reads as immobile at a glance. */
  private makeTurretSprite(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0a0d12';
    g.fillRect(24, 60, 80, 50);
    g.fillStyle = '#ffb048';
    g.fillRect(36, 70, 56, 24);
    g.fillStyle = '#0a0d12';
    g.fillRect(56, 30, 16, 40);
    g.fillStyle = '#ff4040';
    g.fillRect(58, 24, 12, 12);
    g.fillStyle = '#0a0d12';
    g.fillRect(16, 104, 96, 14);
    return cv;
  }

  /** In-flight rocket-launcher projectile (world-space billboard). */
  private makeProjectileSprite(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const glow = g.createRadialGradient(32, 32, 2, 32, 32, 26);
    glow.addColorStop(0, 'rgba(255,210,120,1)');
    glow.addColorStop(0.4, 'rgba(255,120,40,0.9)');
    glow.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fff6d8';
    g.beginPath();
    g.arc(32, 32, 5, 0, Math.PI * 2);
    g.fill();
    return cv;
  }

  private makeEnemySprite(baseColor: string, _kind: string): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0a0d12';
    g.fillRect(48, 20, 32, 90);
    g.fillRect(40, 70, 48, 30);
    g.fillStyle = baseColor;
    g.fillRect(56, 28, 16, 16);
    g.fillStyle = '#040608';
    g.fillRect(60, 34, 8, 4);
    g.fillStyle = '#0a0d12';
    g.fillRect(28, 50, 16, 40);
    g.fillRect(84, 50, 16, 40);
    g.fillRect(52, 110, 10, 18);
    g.fillRect(66, 110, 10, 18);
    g.fillStyle = baseColor;
    g.fillRect(50, 60, 28, 4);
    return cv;
  }

  private makeWeaponSprite(kind: string): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0a0d12';
    g.fillRect(20, 40, 220, 50);
    g.fillStyle = '#4be3ff';
    g.fillRect(60, 36, 32, 12);
    g.fillStyle = '#aaff39';
    g.fillRect(200, 30, 36, 30);
    if (kind === 'shotgun') g.fillRect(80, 20, 140, 16);
    if (kind === 'pulse_rifle') {
      g.fillStyle = '#ff3aa1';
      g.fillRect(120, 16, 80, 16);
    }
    if (kind === 'rocket_launcher') {
      g.fillStyle = '#5b6470';
      g.fillRect(60, 12, 150, 36);
      g.fillStyle = '#ffb048';
      g.fillRect(190, 18, 24, 24);
    }
    return cv;
  }

  private makeItemSprite(color: string, label: string): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#0a0d12';
    g.fillRect(8, 8, 48, 48);
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.strokeRect(8, 8, 48, 48);
    g.fillStyle = color;
    g.font = '14px ui-monospace, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 32, 36);
    return cv;
  }

  private baseFor(style: TextureStyle): string {
    switch (style) {
      case 'metal':    return '#5b6470';
      case 'concrete': return '#3c3f48';
      case 'panel':    return '#222a32';
      case 'circuit':  return '#0a0f12';
      case 'screen':   return '#040a0a';
      case 'organic':  return '#3a1018';
    }
  }

  private accentFor(style: TextureStyle): string {
    switch (style) {
      case 'metal':    return '#a8b4c4';
      case 'concrete': return '#5a606e';
      case 'panel':    return '#4be3ff';
      case 'circuit':  return '#aaff39';
      case 'screen':   return '#4be3ff';
      case 'organic':  return '#ff3aa1';
    }
  }
}

export const TEX_STYLE: Record<string, TextureStyle> = {
  M: 'metal',
  C: 'concrete',
  P: 'panel',
  X: 'circuit',
  S: 'screen',
  O: 'organic',
};
