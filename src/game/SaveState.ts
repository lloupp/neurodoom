import { SAVE_SCHEMA_VERSION } from '../engine/Persistence';
import type { PlayerSnapshot, PlayerStats, WeaponId } from './Player';

const WEAPON_IDS: readonly WeaponId[] = ['pistol', 'shotgun', 'pulse_rifle', 'rocket_launcher'];
const MAX_LIST_ITEMS = 1024;
const MAX_STRING_LENGTH = 256;

export interface GameSaveData {
  px: number;
  py: number;
  angle: number;
  pitch: number;
  fov: number;
  stats: PlayerStats;
  weapon: WeaponId;
  ammo: Record<WeaponId, number>;
  inventory: string[];
  flags: string[];
  level: string;
  time: number;
}

export interface ExportedGameSave {
  schema_version: typeof SAVE_SCHEMA_VERSION;
  saved_at: number;
  data: GameSaveData;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isBoundedString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_STRING_LENGTH;

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= MAX_LIST_ITEMS &&
  value.every((entry) => typeof entry === 'string' && entry.length <= MAX_STRING_LENGTH);

const isWeaponId = (value: unknown): value is WeaponId =>
  typeof value === 'string' && WEAPON_IDS.includes(value as WeaponId);

function parseStats(value: unknown): PlayerStats | null {
  if (!isObject(value)) return null;
  const { hp, maxHp, stamina, maxStamina, credits } = value;
  if (!isFiniteNumber(hp) || !isFiniteNumber(maxHp) || !isFiniteNumber(stamina) ||
      !isFiniteNumber(maxStamina) || !isFiniteNumber(credits)) return null;
  if (maxHp <= 0 || hp < 0 || hp > maxHp) return null;
  if (maxStamina <= 0 || stamina < 0 || stamina > maxStamina) return null;
  if (credits < 0) return null;
  return { hp, maxHp, stamina, maxStamina, credits };
}

function parseAmmo(value: unknown): Record<WeaponId, number> | null {
  if (!isObject(value)) return null;
  const ammo = {} as Record<WeaponId, number>;
  for (const weapon of WEAPON_IDS) {
    const count = value[weapon];
    if (!isFiniteNumber(count) || count < 0) return null;
    ammo[weapon] = count;
  }
  return ammo;
}

/**
 * Validates and normalizes untrusted save data. The returned object is a fresh
 * copy containing only supported fields, so imported JSON cannot smuggle
 * arbitrary properties into runtime state.
 */
export function parseGameSaveData(value: unknown): GameSaveData | null {
  if (!isObject(value)) return null;

  const { px, py, angle, pitch, fov, weapon, inventory, flags, level, time } = value;
  if (!isFiniteNumber(px) || !isFiniteNumber(py) || !isFiniteNumber(angle) ||
      !isFiniteNumber(pitch) || !isFiniteNumber(fov) || !isFiniteNumber(time)) return null;
  if (fov <= 0 || fov > Math.PI || time < 0) return null;
  if (!isWeaponId(weapon)) return null;
  if (!isStringList(inventory) || !isStringList(flags) || !isBoundedString(level)) return null;

  const stats = parseStats(value.stats);
  const ammo = parseAmmo(value.ammo);
  if (!stats || !ammo) return null;

  return {
    px,
    py,
    angle,
    pitch,
    fov,
    stats,
    weapon,
    ammo,
    inventory: [...inventory],
    flags: [...flags],
    level,
    time,
  };
}

/** Validate a record read from IndexedDB, including its schema version. */
export function parseStoredGameSave(value: unknown): GameSaveData | null {
  if (!isObject(value) || value.schema_version !== SAVE_SCHEMA_VERSION) return null;
  return parseGameSaveData(value.data);
}

/** Validate the JSON envelope produced by Export Save. */
export function parseExportedGameSave(value: unknown): ExportedGameSave | null {
  if (!isObject(value) || value.schema_version !== SAVE_SCHEMA_VERSION) return null;
  if (!isFiniteNumber(value.saved_at) || value.saved_at < 0) return null;
  const data = parseGameSaveData(value.data);
  if (!data) return null;
  return { schema_version: SAVE_SCHEMA_VERSION, saved_at: value.saved_at, data };
}

export function buildGameSaveData(
  player: PlayerSnapshot,
  flags: Iterable<string>,
  level: string,
  time: number,
): GameSaveData {
  return {
    px: player.px,
    py: player.py,
    angle: player.angle,
    pitch: player.pitch,
    fov: player.fov,
    stats: { ...player.stats },
    weapon: player.weapon,
    ammo: { ...player.ammo },
    inventory: [...player.inventory],
    flags: [...flags],
    level,
    time,
  };
}

export function buildExportedGameSave(data: GameSaveData, savedAt = Date.now()): ExportedGameSave {
  return { schema_version: SAVE_SCHEMA_VERSION, saved_at: savedAt, data };
}
