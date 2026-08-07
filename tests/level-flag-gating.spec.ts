import { describe, it, expect } from 'vitest';
import { listLevels } from '../src/game/levels/registry';
import { parseTags } from '../src/game/Terminal';

/**
 * Regression guard for the flag-gating bug: a locked door's `unlockFlag` must be
 * raisable somewhere in its own level, otherwise the door (and anything sealed
 * behind it, e.g. a boss) is permanently inaccessible and the level is
 * unwinnable. This is exactly the failure that left Level 2 sealed while the
 * hack-success path was hardcoded to Level 1's `door_secure_lab`/`flag_lab_terminal`.
 */
describe('level flag-gating reachability', () => {
  for (const rec of listLevels()) {
    it(`${rec.id}: every locked door has a flag source`, () => {
      const m = rec.manifest;

      // All flags a level can raise: set_flag triggers, hackable terminals'
      // own unlockFlag, and flag:X tags embedded in any transcript.
      const raisable = new Set<string>();
      for (const trig of m.triggers ?? []) {
        if (trig.type === 'set_flag' && typeof trig.data?.key === 'string') {
          raisable.add(trig.data.key);
        }
      }
      for (const inter of m.interactables) {
        if (inter.kind === 'terminal' && inter.hack && inter.unlockFlag) {
          raisable.add(inter.unlockFlag);
        }
        if (inter.transcript) {
          for (const tag of parseTags(inter.transcript)) {
            if (tag.type === 'flag') raisable.add(tag.value);
          }
        }
      }

      const sealed = m.interactables
        .filter((i) => i.kind === 'door' && i.locked && i.unlockFlag)
        .filter((i) => !raisable.has(i.unlockFlag!))
        .map((i) => `${i.id}(needs ${i.unlockFlag})`);

      expect(sealed, `permanently-sealed doors: ${sealed.join(', ')}`).toEqual([]);
    });
  }
});
