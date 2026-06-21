import { AudioBus } from '../engine/Audio';
import { synthBlip, synthNoiseBurst, synthAlarmPulse, synthFootstep, synthPulseRifle } from '../engine/Procedural';

export class GameAudio {
  private ambientGain: GainNode | null = null;
  private tensionGain: GainNode | null = null;
  private threat = 0;

  constructor(private readonly bus: AudioBus) {}

  /** Pre-bake SFX into the AudioBus cache. Must be called after AudioBus.init(). */
  prime(): void {
    const ctx = this.bus.ctxInstance();
    if (!ctx) throw new Error('AudioBus must be initialized before prime()');
    this.bus.synth('sfx.pistol', (c) => synthBlip(c, 480, 0.06, 'square'));
    this.bus.synth('sfx.shotgun', (c) => synthNoiseBurst(c, 0.22));
    this.bus.synth('sfx.pulse_rifle', (c) => synthPulseRifle(c));
    this.bus.synth('sfx.footstep', (c) => synthFootstep(c));
    this.bus.synth('sfx.alarm', (c) => synthAlarmPulse(c));
    this.bus.synth('sfx.hit', (c) => synthBlip(c, 220, 0.12, 'sawtooth'));
    this.bus.synth('ui.beep', (c) => synthBlip(c, 880, 0.05, 'sine'));
    this.bus.synth('ui.error', (c) => synthBlip(c, 120, 0.18, 'square'));
    this.bus.synth('terminal.type', (c) => synthBlip(c, 1500, 0.025, 'square'));
  }

  playFire(weapon: 'pistol' | 'shotgun' | 'pulse_rifle', pos: { x: number; y: number; z: number }): void {
    const opts = { category: 'sfx' as const, position: pos, volume: 0.6 };
    if (weapon === 'shotgun')      this.bus.play('sfx.shotgun', opts);
    else if (weapon === 'pulse_rifle') this.bus.play('sfx.pulse_rifle', opts);
    else                              this.bus.play('sfx.pistol', opts);
  }

  playStep(pos: { x: number; y: number; z: number }): void {
    this.bus.play('sfx.footstep', { category: 'sfx', position: pos, volume: 0.2 });
  }

  playHit(pos: { x: number; y: number; z: number }): void {
    this.bus.play('sfx.hit', { category: 'sfx', position: pos, volume: 0.5 });
  }

  playAlarm(pos: { x: number; y: number; z: number }): void {
    this.bus.play('sfx.alarm', { category: 'sfx', position: pos, volume: 0.7 });
  }

  playUi(kind: 'beep' | 'error' | 'type'): void {
    const opts = { category: 'sfx' as const, position: null as null, volume: 0.4 };
    if (kind === 'beep')  this.bus.play('ui.beep', opts);
    if (kind === 'error') this.bus.play('ui.error', opts);
    if (kind === 'type')  this.bus.play('terminal.type', opts);
  }

  /** Low ambient drone (ambient bus) + a hidden tension layer (music bus) that
   *  fades in as `world.threat` rises. Both routed through their category
   *  gain nodes so master/category mixing and tab-hidden suspend still apply. */
  startAmbient(): void {
    const ctx = this.bus.ctxInstance();
    if (!ctx || this.ambientGain) return;

    const drone = ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 56;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.0008;
    drone.connect(lp).connect(this.ambientGain).connect(this.bus.gains.ambient ?? this.bus.master!);
    drone.start();

    const tension = ctx.createOscillator();
    tension.type = 'sawtooth';
    tension.frequency.value = 112;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    this.tensionGain = ctx.createGain();
    this.tensionGain.gain.value = 0;
    tension.connect(hp).connect(this.tensionGain).connect(this.bus.gains.music ?? this.bus.master!);
    tension.start();
  }

  /** Adaptive layer: 0 = calm, 1 = full alert. Smoothly fades the tension bed in. */
  setThreat(world_threat: number): void {
    this.threat = Math.max(0, Math.min(1, world_threat));
    const ctx = this.bus.ctxInstance();
    if (!ctx || !this.ambientGain || !this.tensionGain) return;
    const t = ctx.currentTime;
    this.ambientGain.gain.setTargetAtTime(0.0008 + this.threat * 0.0014, t, 0.4);
    this.tensionGain.gain.setTargetAtTime(this.threat * 0.012, t, 0.6);
  }
}
