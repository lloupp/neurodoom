import fs from 'node:fs';

const path = 'src/game/index.ts';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source = source.replace(from, to);
}

replaceOnce(
  "import { listLevels, findLevel } from './levels/registry';",
  "import { listLevels, findLevel } from './levels/registry';\nimport { buildExportedGameSave, buildGameSaveData, parseExportedGameSave, parseStoredGameSave, type GameSaveData } from './SaveState';",
  'SaveState import',
);

replaceOnce(
`  private exportSave(): void {
    const snap = {
      ...this.player.snapshot(),
      flags: [...this.flags],
      level: this.levelState.data!.manifest.id,
      time: this.playTimeMs,
    };
    const blob = new Blob([JSON.stringify({ schema_version: 1, saved_at: Date.now(), data: snap }, null, 2)], {
      type: 'application/json',
    });`,
`  private exportSave(): void {
    const snap = buildGameSaveData(
      this.player.snapshot(),
      this.flags,
      this.levelState.data!.manifest.id,
      this.playTimeMs,
    );
    const blob = new Blob([JSON.stringify(buildExportedGameSave(snap), null, 2)], {
      type: 'application/json',
    });`,
  'export save',
);

replaceOnce(
`  private async importSave(file: File): Promise<void> {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { data: unknown };
      await writeSlot(SAVE_SLOT, parsed.data, this.playTimeMs);
      await this.load();
    } catch {
      // Malformed/foreign file — ignore rather than crash the session.
    }
  }`,
`  private async importSave(file: File): Promise<void> {
    try {
      const text = await file.text();
      const parsed = parseExportedGameSave(JSON.parse(text));
      // Reject malformed, unsupported-schema, or unknown-level imports before
      // touching the existing slot. A bad file must never destroy a good save.
      if (!parsed || !findLevel(parsed.data.level)) return;
      await writeSlot(SAVE_SLOT, parsed.data, parsed.data.time);
      await this.load();
    } catch {
      // Malformed/foreign file — ignore rather than crash the session.
    }
  }`,
  'import save',
);

replaceOnce(
`  async save(): Promise<void> {
    const snap = {
      ...this.player.snapshot(),
      flags: [...this.flags],
      level: this.levelState.data!.manifest.id,
      time: this.playTimeMs,
    };
    await writeSlot(SAVE_SLOT, snap, this.playTimeMs);
  }

  async load(): Promise<boolean> {
    const rec = await readSlot(SAVE_SLOT);
    if (!rec) return false;
    const data = rec.data as {
      px: number; py: number; angle: number; pitch: number; fov: number;
      stats: Player['stats']; weapon: WeaponId; ammo: Player['ammo']; inventory: string[];
      flags: string[]; level: string; time: number;
    };

    // World flags must exist before the level runtime is reconstructed because
    // loadLevelById uses them to reopen flag-gated doors.
    this.flags = new Set(data.flags);
    if (!this.loadLevelById(data.level, false)) return false;

    // Restore every player field that snapshot() persists. Avoid sharing mutable
    // objects with parsed save data so gameplay cannot mutate the save payload.
    this.player.position = { x: data.px, y: data.py };
    this.player.angle = data.angle;
    this.player.pitch = data.pitch;
    this.player.fov = data.fov;
    this.player.weapon = data.weapon;
    this.player.stats = { ...data.stats };
    this.player.ammo = { ...data.ammo };
    this.player.setInventory(data.inventory);
    this.playTimeMs = data.time;
    this.lastAutosaveMs = data.time;
    return true;
  }`,
`  async save(): Promise<void> {
    const snap = buildGameSaveData(
      this.player.snapshot(),
      this.flags,
      this.levelState.data!.manifest.id,
      this.playTimeMs,
    );
    await writeSlot(SAVE_SLOT, snap, this.playTimeMs);
  }

  /** Reads and validates an IndexedDB slot without mutating live game state. */
  private async readValidSave(): Promise<GameSaveData | null> {
    const rec = await readSlot(SAVE_SLOT).catch(() => undefined);
    const data = parseStoredGameSave(rec);
    if (!data || !findLevel(data.level)) return null;
    return data;
  }

  async load(): Promise<boolean> {
    const data = await this.readValidSave();
    if (!data) return false;

    // World flags must exist before the level runtime is reconstructed because
    // loadLevelById uses them to reopen flag-gated doors.
    this.flags = new Set(data.flags);
    if (!this.loadLevelById(data.level, false)) return false;

    this.player.position = { x: data.px, y: data.py };
    this.player.angle = data.angle;
    this.player.pitch = data.pitch;
    this.player.fov = data.fov;
    this.player.weapon = data.weapon;
    this.player.stats = { ...data.stats };
    this.player.ammo = { ...data.ammo };
    this.player.setInventory(data.inventory);
    this.playTimeMs = data.time;
    this.lastAutosaveMs = data.time;
    return true;
  }`,
  'save/load block',
);

replaceOnce(
  '      hasSave: !!await readSlot(SAVE_SLOT).catch(() => null),',
  '      hasSave: !!await this.readValidSave(),',
  'continue availability',
);

fs.writeFileSync(path, source);
console.log('Save validation integration applied.');
