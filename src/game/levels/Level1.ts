import type { MapManifest } from '../MapSchema';

const level1: MapManifest = {
  id: 'sublevel_3',
  name: 'Sublevel 3 — Meridian Blacksite',
  author: 'neurodoom-system',
  cellSize: 1,
  spawn: { x: 2.5, y: 2.5, face: 0 },
  // 32x20 — 8 logical rooms connected by corridors.
  // tile legend: '#'=solid '.=empty D'=door M'=metal P'=panel X'=circuit S'=screen O'=organic
  // walkable surfaces (SPEC 4.2 footstep palette): 'g'=metal grating 'w'=organic floor
  tiles: [
    '################################',
    '#......D.......#..............##',
    '#......D.......#..............##',
    '#.....###.....##.######.......##',
    '#.....#.#.....##.#....#.......##',
    '#.....#.#.....##.#....#.......##',
    '#.....#.#.....##.#....D.......S#',
    '#.....#.#.....##.#....#.......##',
    '#.....#.#.....##.######.......##',
    '#.....#.#......M........g.w...##',
    '#.....#.#......#..............##',
    '#.....#.#......#.#######......##',
    '#.....#.#......#.#.....#......##',
    '#.....#.#......#.#.....#......##',
    '#.....#.#......M.#.....#......##',
    '#.....#.#......#.#.....#......##',
    '#.....#.#......#.#.....#......S#',
    '#.....#.#......#.M.....#......##',
    '#.....#.#......#.###D###.......#',
    '################################',
  ],
  enemies: [
    {
      kind: 'drone',
      x: 17,
      y: 6,
      patrol: [
        [16, 6],
        [22, 6],
        [22, 16],
        [16, 16],
      ],
      sight: 8,
    },
    {
      kind: 'heavy',
      x: 11,
      y: 14,
      patrol: [
        [10, 13],
        [14, 13],
        [14, 17],
        [10, 17],
      ],
      sight: 7,
    },
    {
      kind: 'ghost',
      x: 27,
      y: 4,
      patrol: [
        [26, 2],
        [29, 2],
        [29, 8],
        [26, 8],
      ],
      sight: 6,
    },
    {
      kind: 'turret',
      x: 27,
      y: 17,
      patrol: [],
      sight: 9,
    },
    {
      // SHIVA's warden — sealed behind door_secure_lab, the run's climactic
      // encounter. Killing it ends the run (see Game.update's win check).
      kind: 'boss',
      x: 20,
      y: 14,
      patrol: [],
      sight: 10,
    },
  ],
  interactables: [
    { id: 'door_entry_to_corridor', kind: 'door', x: 7, y: 1, locked: false, unlockFlag: undefined },
    { id: 'door_corridor_to_lab1', kind: 'door', x: 15, y: 2, locked: false, unlockFlag: undefined },
    { id: 'door_corridor_to_lab2', kind: 'door', x: 15, y: 7, locked: false, unlockFlag: undefined },
    { id: 'door_lab2_hub', kind: 'door', x: 22, y: 6, locked: false, unlockFlag: undefined },
    { id: 'door_terminal_room', kind: 'door', x: 12, y: 11, locked: false, unlockFlag: undefined },
    { id: 'door_secure_lab', kind: 'door', x: 20, y: 18, locked: true, unlockFlag: 'flag_lab_terminal' },

    { id: 'terminal_lab_info', kind: 'terminal', x: 9, y: 4, hack: false,
      prompt: 'Lab terminal // STATION 3',
      transcript: '> Audit log: Subject 14 woke during SHIVA transfer.\n> Cleaners dispatched. Don\u2019t trust the audio feed.\n> [SYS] flag:story.cleaners_dispatched spawn:Ghost.drone' },

    { id: 'terminal_lock_lab',  kind: 'terminal', x: 9, y: 14, hack: true,
      prompt: 'Secure lab terminal',
      unlockFlag: 'flag_lab_terminal',
      transcript: '> SHIVA mark 0xCAFE attempted remote override. Wake protocol: /jack/.\n> Subject 14 is you. Don\u2019t listen to the lullabies.' },

    { id: 'log_first', kind: 'audio_log', x: 4, y: 6,
      prompt: 'Audio Log // SUBJECT 14',
      audioKey: 'log_subject_14',
      transcript: 'I can hear the static through the walls. They call it SHIVA here. I keep hearing my mother.' },
    { id: 'log_shiva',  kind: 'audio_log', x: 18, y: 1,
      prompt: 'Audio Log // SHIVA',
      audioKey: 'log_shiva',
      transcript: 'Subjects are armature. The signal passes through. They wake when we sleep them.' },
    { id: 'keycard_red', kind: 'keycard', x: 11, y: 2,
      prompt: 'Red keycard — ID override' },
    { id: 'medkit_1', kind: 'medkit', x: 3, y: 18,
      prompt: 'Field Medkit' },
    { id: 'ammo_1',   kind: 'ammo', x: 20, y: 15,
      prompt: 'Pulse Rifle ammo — sealed behind the secure lab door' },
  ],
  triggers: [
    { x: 14, y: 12, type: 'spawn_ghost', data: { kind: 'heavy' } },
  ],
  zones: [
    { x: 0, y: 0, w: 8, h: 19, name: 'Holding Cell — Subject 14' },
    { x: 8, y: 0, w: 8, h: 19, name: 'Research Annex' },
    { x: 16, y: 0, w: 16, h: 3, name: 'Sublevel Access Corridor' },
    { x: 16, y: 3, w: 8, h: 8, name: 'Lab 2 — SHIVA Relay' },
    { x: 16, y: 11, w: 8, h: 8, name: 'Secure Lab — Warden’s Vault' },
    { x: 24, y: 3, w: 8, h: 16, name: 'East Wing' },
  ],
};

export default level1;
export const LEVEL_1 = level1;
