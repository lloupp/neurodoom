import { describe, it, expect } from 'vitest';
import { cell } from '../src/engine/State';

describe('cell (reactive state)', () => {
  it('holds initial value', () => {
    const c = cell(42);
    expect(c.get()).toBe(42);
  });

  it('sets new value', () => {
    const c = cell(0);
    c.set(10);
    expect(c.get()).toBe(10);
  });

  it('does not notify when setting same value (Object.is)', () => {
    const c = cell(5);
    let callCount = 0;
    c.watch(() => { callCount++; });
    c.set(5); // same value
    expect(callCount).toBe(0);
  });

  it('notifies watchers on change', () => {
    const c = cell(0);
    const values: number[] = [];
    c.watch((v) => values.push(v));
    c.set(10);
    c.set(20);
    expect(values).toEqual([10, 20]);
  });

  it('unsubscribes when unsubscribe function is called', () => {
    const c = cell(0);
    const values: number[] = [];
    const unsub = c.watch((v) => values.push(v));
    c.set(10);
    unsub();
    c.set(20);
    expect(values).toEqual([10]); // only got 10
  });

  it('supports multiple watchers', () => {
    const c = cell(0);
    const a: number[] = [];
    const b: number[] = [];
    c.watch((v) => a.push(v));
    c.watch((v) => b.push(v));
    c.set(1);
    expect(a).toEqual([1]);
    expect(b).toEqual([1]);
  });

  it('works with object values', () => {
    const c = cell({ x: 0 });
    const vals: object[] = [];
    c.watch((v) => vals.push(v));
    c.set({ x: 1 });
    expect(vals.length).toBe(1);
    expect(vals[0]).toEqual({ x: 1 });
  });

  it('does not notify for NaN-to-NaN (Object.is treats NaN !== NaN)', () => {
    const c = cell(NaN);
    let calls = 0;
    c.watch(() => calls++);
    c.set(NaN);
    // Object.is(NaN, NaN) is true, so no notification
    expect(calls).toBe(0);
  });

  it('notifies for 0 to -0 (Object.is treats 0 !== -0)', () => {
    const c = cell(0);
    let calls = 0;
    c.watch(() => calls++);
    c.set(-0);
    expect(calls).toBe(1);
  });
});
