import { describe, it, expect } from 'vitest';
import { loadLevel } from '../src/engine/LevelLoader';
import { collidesAt } from '../src/game/Level';
import { TerminalSystem, parseTags } from '../src/game/Terminal';
import { EnemySystem } from '../src/game/Enemy';
import { Player } from '../src/game/Player';
import level1 from '../src/game/levels/Level1';

describe('Terminal log lexer (SPEC 4.7)', () => {
  it('extracts unlock/lock/spawn/flag tags from a real Level1 transcript', () => {
    const terminal = level1.interactables.find((i) => i.id === 'terminal_lab_info')!;
    const tags = parseTags(terminal.transcript!);
    expect(tags).toEqual([
      { type: 'flag', value: 'story.cleaners_dispatched' },
      { type: 'spawn', value: 'Ghost.drone' },
    ]);
  });

  it('open() returns tags once, then suppresses them on replay', () => {
    const loaded = loadLevel(level1);
    const flags = new Set<string>();
    const terms = new TerminalSystem(loaded, [], flags);
    const first = terms.open('terminal_lab_info');
    expect(first.some((t) => t.type === 'flag' && t.value === 'story.cleaners_dispatched')).toBe(true);
    const second = terms.open('terminal_lab_info');
    expect(second.length).toBe(0);
  });

  it('unlockDoor/lockDoor toggle both the interactable flag and the tile char', () => {
    const loaded = loadLevel(level1);
    const flags = new Set<string>();
    const terms = new TerminalSystem(loaded, [], flags);
    const door = loaded.manifest.interactables.find((i) => i.id === 'door_secure_lab')!;
    expect(door.locked).toBe(true);
    expect(loaded.manifest.tiles[door.y]![door.x]).toBe('D');
    expect(terms.unlockDoor('door_secure_lab')).toBe(true);
    expect(door.locked).toBe(false);
    expect(loaded.manifest.tiles[door.y]![door.x]).toBe('.');
    expect(terms.lockDoor('door_secure_lab')).toBe(true);
    expect(door.locked).toBe(true);
    expect(loaded.manifest.tiles[door.y]![door.x]).toBe('D');
  });

  it('the secure lab room is actually sealed by collision until the door is unlocked', () => {
    const loaded = loadLevel(level1);
    const flags = new Set<string>();
    const terms = new TerminalSystem(loaded, [], flags);
    const door = loaded.manifest.interactables.find((i) => i.id === 'door_secure_lab')!;
    const cx = door.x + 0.5;
    const cy = door.y + 0.5;
    // Approaching from the open corridor north of the door: blocked while locked.
    expect(collidesAt(loaded.manifest.tiles, loaded.manifest.cellSize, cx, cy - 0.5, 0.3)).toBe(true);
    terms.unlockDoor('door_secure_lab');
    expect(collidesAt(loaded.manifest.tiles, loaded.manifest.cellSize, cx, cy - 0.5, 0.3)).toBe(false);
  });

  it('the right map boundary is collidable on every row (no out-of-bounds gap)', () => {
    const loaded = loadLevel(level1);
    const w = loaded.manifest.tiles[0]!.length;
    for (let y = 1; y < loaded.manifest.tiles.length - 1; y++) {
      expect(loaded.manifest.tiles[y]!.length).toBe(w);
    }
  });
});

describe('Enemy behavior tree (real IDLE/ALERT/CHASE/RETREAT transitions)', () => {
  it('escalates IDLE -> ALERT -> CHASE as a player closes distance in line of sight', () => {
    const loaded = loadLevel(level1);
    const player = new Player({ x: 9.5, y: 4.5, face: 0 });
    player.isMoving = true;
    const enemies = new EnemySystem(loaded, player);
    const id = enemies.spawn('drone', 10.5, 4.5, []);
    expect(enemies.snapshots().find((e) => e.id === id)!.state).toBe('IDLE');

    for (let i = 0; i < 60; i++) enemies.update(1 / 30, {});
    const state = enemies.snapshots().find((e) => e.id === id)!.state;
    expect(['ALERT', 'CHASE', 'ATTACK']).toContain(state);
  });

  it('drops loot and clears on death; retreats below 25% hp before that', () => {
    const loaded = loadLevel(level1);
    const player = new Player({ x: 0.5, y: 0.5, face: 0 });
    const enemies = new EnemySystem(loaded, player);
    const id = enemies.spawn('drone', 10.5, 4.5, []);

    const wounding = enemies.damageAtTile(10, 4, 1, 25, 0);
    expect(wounding.hits.find((h) => h.id === id)!.state).toBe('RETREAT');
    expect(wounding.loot.length).toBe(0);

    const killing = enemies.damageAtTile(10, 4, 1, 25, 0);
    expect(killing.hits.find((h) => h.id === id)!.state).toBe('DEAD');
    // Drones drop a medkit + credits (SPEC 4.4); heavies would also drop a keycard.
    expect(killing.loot.map((l) => l.kind).sort()).toEqual(['credits', 'medkit']);
    expect(enemies.alive()).toBe(0);
  });

  it('a heavy drops ammo + credits + keycard on death (SPEC 4.4)', () => {
    const loaded = loadLevel(level1);
    const player = new Player({ x: 0.5, y: 0.5, face: 0 });
    const enemies = new EnemySystem(loaded, player);
    const id = enemies.spawn('heavy', 10.5, 4.5, []);
    const killing = enemies.damageAtTile(10, 4, 1, 999, 0);
    expect(killing.hits.find((h) => h.id === id)!.state).toBe('DEAD');
    expect(killing.loot.map((l) => l.kind).sort()).toEqual(['ammo', 'credits', 'keycard']);
  });
});

describe('Inventory reorder (drag-drop, SPEC 4.5)', () => {
  it('moves an item from one hot slot to another, preserving the rest', () => {
    const player = new Player({ x: 0.5, y: 0.5, face: 0 });
    player.addInventory('alpha');
    player.addInventory('beta');
    player.addInventory('gamma');
    expect(player.snapshot().inventory).toEqual(['alpha', 'beta', 'gamma']);
    player.reorderInventory(0, 2); // move alpha to the end
    expect(player.snapshot().inventory).toEqual(['beta', 'gamma', 'alpha']);
  });

  it('ignores out-of-range or no-op moves', () => {
    const player = new Player({ x: 0.5, y: 0.5, face: 0 });
    player.addInventory('alpha');
    player.addInventory('beta');
    player.reorderInventory(1, 1);
    player.reorderInventory(5, 0);
    expect(player.snapshot().inventory).toEqual(['alpha', 'beta']);
  });
});
