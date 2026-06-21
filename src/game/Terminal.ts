import type { MapInteractable } from './MapSchema';
import type { LevelData } from './Level';
import type { Player } from './Player';
import type { ItemSnapshot } from './Item';

export interface TerminalLogEntry {
  id: string;
  title: string;
  transcript: string;
  source?: string;
  audioKey: string;
  played?: boolean;
}

export interface LogTag {
  type: 'unlock' | 'lock' | 'spawn' | 'flag';
  value: string;
}

/** Lexer: scans a transcript for `unlock:Door.A`, `spawn:Ghost.2`, `flag:story.shiva`-style tags. */
export function parseTags(transcript: string): LogTag[] {
  const tags: LogTag[] = [];
  const re = /\b(unlock|lock|spawn|flag):([\w.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(transcript))) {
    tags.push({ type: m[1] as LogTag['type'], value: m[2]! });
  }
  return tags;
}

export interface TerminalState {
  id: string;
  label: string;
  hacked: boolean;
  locked: boolean;
  open: boolean;
  logs: TerminalLogEntry[];
  bounds: { x: number; y: number };
}

export class TerminalSystem {
  private readonly state = new Map<string, TerminalState>();
  private current: TerminalState | null = null;

  constructor(
    private readonly level: LevelData,
    items: ItemSnapshot[],
    private readonly flags: Set<string>,
  ) {
    for (const it of items) {
      if (it.kind === 'data' || it.kind === 'keycard_red' || it.kind === 'keycard_blue') {
        // Items placed in level get registered as their own terminals (audio logs)
        this.registerAudioLog(it);
      }
    }
    for (const inter of level.manifest.interactables) {
      if (inter.kind === 'terminal' || inter.kind === 'audio_log') {
        this.state.set(inter.id, {
          id: inter.id,
          label: inter.prompt ?? 'TERMINAL',
          hacked: false,
          locked: !!inter.locked,
          open: false,
          bounds: { x: inter.x, y: inter.y },
          logs: this.gatherLogsFor(inter.id),
        });
      }
    }
  }

  private registerAudioLog(it: ItemSnapshot) {
    const id = `log-${it.id}`;
    this.state.set(id, {
      id,
      label: it.label,
      hacked: true,
      locked: false,
      open: false,
      bounds: { x: it.position.x, y: it.position.y },
      logs: [{
        id: it.id,
        title: it.label,
        transcript: it.kind === 'data' ? `> Recovered data fragment.\n> Hash: ${it.id}\n> Source: BLACKSITE-7` : `> Keycard payload: ${it.label}`,
        source: 'inline',
        audioKey: `log_${it.id}`,
        played: false,
      }],
    });
  }

  private gatherLogsFor(interactableId: string): TerminalLogEntry[] {
    const inter = this.level.manifest.interactables.find((i) => i.id === interactableId);
    if (!inter) return [];
    const out: TerminalLogEntry[] = [];
    if (inter.transcript) {
      out.push({
        id: `${inter.id}-log`,
        title: inter.prompt ?? 'Captured Log',
        transcript: inter.transcript,
        source: inter.audioKey,
        audioKey: inter.audioKey ?? `inline_${inter.id}`,
        played: false,
      });
    }
    return out;
  }

  /** Pick nearest terminal in front of player within use range. */
  pickApproach(player: Player, range = 1.5, facingCos = 0.7): TerminalState | null {
    let best: TerminalState | null = null;
    let bestDist = Infinity;
    for (const t of Array.from(this.state.values())) {
      const dx = (t.bounds.x + 0.5) - player.position.x;
      const dy = (t.bounds.y + 0.5) - player.position.y;
      const d = Math.hypot(dx, dy);
      if (d > range) continue;
      const ang = Math.atan2(dy, dx);
      const facing = Math.cos(ang - player.angle);
      if (facing < facingCos) continue;
      if (d < bestDist) { bestDist = d; best = t; }
    }
    return best;
  }

  /** Filter: only those whose unlockFlag is satisfied OR not flagged at all. */
  visibleState(flags: Set<string>): TerminalState[] {
    return Array.from(this.state.values()).filter((t) => {
      const inter = this.level.manifest.interactables.find((i) => i.id === t.id);
      if (!inter?.unlockFlag) return true;
      return flags.has(inter.unlockFlag);
    });
  }

  /** Opens the terminal and returns tags parsed from any not-yet-played log
   *  (the caller applies unlock/spawn/flag effects, then they won't fire again). */
  open(id: string): LogTag[] {
    const t = this.state.get(id);
    if (!t) return [];
    this.current = t;
    t.open = true;
    const tags: LogTag[] = [];
    for (const log of t.logs) {
      if (!log.played) tags.push(...parseTags(log.transcript));
      log.played = true;
    }
    return tags;
  }

  current_(): TerminalState | null { return this.current; }

  markPlayed(id: string): void {
    for (const t of Array.from(this.state.values())) {
      for (const log of t.logs) {
        if (log.id === id) log.played = true;
      }
    }
  }

  close(): void { this.current = null; }

  /** Apply unlock flag to door tile (mutate map). */
  unlockDoor(id: string): boolean {
    const inter = this.level.manifest.interactables.find((i) => i.id === id);
    if (!inter || inter.kind !== 'door') return false;
    inter.locked = false;
    // Replace 'D' with '.' at door tile (map is a string array — mutate char)
    const row = this.level.manifest.tiles[inter.y];
    if (row) {
      const next = row.split('');
      if (next[inter.x] === 'D') next[inter.x] = '.';
      this.level.manifest.tiles[inter.y] = next.join('');
    }
    return true;
  }

  /** Inverse of unlockDoor: re-seals a door tile. */
  lockDoor(id: string): boolean {
    const inter = this.level.manifest.interactables.find((i) => i.id === id);
    if (!inter || inter.kind !== 'door') return false;
    inter.locked = true;
    const row = this.level.manifest.tiles[inter.y];
    if (row) {
      const next = row.split('');
      if (next[inter.x] === '.') next[inter.x] = 'D';
      this.level.manifest.tiles[inter.y] = next.join('');
    }
    return true;
  }

  asRecords(): Array<{ id: string; label: string; hacked: boolean; locked: boolean; logs: TerminalLogEntry[] }> {
    return Array.from(this.state.values()).map((t) => ({
      id: t.id, label: t.label, hacked: t.hacked, locked: t.locked, logs: t.logs.map((l) => ({ ...l })),
    }));
  }

  // silence
  private _i?: MapInteractable;
  private _f?: Set<string>;
}
