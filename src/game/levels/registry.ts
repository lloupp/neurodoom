import type { MapManifest } from '../MapSchema';
import level1 from './Level1';

export interface LevelRecord {
  id: string;
  name: string;
  manifest: MapManifest;
}

const records: LevelRecord[] = [
  { id: level1.id, name: level1.name, manifest: level1 },
];

export function listLevels(): LevelRecord[] {
  return records;
}

export function findLevel(id: string): LevelRecord | undefined {
  return records.find((r) => r.id === id);
}
