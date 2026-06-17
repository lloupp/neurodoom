import type { Watch } from './types';

// Lightweight observable single-value store. Used for HUD-bound reactive bits.
// Not the same as the EventBus (which is event-style); this is state-cell style.

const subs = new WeakMap<object, Set<(v: unknown) => void>>();

export function cell<T>(initial: T): { get: () => T; set: (v: T) => void; watch: Watch<T>; } {
  let value = initial;
  const obj = {};
  const set = (next: T) => {
    if (Object.is(value, next)) return;
    value = next;
    const set = subs.get(obj);
    if (set) for (const fn of set) fn(value);
  };
  const watch: Watch<T> = (fn) => {
    let arr = subs.get(obj);
    if (!arr) { arr = new Set(); subs.set(obj, arr); }
    arr.add(fn as (v: unknown) => void);
    return () => arr!.delete(fn as (v: unknown) => void);
  };
  return { get: () => value, set, watch };
}
