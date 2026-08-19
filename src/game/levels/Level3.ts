import type { MapManifest } from '../MapSchema';

/**
 * Level 3 — The Spire
 * A vertical facility with tight corridors and spitter ambushes.
 */
const level3: MapManifest = {
  id: 'the_spire',
  name: 'The Spire — Vertical Facility',
  author: 'neurodoom-system',
  cellSize: 1,
  spawn: { x: 2.5, y: 24.5, face: 180 },
  // 40x30 — Multi-deck spire with ramps, verticality via stairs
  // tile legend: '#'=solid '.=empty D'=door M'=metal P'=panel X'=circuit S'=screen O'=organic
  tiles: [
    '########################################',
    '#........D...............#............##',
    '#........D...............#............##',
    '#........D...........###.#............##',
    '#........D...........#.#.#............##',
    '#........D...........#.#S....D..D....###',
    '#........D...........#.#.#............##',
    '#........D...........#.#............D###',
    '#........D...........###............D###',
    '#........D.........................D####',
    '#........D....................M.....D###',
    '#........D....................M.....D###',
    '#........D....................M.....D###',
    '#........D....................M.....D###',
    '#........D....................M.....D###',
    '#........D....................M.....D###',
    '#........D....................M.....D###',
    '#........D....................M.....D###',
    '#........D....................M.....D###',
    '#........D....................M.....D###',
    '#........D....................M.....D###',
    '#........D....................M.....D###',
    '#...............D...............D.....##',
    '#...............D...............D.....##',
    '#...............D...............D.....##',
    '########################################',
  ],
  enemies: [
    {
      kind: 'spitter',
      x: 5,
      y: 5,
      patrol: [
        [4, 4],
        [8, 4],
        [8, 7],
        [4, 7],
      ],
      sight: 10,
    },
    {
      kind: 'spitter',
      x: 28,
      y: 5,
      patrol: [
        [27, 4],
        [31, 4],
        [31, 7],
        [27, 7],
      ],
      sight: 10,
    },
    {
      kind: 'brute',
      x: 15,
      y: 12,
      patrol: [
        [14, 11],
        [16, 11],
        [16, 15],
        [14, 15],
      ],
      sight: 6,
    },
    {
      kind: 'brute',
      x: 23,
      y: 15,
      patrol: [
        [22, 14],
        [24, 14],
        [24, 18],
        [22, 18],
      ],
      sight: 6,
    },
    {
      kind: 'spitter',
      x: 20,
      y: 22,
      patrol: [
        [19, 21],
        [23, 21],
        [23, 25],
        [19, 25],
      ],
      sight: 10,
    },
  ],
  interactables: [
    { id: 'door_spire_1', kind: 'door', x: 7, y: 1, locked: false },
    { id: 'door_spire_2', kind: 'door', x: 19, y: 4, locked: false },
    { id: 'door_spire_3', kind: 'door', x: 28, y: 7, locked: false },
    { id: 'door_spire_4', kind: 'door', x: 11, y: 11, locked: false },
    { id: 'door_spire_5', kind: 'door', x: 20, y: 11, locked: false },
    { id: 'door_spire_6', kind: 'door', x: 28, y: 15, locked: false },
    { id: 'door_spire_7', kind: 'door', x: 22, y: 19, locked: true, unlockFlag: 'flag_brute_clear' },

    { id: 'terminal_spire', kind: 'terminal', x: 35, y: 8, hack: true,
      prompt: 'Spire Terminal // CONTROL NODE 7',
      unlockFlag: 'flag_spire_hack',
      transcript: '> Vertical transport network at 87% capacity. Maintenance bots offline.\n> Spitter nest detected in upper decks. Recommend flamethrower protocol.\n> Note: Brutes can breach standard bulkheads.' },

    { id: 'terminal_breach', kind: 'terminal', x: 12, y: 15, hack: true,
      prompt: 'Breach Alert Console',
      unlockFlag: 'flag_breach_cleared',
      transcript: '> Containment breach in sector C-17. Spitter toxins are corrosive.\n> Brutes are immune to small arms. Heavy weapons required.\n> Access to core room requires brute-neutralization.' },

    { id: 'log_spire_1', kind: 'audio_log', x: 4, y: 4,
      prompt: 'Audio Log // ENGINEERING BAY 3',
      audioKey: 'log_spire_eng',
      transcript: 'The vertical lifts are jammed. Spitters have colonized the shafts.\nThey use the ventilation to spit down on us. I can hear them clicking.' },

    { id: 'log_spire_2', kind: 'audio_log', x: 37, y: 4,
      prompt: 'Audio Log // SECURITY CHIEF MORRIS',
      audioKey: 'log_spire_sec',
      transcript: 'Brutes aren\'t vulnerable to standard rounds. We tried everything.\nThe armor plating is ceramic-composite. Needs shaped charge or mag-cutter.' },

    { id: 'keycard_spire', kind: 'keycard', x: 10, y: 14,
      prompt: 'Spire keycard — level 4 access' },

    { id: 'ammo_spire', kind: 'ammo', x: 38, y: 10,
      prompt: 'Heavy ammo cache' },

    { id: 'medkit_spire', kind: 'medkit', x: 4, y: 18,
      prompt: 'Field Medkit' },
  ],
  triggers: [
    { x: 25, y: 18, type: 'set_flag', data: { key: 'flag_brute_clear' } },
    { x: 35, y: 9, type: 'set_flag', data: { key: 'flag_spire_hack' } },
    { x: 12, y: 16, type: 'set_flag', data: { key: 'flag_breach_cleared' } },
    { x: 30, y: 20, type: 'spawn_ghost', data: { kind: 'spitter' } },
    { x: 5, y: 20, type: 'set_flag', data: { key: 'flag_exit_level', next: 'underground_lab' } },
  ],
  zones: [
    { x: 0, y: 0, w: 10, h: 6, name: 'Upper Spire Entry' },
    { x: 10, y: 0, w: 28, h: 6, name: 'Mid-Deck Maintenance' },
    { x: 20, y: 6, w: 20, h: 6, name: 'Vertical Lift Shaft' },
    { x: 0, y: 6, w: 10, h: 14, name: 'Lower Deck Access' },
    { x: 12, y: 6, w: 18, h: 14, name: 'Spitter Nest Zone' },
    { x: 30, y: 6, w: 10, h: 14, name: 'Brute Parking' },
    { x: 0, y: 20, w: 40, h: 6, name: 'Core Access Corridor' },
  ],
};

export default level3;
export const LEVEL_3 = level3;
