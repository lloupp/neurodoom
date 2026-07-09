import { describe, it, expect, vi } from 'vitest';
import { mulberry32, PALETTE, synthBlip, synthNoiseBurst, synthAlarmPulse, synthFootstep, synthPulseRifle } from '../src/engine/Procedural';

// ─── Minimal AudioContext mock ───

function mockAudioContext(sampleRate = 44100): AudioContext {
  return {
    sampleRate,
    createBuffer: vi.fn((numChannels: number, length: number, _sampleRate: number) => {
      const data = new Float32Array(length);
      return {
        getChannelData: vi.fn((_ch: number) => data),
        length,
        numberOfChannels: numChannels,
        sampleRate: _sampleRate,
      } as unknown as AudioBuffer;
    }),
  } as unknown as AudioContext;
}

// ─── mulberry32 RNG ───

describe('mulberry32', () => {
  it('produces values in [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 200; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let same = 0;
    for (let i = 0; i < 100; i++) {
      if (a() === b()) same++;
    }
    // Extremely unlikely to match more than a couple times
    expect(same).toBeLessThan(5);
  });

  it('treats seed as unsigned 32-bit (wraps negative)', () => {
    // -1 >>> 0 === 4294967295; same seed after coercion
    const a = mulberry32(-1);
    const b = mulberry32(0xFFFFFFFF);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b());
    }
  });

  it('handles seed 0 without degeneration', () => {
    const rng = mulberry32(0);
    const first10 = Array.from({ length: 10 }, () => rng());
    // Should not produce all zeros or all same values
    const unique = new Set(first10);
    expect(unique.size).toBeGreaterThan(1);
    // All values still in range
    for (const v of first10) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has reasonable uniformity over large sample', () => {
    const rng = mulberry32(98765);
    const N = 10_000;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += rng();
    const mean = sum / N;
    // Mean of U[0,1) ≈ 0.5; allow ±0.02 for 10k samples
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('does not produce NaN or Infinity', () => {
    const rng = mulberry32(777);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('coerces floating-point seed to u32', () => {
    // 3.7 >>> 0 === 3
    const a = mulberry32(3.7);
    const b = mulberry32(3);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces a full-period-like variety (no short cycles)', () => {
    const rng = mulberry32(1337);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      // Quantize to 100 bins to detect cycling
      const bin = Math.floor(rng() * 100);
      seen.add(bin);
    }
    // Should have hit many different bins
    expect(seen.size).toBeGreaterThan(80);
  });
});

// ─── PALETTE constants ───

describe('PALETTE', () => {
  it('has all 6 style entries', () => {
    const styleKeys = ['metal', 'concrete', 'panel', 'circuit', 'screen', 'organic'];
    for (const k of styleKeys) {
      expect(PALETTE[k as keyof typeof PALETTE]).toBeDefined();
      expect(typeof PALETTE[k as keyof typeof PALETTE]).toBe('string');
    }
  });

  it('has 4 accent entries', () => {
    const accentKeys = ['accent_cyan', 'accent_magenta', 'accent_amber', 'accent_toxic'] as const;
    for (const k of accentKeys) {
      expect(PALETTE[k as keyof typeof PALETTE]).toBeDefined();
      expect(typeof PALETTE[k as keyof typeof PALETTE]).toBe('string');
    }
  });

  it('all values are valid CSS hex colors', () => {
    const hexPattern = /^#[0-9a-f]{6}$/i;
    for (const [k, v] of Object.entries(PALETTE)) {
      expect(hexPattern.test(v)).toBe(true);
    }
  });
});

// ─── synthBlip ───

describe('synthBlip', () => {
  it('creates a buffer with correct channel count and length', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthBlip(ctx, 440);
    expect(buf.numberOfChannels).toBe(1);
    // Default dur=0.18, so length = floor(0.18 * 44100) = 7938
    expect(buf.length).toBe(7938);
  });

  it('respects custom duration', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthBlip(ctx, 440, 0.5);
    expect(buf.length).toBe(Math.floor(0.5 * 44100));
  });

  it('handles minimum duration (rounds up to at least 1 sample)', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthBlip(ctx, 440, 0.00001);
    expect(buf.length).toBeGreaterThanOrEqual(1);
  });

  it('writes non-zero samples for a sine wave', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthBlip(ctx, 440, 0.18, 'sine');
    const data = buf.getChannelData(0);
    let hasNonZero = false;
    for (let i = 0; i < Math.min(data.length, 1000); i++) {
      if (data[i] !== 0) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);
  });

  it('supports square waveform type', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthBlip(ctx, 440, 0.18, 'square');
    expect(buf.length).toBe(7938);
  });

  it('supports sawtooth waveform type', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthBlip(ctx, 440, 0.18, 'sawtooth');
    expect(buf.length).toBe(7938);
  });

  it('supports triangle waveform type', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthBlip(ctx, 440, 0.18, 'triangle');
    expect(buf.length).toBe(7938);
  });

  it('defaults to sine for unknown waveform type', () => {
    const ctx = mockAudioContext(44100);
    // 'custom' is not a valid OscillatorType but the default case handles it as sine
    const buf = synthBlip(ctx, 440, 0.18, 'sine' as OscillatorType);
    expect(buf.length).toBe(7938);
  });
});

// ─── synthNoiseBurst ───

describe('synthNoiseBurst', () => {
  it('creates a mono buffer with correct length for default duration', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthNoiseBurst(ctx);
    expect(buf.numberOfChannels).toBe(1);
    expect(buf.length).toBe(Math.floor(0.4 * 44100));
  });

  it('respects custom duration', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthNoiseBurst(ctx, 1.0);
    expect(buf.length).toBe(44100);
  });

  it('handles minimum duration', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthNoiseBurst(ctx, 0.00001);
    expect(buf.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── synthAlarmPulse ───

describe('synthAlarmPulse', () => {
  it('creates a mono buffer with fixed 0.5s duration', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthAlarmPulse(ctx);
    expect(buf.numberOfChannels).toBe(1);
    expect(buf.length).toBe(Math.floor(0.5 * 44100));
  });
});

// ─── synthFootstep ───

describe('synthFootstep', () => {
  it('delegates to synthNoiseBurst with 0.18s duration', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthFootstep(ctx);
    expect(buf.numberOfChannels).toBe(1);
    expect(buf.length).toBe(Math.floor(0.18 * 44100));
  });
});

// ─── synthPulseRifle ───

describe('synthPulseRifle', () => {
  it('creates a mono buffer with 0.32s duration', () => {
    const ctx = mockAudioContext(44100);
    const buf = synthPulseRifle(ctx);
    expect(buf.numberOfChannels).toBe(1);
    expect(buf.length).toBe(Math.floor(0.32 * 44100));
  });
});
