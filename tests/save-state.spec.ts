import { describe, expect, it } from 'vitest';
import {
  buildExportedGameSave,
  buildGameSaveData,
  parseExportedGameSave,
  parseGameSaveData,
  parseStoredGameSave,
} from '../src/game/SaveState';
import type { PlayerSnapshot } from '../src/game/Player';

const validData = () => ({
  px: 6.5,
  py: 7.5,
  angle: 1.25,
  pitch: 0.1,
  fov: 1.05,
  stats: { hp: 73, maxHp: 100, stamina: 61, maxStamina: 100, credits: 42 },
  weapon: 'shotgun' as const,
  ammo: { pistol: 12, shotgun: 5, pulse_rifle: 18, rocket_launcher: 2 },
  inventory: ['keycard:test'],
  flags: ['story:test'],
  level: 'sector_9',
  time: 123456,
});

describe('SaveState validation', () => {
  it('accepts and clones a valid game save payload', () => {
    const source = validData();
    const parsed = parseGameSaveData(source);

    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(parsed?.stats).not.toBe(source.stats);
    expect(parsed?.ammo).not.toBe(source.ammo);
    expect(parsed?.inventory).not.toBe(source.inventory);
    expect(parsed?.flags).not.toBe(source.flags);
  });

  it('drops unsupported fields while normalizing imported data', () => {
    const parsed = parseGameSaveData({ ...validData(), injected: { admin: true } });
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty('injected');
  });

  it('rejects unknown weapons and incomplete ammo maps', () => {
    expect(parseGameSaveData({ ...validData(), weapon: 'railgun' })).toBeNull();
    const { rocket_launcher: _rocket, ...incompleteAmmo } = validData().ammo;
    expect(parseGameSaveData({ ...validData(), ammo: incompleteAmmo })).toBeNull();
  });

  it('rejects non-finite and negative numeric state', () => {
    expect(parseGameSaveData({ ...validData(), px: Number.NaN })).toBeNull();
    expect(parseGameSaveData({ ...validData(), time: -1 })).toBeNull();
    expect(parseGameSaveData({ ...validData(), ammo: { ...validData().ammo, shotgun: -1 } })).toBeNull();
  });

  it('rejects impossible health and stamina ranges', () => {
    expect(parseGameSaveData({
      ...validData(),
      stats: { ...validData().stats, hp: 101 },
    })).toBeNull();
    expect(parseGameSaveData({
      ...validData(),
      stats: { ...validData().stats, stamina: 101 },
    })).toBeNull();
  });

  it('rejects malformed inventory, flags, level and FOV', () => {
    expect(parseGameSaveData({ ...validData(), inventory: [42] })).toBeNull();
    expect(parseGameSaveData({ ...validData(), flags: 'story:test' })).toBeNull();
    expect(parseGameSaveData({ ...validData(), level: '' })).toBeNull();
    expect(parseGameSaveData({ ...validData(), fov: 0 })).toBeNull();
  });

  it('rejects unsupported IndexedDB save schema versions', () => {
    expect(parseStoredGameSave({ schema_version: 99, data: validData() })).toBeNull();
    expect(parseStoredGameSave({ schema_version: 1, data: validData() })).toEqual(validData());
  });

  it('validates exported save envelopes before import', () => {
    const exported = buildExportedGameSave(validData(), 1234);
    expect(parseExportedGameSave(exported)).toEqual(exported);
    expect(parseExportedGameSave({ ...exported, schema_version: 2 })).toBeNull();
    expect(parseExportedGameSave({ ...exported, saved_at: 'yesterday' })).toBeNull();
    expect(parseExportedGameSave({ ...exported, data: { ...validData(), level: '' } })).toBeNull();
  });

  it('builds a minimal save from a player snapshot without transient fields', () => {
    const snapshot: PlayerSnapshot = {
      ...validData(),
      inventory: ['keycard:test'],
      isMoving: true,
      walking: 0.75,
      bobPhase: 12,
    };
    const built = buildGameSaveData(snapshot, ['story:test'], 'sector_9', 123456);

    expect(built).toEqual(validData());
    expect(built).not.toHaveProperty('isMoving');
    expect(built).not.toHaveProperty('walking');
    expect(built).not.toHaveProperty('bobPhase');
  });
});
