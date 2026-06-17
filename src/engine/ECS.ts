import type { EntityId } from './types';

// Mini-ECS — designed for clarity, not raw throughput.
// Each entity stores its components in a Map. Systems query via `.all(comp)`.

export type ComponentKey = string & { readonly __brand: 'ComponentKey' };
export const defineComponent = (name: string): ComponentKey => name as ComponentKey;

export type ComponentMap = Record<ComponentKey, unknown>;

export interface Entity<M extends ComponentMap> {
  readonly id: EntityId;
  components: { [K in keyof M]?: M[K] };
}

export class World<M extends ComponentMap> {
  private readonly entities = new Map<EntityId, Entity<M>>();
  private nextId: EntityId = 1;

  create(initial: Partial<{ [K in keyof M]: M[K] }> = {}): Entity<M> {
    const id = this.nextId++;
    const ent = { id, components: { ...initial } } as Entity<M>;
    this.entities.set(id, ent);
    return ent;
  }

  destroy(id: EntityId): void {
    this.entities.delete(id);
  }

  get(id: EntityId): Entity<M> | undefined {
    return this.entities.get(id);
  }

  set<K extends keyof M>(id: EntityId, key: K, value: M[K]): void {
    const ent = this.entities.get(id);
    if (!ent) throw new Error(`ECS.set: no entity ${id}`);
    ent.components[key] = value;
  }

  add<K extends keyof M>(id: EntityId, key: K, value: M[K]): void {
    this.set(id, key, value);
  }

  remove<K extends keyof M>(id: EntityId, key: K): void {
    const ent = this.entities.get(id);
    if (!ent) return;
    delete ent.components[key];
  }

  has<K extends keyof M>(id: EntityId, key: K): boolean {
    return this.entities.get(id)?.components[key] !== undefined;
  }

  all<K extends keyof M>(require: K[]): Entity<M>[] {
    const out: Entity<M>[] = [];
    for (const ent of this.entities.values()) {
      let ok = true;
      for (const k of require) if (ent.components[k] === undefined) { ok = false; break; }
      if (ok) out.push(ent);
    }
    return out;
  }

  count(): number { return this.entities.size; }
  clear(): void { this.entities.clear(); }
}

export interface SystemCtx<M extends ComponentMap> {
  world: World<M>;
  dt: number;
  time: number;
}

export type System<M extends ComponentMap> = (ctx: SystemCtx<M>) => void;
