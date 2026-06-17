/**
 * AudioBus — Web Audio API with positional PannerNode (HRTF).
 */

const HRTF_PRESET: PannerOptions = {
  panningModel: 'HRTF',
  distanceModel: 'inverse',
  refDistance: 1,
  maxDistance: 30,
  rolloffFactor: 1,
  coneInnerAngle: 90,
  coneOuterAngle: 220,
  coneOuterGain: 0.4,
};

export type Category = 'sfx' | 'voice' | 'ambient' | 'music';

export interface PlayOptions {
  category?: Category;
  /** World-space position in meters; null = 2D (UI / music). */
  position?: { x: number; y: number; z: number } | null;
  /** -1 = left ear, +1 = right ear, 0 = centered. If set, mutated position. */
  stereoPan?: number;
  loop?: boolean;
  volume?: number;
  playbackRate?: number;
  refDistance?: number;
}

export class AudioBus {
  private ctx: AudioContext | null = null;
  /** Public for ambient-bus routing in game code. */
  readonly gains: Record<Category, GainNode | null> = { sfx: null, voice: null, ambient: null, music: null };
  master: GainNode | null = null;
  private cache = new Map<string, AudioBuffer>();

  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: 'interactive' });

    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);

    for (const cat of ['sfx', 'voice', 'ambient', 'music'] as const) {
      const g = this.ctx.createGain();
      g.gain.value = cat === 'voice' ? 0.85 : cat === 'music' ? 0.55 : 0.7;
      g.connect(this.master);
      this.gains[cat] = g;
    }

    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = 0; l.positionY.value = 0; l.positionZ.value = 0;
      l.forwardX.value = 0; l.forwardY.value = 0; l.forwardZ.value = -1;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    }
  }

  setListener(
    pos: { x: number; y: number; z: number },
    forward: { x: number; y: number; z: number },
    up: { x: number; y: number; z: number },
  ): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setValueAtTime(pos.x, t);
      l.positionY.setValueAtTime(pos.y, t);
      l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(forward.x, t);
      l.forwardY.setValueAtTime(forward.y, t);
      l.forwardZ.setValueAtTime(forward.z, t);
      l.upX.setValueAtTime(up.x, t);
      l.upY.setValueAtTime(up.y, t);
      l.upZ.setValueAtTime(up.z, t);
    }
  }

  async load(key: string, url: string): Promise<AudioBuffer> {
    const cached = this.cache.get(key);
    if (cached) return cached;
    if (!this.ctx) await this.init();
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await this.ctx!.decodeAudioData(arr);
    this.cache.set(key, buf);
    return buf;
  }

  synth(key: string, generator: (ctx: AudioContext) => AudioBuffer): AudioBuffer {
    if (!this.ctx) throw new Error('AudioBus.synth before init');
    const cached = this.cache.get(key);
    if (cached) return cached;
    const buf = generator(this.ctx);
    this.cache.set(key, buf);
    return buf;
  }

  play(key: string, opts: PlayOptions = {}): AudioBufferSourceNode | null {
    if (!this.ctx || !this.master) return null;
    const buf = this.cache.get(key);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (opts.playbackRate) src.playbackRate.value = opts.playbackRate;
    src.loop = !!opts.loop;

    let sunk: AudioNode = src;

    if (opts.position) {
      const pan = this.ctx.createPanner();
      const h = HRTF_PRESET;
      pan.panningModel = h.panningModel!;
      pan.distanceModel = h.distanceModel!;
      pan.refDistance = opts.refDistance ?? h.refDistance!;
      pan.maxDistance = h.maxDistance!;
      pan.rolloffFactor = h.rolloffFactor!;
      pan.coneInnerAngle = h.coneInnerAngle!;
      pan.coneOuterAngle = h.coneOuterAngle!;
      pan.coneOuterGain = h.coneOuterGain!;
      if (pan.positionX) {
        pan.positionX.value = opts.position.x;
        pan.positionY.value = opts.position.y;
        pan.positionZ.value = opts.position.z;
      } else {
        (pan as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(opts.position.x, opts.position.y, opts.position.z);
      }
      src.connect(pan);
      sunk = pan;
    } else if (opts.stereoPan !== undefined) {
      const sp = this.ctx.createStereoPanner();
      sp.pan.value = Math.max(-1, Math.min(1, opts.stereoPan!));
      src.connect(sp);
      sunk = sp;
    }

    const g = this.ctx.createGain();
    g.gain.value = opts.volume ?? 1;
    sunk.connect(g);
    const cat = opts.category ?? 'sfx';
    g.connect(this.gains[cat] ?? this.master);

    src.start();
    return src;
  }

  setCategoryGain(cat: Category, v: number): void {
    const g = this.gains[cat];
    if (g) g.gain.value = Math.max(0, Math.min(1, v));
  }

  setMasterGain(v: number): void {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  paused(): boolean {
    return !!this.ctx && this.ctx.state === 'suspended';
  }

  async suspend(): Promise<void> {
    if (!this.ctx) return;
    if (this.ctx.state === 'running') await this.ctx.suspend();
  }

  async resume(): Promise<void> {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  ctxInstance(): AudioContext | null { return this.ctx; }
}
