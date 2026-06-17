import type { Listener } from './types';

// Tiny typed pub/sub. No deps.

export class EventBus<EventMap extends Record<string, unknown>> {
  private readonly listeners: { [K in keyof EventMap]?: Set<Listener<EventMap[K]>> } = {};

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event]!.add(listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    this.listeners[event]?.delete(listener);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners[event];
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[EventBus] listener for ${String(event)} threw`, err);
      }
    }
  }

  clear<K extends keyof EventMap>(event?: K): void {
    if (event) {
      this.listeners[event]?.clear();
    } else {
      for (const k of Object.keys(this.listeners)) {
        this.listeners[k as keyof EventMap]?.clear();
      }
    }
  }
}
