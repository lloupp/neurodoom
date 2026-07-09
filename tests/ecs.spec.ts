import { describe, it, expect } from 'vitest';
import { World } from '../src/engine/ECS';

interface Components {
  pos: { x: number; y: number };
  vel: { dx: number; dy: number };
  hp: number;
}

describe('ECS World', () => {
  it('creates entities with sequential IDs', () => {
    const w = new World<Components>();
    const e1 = w.create({ pos: { x: 0, y: 0 } });
    const e2 = w.create({ pos: { x: 1, y: 1 } });
    expect(e1.id).toBe(1);
    expect(e2.id).toBe(2);
    expect(w.count()).toBe(2);
  });

  it('creates entity with empty components by default', () => {
    const w = new World<Components>();
    const e = w.create();
    expect(e.id).toBe(1);
    expect(e.components.pos).toBeUndefined();
    expect(w.count()).toBe(1);
  });

  it('gets entity by ID', () => {
    const w = new World<Components>();
    const e = w.create({ pos: { x: 5, y: 5 } });
    const found = w.get(e.id);
    expect(found).toBeDefined();
    expect(found!.components.pos).toEqual({ x: 5, y: 5 });
  });

  it('returns undefined for non-existent entity', () => {
    const w = new World<Components>();
    expect(w.get(999)).toBeUndefined();
  });

  it('sets and gets component on existing entity', () => {
    const w = new World<Components>();
    const e = w.create({ pos: { x: 0, y: 0 } });
    w.set(e.id, 'hp', 100);
    expect(e.components.hp).toBe(100);
  });

  it('add is an alias for set', () => {
    const w = new World<Components>();
    const e = w.create();
    w.add(e.id, 'hp', 50);
    expect(e.components.hp).toBe(50);
  });

  it('set throws on non-existent entity', () => {
    const w = new World<Components>();
    expect(() => w.set(999, 'hp', 10)).toThrow('ECS.set: no entity 999');
  });

  it('removes a component from entity', () => {
    const w = new World<Components>();
    const e = w.create({ pos: { x: 0, y: 0 }, hp: 100 });
    w.remove(e.id, 'hp');
    expect(e.components.hp).toBeUndefined();
  });

  it('remove on non-existent entity does NOT throw', () => {
    const w = new World<Components>();
    expect(() => w.remove(999, 'hp')).not.toThrow();
  });

  it('has returns true when component is present', () => {
    const w = new World<Components>();
    const e = w.create({ pos: { x: 0, y: 0 }, hp: 100 });
    expect(w.has(e.id, 'pos')).toBe(true);
    expect(w.has(e.id, 'hp')).toBe(true);
    expect(w.has(e.id, 'vel')).toBe(false);
  });

  it('queries all entities matching required components', () => {
    const w = new World<Components>();
    w.create({ pos: { x: 0, y: 0 }, hp: 100 });
    w.create({ pos: { x: 1, y: 1 }, hp: 50 });
    w.create({ pos: { x: 2, y: 2 } }); // no hp
    w.create({ hp: 30 }); // no pos
    const withBoth = w.all(['pos', 'hp']);
    expect(withBoth.length).toBe(2);
  });

  it('queries all with single component requirement', () => {
    const w = new World<Components>();
    w.create({ pos: { x: 0, y: 0 } });
    w.create({ pos: { x: 1, y: 1 }, hp: 100 });
    w.create({ hp: 30 });
    expect(w.all(['pos']).length).toBe(2);
    expect(w.all(['hp']).length).toBe(2);
  });

  it('destroys entity and it no longer appears in queries', () => {
    const w = new World<Components>();
    const e = w.create({ pos: { x: 0, y: 0 } });
    expect(w.count()).toBe(1);
    w.destroy(e.id);
    expect(w.count()).toBe(0);
    expect(w.get(e.id)).toBeUndefined();
    expect(w.all(['pos']).length).toBe(0);
  });

  it('clear removes all entities', () => {
    const w = new World<Components>();
    w.create({ pos: { x: 0, y: 0 } });
    w.create({ pos: { x: 1, y: 1 } });
    w.clear();
    expect(w.count()).toBe(0);
  });

  it('does not match entity with component value undefined', () => {
    const w = new World<Components>();
    w.create();
    // pos is undefined, should not match ['pos'] query
    expect(w.all(['pos']).length).toBe(0);
  });
});
