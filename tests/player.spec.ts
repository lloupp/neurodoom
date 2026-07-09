import { describe, it, expect } from 'vitest';
import { Player, WEAPONS } from '../src/game/Player';
import type { LevelData } from '../src/game/Level';
import type { InputState } from '../src/engine/Input';

// Minimal level data for Player.update()
function makeLevel(): LevelData {
  return {
    manifest: {
      id: 'test',
      name: 'Test',
      cellSize: 1,
      spawn: { x: 5, y: 5, face: 0 },
      tiles: [
        '###########',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '###########',
      ],
      enemies: [],
      interactables: [],
      triggers: [],
    },
    rooms: [{ x: 1, y: 1, w: 9, h: 9 }],
    wallSegments: [],
  };
}

function noInput(): InputState {
  return {
    forward: 0, backward: 0, strafeL: 0, strafeR: 0,
    jump: false, crouch: false, fire: false, aim: false,
    interact: false, use: 0, inventoryToggle: false, pause: false,
    mouseDX: 0, mouseDY: 0,
  };
}

describe('Player', () => {
  it('initializes with correct default stats', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    expect(p.stats.hp).toBe(100);
    expect(p.stats.maxHp).toBe(100);
    expect(p.stats.stamina).toBe(100);
    expect(p.stats.maxStamina).toBe(100);
    expect(p.stats.credits).toBe(0);
  });

  it('damage reduces hp and returns true when fatal', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    expect(p.damage(30)).toBe(false);
    expect(p.stats.hp).toBe(70);
    expect(p.damage(70)).toBe(true);
    expect(p.stats.hp).toBe(0);
  });

  it('damage clamps hp to 0 (no negative hp)', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.damage(999);
    expect(p.stats.hp).toBe(0);
  });

  it('ignores non-positive damage so bad inputs cannot heal the player', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.damage(25);
    expect(p.damage(-10)).toBe(false);
    expect(p.stats.hp).toBe(75);
    expect(p.damage(0)).toBe(false);
    expect(p.stats.hp).toBe(75);
  });

  it('heal increases hp up to maxHp', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.damage(50);
    p.heal(20);
    expect(p.stats.hp).toBe(70);
    p.heal(100); // over heal
    expect(p.stats.hp).toBe(100);
  });

  it('heal does nothing when at full hp', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.heal(10);
    expect(p.stats.hp).toBe(100);
  });

  it('ignores non-positive healing so bad inputs cannot damage the player', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.damage(25);
    p.heal(-10);
    expect(p.stats.hp).toBe(75);
    p.heal(0);
    expect(p.stats.hp).toBe(75);
  });

  it('refill sets ammo capped at 2x capacity', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.refill('pistol', 999);
    expect(p.ammo.pistol).toBe(WEAPONS.pistol.ammoCapacity * 2);
  });

  it('snapshot and apply round-trip preserve state', () => {
    const p = new Player({ x: 5, y: 5, face: 90 });
    const snap = p.snapshot();
    expect(snap.px).toBeCloseTo(5);
    expect(snap.py).toBeCloseTo(5);
    expect(snap.weapon).toBe('pistol');
    // Apply to a new player
    const p2 = new Player({ x: 0, y: 0, face: 0 });
    p2.apply(snap);
    expect(p2.position.x).toBeCloseTo(5);
    expect(p2.weapon).toBe('pistol');
    expect(p2.ammo.pistol).toBe(snap.ammo.pistol);
  });

  it('camera returns current position and angle', () => {
    const p = new Player({ x: 3, y: 7, face: 180 });
    const cam = p.camera();
    expect(cam.px).toBeCloseTo(3);
    expect(cam.py).toBeCloseTo(7);
  });

  it('setWeapon changes active weapon', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.setWeapon('shotgun');
    expect(p.weapon).toBe('shotgun');
    p.setWeapon('pulse_rifle');
    expect(p.weapon).toBe('pulse_rifle');
  });

  it('inventory add/remove works', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.addInventory('keycard_red');
    expect(p.inventory.has('keycard_red')).toBe(true);
    p.removeInventory('keycard_red');
    expect(p.inventory.has('keycard_red')).toBe(false);
  });

  it('setInventory replaces entire inventory', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.addInventory('old_item');
    p.setInventory(['new_a', 'new_b']);
    expect(p.inventory.has('old_item')).toBe(false);
    expect(p.inventory.has('new_a')).toBe(true);
    expect(p.inventory.has('new_b')).toBe(true);
  });

  it('update with no input does not move player', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    const level = makeLevel();
    const { fired } = p.update(level, 0.016, noInput(), { fire: () => {}, step: () => {} });
    expect(fired).toBe(false);
    expect(p.position.x).toBeCloseTo(5);
    expect(p.position.y).toBeCloseTo(5);
  });

  it('firing consumes ammo and triggers callback', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    const level = makeLevel();
    let firedWeapon = '';
    const input = { ...noInput(), fire: true };
    const result = p.update(level, 0.5, input, {
      fire: (w) => { firedWeapon = w; },
      step: () => {},
    });
    expect(result.fired).toBe(true);
    expect(result.weaponId).toBe('pistol');
    expect(firedWeapon).toBe('pistol');
    expect(p.ammo.pistol).toBe(35); // 36 - 1
  });

  it('firing respects fire rate (cooldown)', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    const level = makeLevel();
    let fireCount = 0;
    const input = { ...noInput(), fire: true };
    // First shot
    p.update(level, 0.5, input, { fire: () => fireCount++, step: () => {} });
    // Immediate second shot within cooldown
    p.update(level, 0.001, input, { fire: () => fireCount++, step: () => {} });
    expect(fireCount).toBe(1); // only one shot due to cooldown
  });

  it('stamina drains during sprint and regens otherwise', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    const level = makeLevel();
    // Sprint: forward + aim
    const sprintInput: InputState = { ...noInput(), forward: 1, fire: true, aim: true };
    p.update(level, 1, sprintInput, { fire: () => {}, step: () => {} });
    expect(p.stats.stamina).toBeLessThan(100);
    // Rest
    p.update(level, 5, noInput(), { fire: () => {}, step: () => {} });
    expect(p.stats.stamina).toBe(100);
  });

  it('mouse input changes angle and pitch', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    const level = makeLevel();
    const input = { ...noInput(), mouseDX: 100, mouseDY: 20 };
    const prevAngle = p.angle;
    const prevPitch = p.pitch;
    p.update(level, 0.016, input, { fire: () => {}, step: () => {} });
    expect(p.angle).not.toBeCloseTo(prevAngle);
    expect(p.pitch).not.toBeCloseTo(prevPitch);
  });

  it('sprint speed falls back to walk when stamina is depleted', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    const level = makeLevel();
    const sprintInput: InputState = { ...noInput(), forward: 1, fire: true, aim: true };
    // Drain stamina heavily
    for (let i = 0; i < 200; i++) p.update(level, 0.05, sprintInput, { fire: () => {}, step: () => {} });
    // Stamina should be low enough to prevent sprint (≤ 1)
    expect(p.stats.stamina).toBeLessThanOrEqual(1.5);
    // Now try to sprint — speed should be walk speed (3.0), not sprint (5.4)
    const beforeX = p.position.x;
    const beforeY = p.position.y;
    p.update(level, 1.0, sprintInput, { fire: () => {}, step: () => {} });
    const displacement = Math.hypot(p.position.x - beforeX, p.position.y - beforeY);
    // Walk speed = 3.0 for 1s = max 3.0 tiles. Sprint would be 5.4.
    expect(displacement).toBeLessThanOrEqual(3.5); // allow some tolerance for dt
  });

  it('stamina regens to maxStamina, never exceeds it', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    const level = makeLevel();
    // Drain some
    const sprintInput: InputState = { ...noInput(), forward: 1, fire: true, aim: true };
    p.update(level, 0.5, sprintInput, { fire: () => {}, step: () => {} });
    expect(p.stats.stamina).toBeLessThan(100);
    // Regenerate for a very long time
    p.update(level, 100, noInput(), { fire: () => {}, step: () => {} });
    expect(p.stats.stamina).toBe(100);
  });

  it('refill with count lower than current ammo reduces it (set, not add)', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    expect(p.ammo.pistol).toBe(36);
    p.refill('pistol', 5); // sets to 5, not 36+5
    expect(p.ammo.pistol).toBe(5);
  });

  it('refill with zero count zeroes ammo', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.refill('shotgun', 0);
    expect(p.ammo.shotgun).toBe(0);
  });

  it('refill clamps negative counts to zero ammo', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.refill('pulse_rifle', -5);
    expect(p.ammo.pulse_rifle).toBe(0);
  });

  it('removeInventory on non-existent item is no-op', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.removeInventory('nonexistent');
    expect(p.inventory.has('nonexistent')).toBe(false);
    // No throw, no side effects
  });

  it('heal when hp is 0 (dead) still restores hp', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    p.damage(100);
    expect(p.stats.hp).toBe(0);
    p.heal(10);
    expect(p.stats.hp).toBe(10);
  });

  it('pitch is clamped to [-0.5, 0.5]', () => {
    const p = new Player({ x: 5, y: 5, face: 0 });
    const level = makeLevel();
    // Extreme mouse upward
    const input = { ...noInput(), mouseDY: -99999 };
    p.update(level, 0.016, input, { fire: () => {}, step: () => {} });
    expect(p.pitch).toBeGreaterThanOrEqual(-0.5);
    // Extreme mouse downward
    const input2 = { ...noInput(), mouseDY: 99999 };
    p.update(level, 0.016, input2, { fire: () => {}, step: () => {} });
    expect(p.pitch).toBeLessThanOrEqual(0.5);
  });
});

describe('WEAPONS', () => {
  it('all weapons have positive damage and fire rate', () => {
    for (const [id, w] of Object.entries(WEAPONS)) {
      expect(w.damage).toBeGreaterThan(0);
      expect(w.fireRate).toBeGreaterThan(0);
      expect(w.id).toBe(id);
    }
  });

  it('all weapons define required fields', () => {
    for (const w of Object.values(WEAPONS)) {
      expect(w.name.length).toBeGreaterThan(0);
      expect(w.spread).toBeGreaterThanOrEqual(0);
      expect(w.pellets).toBeGreaterThanOrEqual(1);
      expect(w.range).toBeGreaterThan(0);
      expect(w.ammoCapacity).toBeGreaterThan(0);
    }
  });
});
