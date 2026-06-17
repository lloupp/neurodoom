/**
 * Persistence — thin wrapper over idb-keyval style API.
 *
 * We avoid pulling the idb-keyval dep to keep zero runtime deps;
 * the IndexedDB patterns here are ~100 LOC. Saves are atomic via tx.
 *
 * Shape: every save = a single record keyed by slot. The record
 * contains the game-state tree plus a `schema_version` field, so
 * future migrations can detect and rewrite older saves cleanly.
 */

const DB = 'neurodoom';
const STORE = 'saves';
const DB_VERSION = 1;

const SCHEMA_VERSION = 1 as const;

export interface SaveRecord {
  schema_version: typeof SCHEMA_VERSION;
  saved_at: number;
  play_time_ms: number;
  data: unknown;
}

interface DBSlotResolverFallback {
  (req: IDBRequest<unknown>): unknown;
}
void (null as unknown as DBSlotResolverFallback);

const resolveRequest = <T,>(req: IDBRequest<T>): T => req.result as unknown as T;

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const withStore = <T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => resolve(resolveRequest<T>(result));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
};

export async function writeSlot(key: string, data: unknown, playTimeMs: number): Promise<void> {
  const rec: SaveRecord = {
    schema_version: SCHEMA_VERSION,
    saved_at: Date.now(),
    play_time_ms: playTimeMs,
    data,
  };
  await withStore('readwrite', (store) => store.put(rec, key));
}

export async function readSlot(key: string): Promise<SaveRecord | undefined> {
  return withStore<SaveRecord | undefined>('readonly', (store) => store.get(key) as IDBRequest<SaveRecord | undefined>);
}

export async function listSlots(): Promise<string[]> {
  return withStore<string[]>('readonly', (store) => store.getAllKeys() as IDBRequest<string[]>);
}

export async function deleteSlot(key: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(key));
}

export const SAVE_SLOT = 'slot-0';
export const SAVE_AUTOSAVE = 'autosave';
