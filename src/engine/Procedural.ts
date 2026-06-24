// Procedural textures + SFX synthesizers.
// Deterministic given a seed → reproducible levels.

/** Tiny seed-based RNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ProceduralTextureOptions {
  size: number;          // tile size in px
  seed: number;
  /** base color in CSS color string format; variants derived deterministically */
  baseColor: string;
  /** secondary tint for surface marks */
  accent?: string;
  /** PBR-ish: [0..1] smoothness, [0..1] roughness */
  style?: 'metal' | 'concrete' | 'panel' | 'circuit' | 'organic' | 'screen';
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Render a tile-sized texture to an offscreen canvas. */
export function generateTileTexture(opts: ProceduralTextureOptions): HTMLCanvasElement {
  const { size, seed, baseColor, accent = '#1a1f2a', style = 'panel' } = opts;
  const rng = mulberry32(seed);
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;

  const [br, bg, bb] = hexToRgb(baseColor);
  const [ar, ag, ab] = hexToRgb(accent);

  // Base fill
  g.fillStyle = baseColor;
  g.fillRect(0, 0, size, size);

  // Noise pass
  const noiseAmp = style === 'metal' ? 14 : style === 'concrete' ? 36 : 22;
  const img = g.getImageData(0, 0, size, size);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * noiseAmp;
    data[i]     = Math.max(0, Math.min(255, data[i]     + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  g.putImageData(img, 0, 0);

  switch (style) {
    case 'panel': {
      // Quadrant panel seams
      g.strokeStyle = `rgba(0,0,0,0.45)`;
      g.lineWidth = 2;
      g.strokeRect(1, 1, size / 2 - 2, size / 2 - 2);
      g.strokeRect(size / 2 + 1, 1, size / 2 - 2, size / 2 - 2);
      g.strokeRect(1, size / 2 + 1, size / 2 - 2, size / 2 - 2);
      g.strokeRect(size / 2 + 1, size / 2 + 1, size / 2 - 2, size / 2 - 2);
      // Slight emissive accent on one quadrant
      const ac = g.createRadialGradient(size * 0.75, size * 0.25, 0, size * 0.75, size * 0.25, size * 0.4);
      ac.addColorStop(0, `rgba(${ar | 0},${ag | 0},${ab | 0},0.5)`);
      ac.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = ac;
      g.fillRect(0, 0, size, size);
      break;
    }
    case 'concrete': {
      // Aggregate pits
      for (let i = 0; i < size * 4; i++) {
        const x = rng() * size; const y = rng() * size;
        const r = 1 + rng() * 1.4;
        g.fillStyle = `rgba(0,0,0,${0.1 + rng() * 0.2})`;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      // Cracks
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1;
      let x = rng() * size; let y = rng() * size;
      g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < 6; i++) {
        x += (rng() - 0.5) * 14;
        y += (rng() - 0.5) * 14;
        g.lineTo(x, y);
      }
      g.stroke();
      break;
    }
    case 'metal': {
      // Brushed vertical streaks
      for (let x = 0; x < size; x++) {
        const a = rng() * 0.15;
        g.fillStyle = `rgba(255,255,255,${a})`;
        g.fillRect(x, 0, 1, size);
      }
      break;
    }
    case 'circuit': {
      // Lattice lines
      g.strokeStyle = `rgba(${ar | 0},${ag | 0},${ab | 0},0.85)`;
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = (i + 1) * (size / 7);
        g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x < size; x += 12) {
          g.lineTo(x, y);
          if (rng() > 0.5) g.lineTo(x + 6, y + 6);
        }
        g.stroke();
      }
      // Solder pads
      g.fillStyle = `rgba(${ar | 0},${ag | 0},${ab | 0},1)`;
      for (let i = 0; i < 8; i++) {
        g.fillRect(rng() * size | 0, rng() * size | 0, 4, 4);
      }
      break;
    }
    case 'screen': {
      const grad = g.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, `rgba(${ar | 0},${ag | 0},${ab | 0},0.9)`);
      grad.addColorStop(1, `rgba(${br | 0},${bg | 0},${bb | 0},0.4)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      // Scanlines
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < size; y += 2) g.fillRect(0, y, size, 1);
      break;
    }
    case 'organic': {
      for (let i = 0; i < 30; i++) {
        g.fillStyle = `rgba(${ar | 0},${ag | 0},${ab | 0},${0.1 + rng() * 0.25})`;
        g.beginPath();
        g.arc(rng() * size, rng() * size, 4 + rng() * 12, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
  }

  // Vignette
  const vg = g.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.4)');
  g.fillStyle = vg;
  g.fillRect(0, 0, size, size);

  // Darken edges of tile
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 10;
  g.strokeRect(0, 0, size, size);

  return cv;
}

/** Synthesize a 1-second SFX blip. Web Audio only — never buffers user assets. */
export function synthBlip(ctx: AudioContext, freq: number, dur = 0.18, type: OscillatorType = 'sine'): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(dur * sampleRate));
  const buf = ctx.createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-3 * t / dur);
    let sample: number;
    switch (type) {
      case 'square': sample = Math.sign(Math.sin(2 * Math.PI * freq * t)); break;
      case 'sawtooth': sample = 2 * (t * freq - Math.floor(0.5 + t * freq)); break;
      case 'triangle': sample = 2 * Math.abs(2 * (t * freq - Math.floor(0.5 + t * freq))) - 1; break;
      default: sample = Math.sin(2 * Math.PI * freq * t); break;
    }
    data[i] = sample * envelope * 0.4;
  }
  return buf;
}

export function synthNoiseBurst(ctx: AudioContext, dur = 0.4): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(dur * sampleRate));
  const buf = ctx.createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-3.5 * t / dur);
    data[i] = (Math.random() * 2 - 1) * env * 0.6;
  }
  return buf;
}

export function synthAlarmPulse(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const dur = 0.5;
  const len = Math.floor(dur * sampleRate);
  const buf = ctx.createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const phase = (t % 0.25) / 0.25;
    const env = Math.exp(-1.5 * t);
    const f = 800 + phase * 400;
    data[i] = Math.sin(2 * Math.PI * f * t) * env * 0.4;
  }
  return buf;
}

/** Footstep palette by surface (SPEC 4.2). Concrete is a plain noise thud;
 *  metal grating layers a short metallic ring on top; organic floor adds a
 *  damp, lower-pitched squelch tail. */
export function synthFootstep(ctx: AudioContext, surface: 'concrete' | 'metal' | 'organic' = 'concrete'): AudioBuffer {
  if (surface === 'concrete') return synthNoiseBurst(ctx, 0.18);

  const sampleRate = ctx.sampleRate;
  const dur = surface === 'metal' ? 0.22 : 0.26;
  const len = Math.floor(dur * sampleRate);
  const buf = ctx.createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    if (surface === 'metal') {
      const env = Math.exp(-3.5 * t / dur);
      const ring = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-14 * t);
      data[i] = ((Math.random() * 2 - 1) * 0.5 + ring * 0.5) * env * 0.55;
    } else {
      const env = Math.exp(-2 * t / dur);
      const squelch = Math.sin(2 * Math.PI * 90 * t) * 0.3;
      data[i] = ((Math.random() * 2 - 1) * 0.7 + squelch) * env * 0.5;
    }
  }
  return buf;
}

/** Rocket-launcher blast: a low rumble layered under a fast-decaying noise burst. */
export function synthExplosion(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const dur = 0.8;
  const len = Math.floor(dur * sampleRate);
  const buf = ctx.createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-2.2 * t / dur);
    const rumble = Math.sin(2 * Math.PI * 50 * t) * 0.4;
    data[i] = ((Math.random() * 2 - 1) * 0.7 + rumble) * env * 0.7;
  }
  return buf;
}

export function synthPulseRifle(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const dur = 0.32;
  const len = Math.floor(dur * sampleRate);
  const buf = ctx.createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-9 * t / dur);
    data[i] = (Math.random() * 2 - 1) * env * 0.7;
  }
  return buf;
}

export const PALETTE = {
  metal: '#5b6470',
  concrete: '#3c3f48',
  panel: '#22272f',
  circuit: '#0a0f12',
  screen: '#040a0a',
  organic: '#3a1018',
  accent_cyan: '#4be3ff',
  accent_magenta: '#ff3aa1',
  accent_amber: '#ffb048',
  accent_toxic: '#aaff39',
};
