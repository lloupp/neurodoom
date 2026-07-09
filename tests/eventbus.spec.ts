import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/engine/EventBus';

interface TestEvents {
  [key: string]: unknown;
  startup: undefined;
  tick: number;
  damage: { amount: number; source: string };
  playerDied: undefined;
}

describe('EventBus', () => {
  it('calls listener on emit', () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    bus.on('tick', (dt) => received.push(dt));
    bus.emit('tick', 16);
    expect(received).toEqual([16]);
  });

  it('calls multiple listeners for same event', () => {
    const bus = new EventBus<TestEvents>();
    const a: number[] = [];
    const b: number[] = [];
    bus.on('tick', (dt) => a.push(dt));
    bus.on('tick', (dt) => b.push(dt));
    bus.emit('tick', 1);
    expect(a).toEqual([1]);
    expect(b).toEqual([1]);
  });

  it('does not call listener after unsubscribe', () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    const unsub = bus.on('tick', (dt) => received.push(dt));
    bus.emit('tick', 1);
    unsub();
    bus.emit('tick', 2);
    expect(received).toEqual([1]);
  });

  it('off removes specific listener', () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    const listener = (dt: number) => received.push(dt);
    bus.on('tick', listener);
    bus.emit('tick', 10);
    bus.off('tick', listener);
    bus.emit('tick', 20);
    expect(received).toEqual([10]);
  });

  it('emit with no listeners is a no-op (does not throw)', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit('startup', undefined)).not.toThrow();
  });

  it('passes structured payloads correctly', () => {
    const bus = new EventBus<TestEvents>();
    let received: TestEvents['damage'] | undefined;
    bus.on('damage', (payload) => { received = payload; });
    bus.emit('damage', { amount: 25, source: 'drone' });
    expect(received).toEqual({ amount: 25, source: 'drone' });
  });

  it('listener error does not break other listeners or emit', () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    bus.on('tick', () => { throw new Error('boom'); });
    bus.on('tick', (dt) => received.push(dt));
    // Should not throw; second listener still gets called
    bus.emit('tick', 42);
    expect(received).toEqual([42]);
  });

  it('clear(event) removes listeners for that event only', () => {
    const bus = new EventBus<TestEvents>();
    const ticks: number[] = [];
    const deaths: undefined[] = [];
    bus.on('tick', (dt) => ticks.push(dt));
    bus.on('playerDied', () => deaths.push(undefined));
    bus.clear('tick');
    bus.emit('tick', 1);
    bus.emit('playerDied', undefined);
    expect(ticks).toEqual([]);
    expect(deaths.length).toBe(1);
  });

  it('clear() with no args removes all listeners', () => {
    const bus = new EventBus<TestEvents>();
    const ticks: number[] = [];
    const deaths: undefined[] = [];
    bus.on('tick', (dt) => ticks.push(dt));
    bus.on('playerDied', () => deaths.push(undefined));
    bus.clear();
    bus.emit('tick', 1);
    bus.emit('playerDied', undefined);
    expect(ticks).toEqual([]);
    expect(deaths).toEqual([]);
  });

  it('handles re-subscribe after clear', () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    bus.on('tick', (dt) => received.push(dt));
    bus.clear('tick');
    bus.on('tick', (dt) => received.push(dt * 10));
    bus.emit('tick', 5);
    expect(received).toEqual([50]);
  });

  it('off for non-existent event is a no-op', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.off('tick', () => {})).not.toThrow();
  });

  it('emit delivers to listeners in subscription order', () => {
    const bus = new EventBus<TestEvents>();
    const order: string[] = [];
    bus.on('startup', () => order.push('a'));
    bus.on('startup', () => order.push('b'));
    bus.on('startup', () => order.push('c'));
    bus.emit('startup', undefined);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('unsubscribe mid-emit does not skip subsequent listeners', () => {
    const bus = new EventBus<TestEvents>();
    const order: string[] = [];
    const unsub = bus.on('startup', () => { order.push('a'); unsub(); });
    bus.on('startup', () => order.push('b'));
    bus.emit('startup', undefined);
    // 'a' fires and unsubscribes; 'b' still fires (Set iteration is safe)
    expect(order).toEqual(['a', 'b']);
  });
});
