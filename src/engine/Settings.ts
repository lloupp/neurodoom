// Persisted user options (volumes, sensitivity, difficulty). Separate from
// save slots: settings apply across all saves/new games, not per-playthrough.

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  ambientVolume: number;
  musicVolume: number;
  sensitivity: number;
  difficulty: Difficulty;
  /** Accessibility: dampens headbob/camera sway for motion-sensitive players. */
  reduceMotion: boolean;
}

const KEY = 'neurodoom:settings';

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 1,
  sfxVolume: 1,
  voiceVolume: 1,
  ambientVolume: 1,
  musicVolume: 1,
  sensitivity: 0.0022,
  difficulty: 'normal',
  reduceMotion: false,
};

export const DIFFICULTY_DAMAGE_TAKEN: Record<Difficulty, number> = {
  easy: 0.6,
  normal: 1,
  hard: 1.5,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // localStorage unavailable or corrupt — fall back to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // best-effort; settings just won't persist
  }
}
