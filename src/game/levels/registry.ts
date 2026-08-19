import type { MapManifest } from '../MapSchema';
import level1 from './Level1';
import level2 from './Level2';
import level3 from './Level3';
import level4 from './Level4';

export interface LevelRecord {
  id: string;
  name: string;
  manifest: MapManifest;
}

const records: LevelRecord[] = [
  { id: level1.id, name: level1.name, manifest: level1 },
  { id: level2.id, name: level2.name, manifest: level2 },
  { id: level3.id, name: level3.name, manifest: level3 },
  { id: level4.id, name: level4.name, manifest: level4 },
];

export function listLevels(): LevelRecord[] {
  return records;
}

export function findLevel(id: string): LevelRecord | undefined {
  return records.find((r) => r.id === id);
}