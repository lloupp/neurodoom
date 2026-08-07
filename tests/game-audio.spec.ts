import { describe, it, expect } from 'vitest';
import { GameAudio } from '../src/game/Audio';
import type { AudioBus } from '../src/engine/Audio';

/**
 * Locks in the world→panner coordinate mapping. The listener in Game.update sits at
 * { x: player.y*0.05, y: 0, z: player.x*0.05 }, so a positional sound MUST land in the
 * same space: world y → panner x, world x → panner z, and the vertical axis (world z,
 * which gameplay always passes as 0) → panner y. A regression here (e.g. feeding world y
 * into the vertical axis) silently flattens the stereo pan and inflates perceived distance.
 */
function makeBusSpy() {
  const calls: { key: string; opts: { position: { x: number; y: number; z: number } | null } }[] = [];
  const bus = {
    play(key: string, opts: { position: { x: number; y: number; z: number } | null }) {
      calls.push({ key, opts });
    },
    // Unused by the paths under test, present so the shape matches AudioBus.
    ctxInstance: () => null,
    gains: {},
    master: null,
  } as unknown as AudioBus;
  return { bus, calls };
}

describe('GameAudio positional mapping', () => {
  it('maps world (x,y,z) into listener space: x→z, y→x, z→y', () => {
    const { bus, calls } = makeBusSpy();
    const audio = new GameAudio(bus);
    audio.playHit({ x: 100, y: 40, z: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.opts.position).toEqual({ x: 40 * 0.05, y: 0, z: 100 * 0.05 });
  });

  it('keeps the vertical axis on world z, not world y', () => {
    const { bus, calls } = makeBusSpy();
    const audio = new GameAudio(bus);
    audio.playHit({ x: 0, y: 20, z: 3 });
    // vertical (panner y) must follow world z; world y must NOT leak into it
    expect(calls[0]!.opts.position!.y).toBe(3 * 0.05);
    expect(calls[0]!.opts.position!.x).toBe(20 * 0.05);
  });

  it('passes null through for non-positional (UI) sounds', () => {
    const { bus, calls } = makeBusSpy();
    const audio = new GameAudio(bus);
    audio.playLog(null);
    expect(calls[0]!.opts.position).toBeNull();
  });
});
