import type { MapManifest } from '../MapSchema';

/**
 * Level 4 — Underground Lab: Core Access
 *
 * A multi-wing underground facility with distinct room themes:
 *  - Entry Corridor with holding alcoves (north-west)
 *  - Testing Labs with interior walls and emissive screens (north-center)
 *  - Bio-Chamber with organic walls (north-east)
 *  - Lower Facility with grating floors and storage rooms (mid-west)
 *  - Central Complex with sub-divided chambers (mid-center)
 *  - Spitter Vents with organic walls and floor (mid-east)
 *  - Brute Containment with heavy metal/concrete barriers (south-west)
 *  - Core Access corridor with cover pillars (south-center)
 *  - Spitter Nest with circuit hazards (south-east)
 *  - Core Approach — wide exit corridor to the facility core
 *
 * tile legend: #=solid D=door M=metal P=panel X=circuit S=screen
 *              O=organic C=concrete g=metal grate w=organic floor
 */
const level4: MapManifest = {
  id: 'underground_lab',
  name: 'Underground Lab — Core Access',
  author: 'neurodoom-system',
  cellSize: 1,
  spawn: { x: 2.5, y: 2.5, face: 0 },
  tiles: [
    '#############################################',
    '#........#.....#.....#.........O......S.....#',
    '#........D...S.#..g..#.........D......S.....#',
    '#....D...D.....D.Sg..D...S.....O......S.....#',
    '#........#g....#..g..#..w.w....O......S.....#',
    '##########gg...#.....#...g.....O#############',
    '####D#####g##############g###################',
    '#.....M....#......g#.....g.O................#',
    '#.....M....#...S..g#..C....O................#',
    '#.....M....#......g#..C....O................#',
    '#.....D....D......gD..D....D................#',
    '#.....M....#.......#..C....O................#',
    '#.....M....#.......#S.C....O................#',
    '#.....M....#.......#.......O................#',
    '#############################################',
    '##########D##############g###################',
    '#...P.M..C...#......M....g...O......X.......#',
    '#...P.M..C...#.....#M..S.g...O..S...X.......#',
    '#...P.M..C...#.....#M....#...O......X.......#',
    '#...D.D..D...D.....#D....#...D......D.......#',
    '#...P.M..C...#..S..#M....#...O......X.......#',
    '#...P.M..C...#.....#M....#...O......X.......#',
    '#...P.M..C...#......M........O......X.......#',
    '############D###############D################',
    '#................................C..........#',
    '#.........#.........#....g.......C.S........#',
    '#.........#.........#....g.......C..........#',
    '#........................g.......C..........#',
    '##############################...C.........##',
    '#############################################',
  ],
  enemies: [
    {
      kind: 'drone',
      x: 12,
      y: 3,
      patrol: [
        [11, 2],
        [18, 2],
        [18, 4],
        [11, 4],
      ],
      sight: 8,
    },
    {
      kind: 'heavy',
      x: 16,
      y: 9,
      patrol: [
        [15, 8],
        [20, 8],
        [20, 12],
        [15, 12],
      ],
      sight: 7,
    },
    {
      kind: 'ghost',
      x: 5,
      y: 11,
      patrol: [
        [4, 10],
        [8, 10],
        [8, 12],
        [4, 12],
      ],
      sight: 6,
    },
    {
      kind: 'spitter',
      x: 34,
      y: 10,
      patrol: [
        [33, 9],
        [38, 9],
        [38, 12],
        [33, 12],
      ],
      sight: 10,
    },
    {
      kind: 'brute',
      x: 5,
      y: 19,
      patrol: [
        [4, 18],
        [8, 18],
        [8, 21],
        [4, 21],
      ],
      sight: 5,
    },
    {
      kind: 'spitter',
      x: 36,
      y: 17,
      patrol: [
        [35, 16],
        [39, 16],
        [39, 21],
        [35, 21],
      ],
      sight: 10,
    },
    {
      kind: 'brute',
      x: 8,
      y: 19,
      patrol: [],
      sight: 5,
    },
  ],
  interactables: [
    { id: 'door_entry_hub', kind: 'door', x: 9, y: 2, locked: false },
    { id: 'door_corridor_to_labs', kind: 'door', x: 15, y: 2, locked: false },
    { id: 'door_labs_interior', kind: 'door', x: 15, y: 3, locked: false },
    { id: 'door_labs_to_bio', kind: 'door', x: 21, y: 3, locked: false },
    { id: 'door_bio_to_screen', kind: 'door', x: 31, y: 2, locked: false },

    { id: 'terminal_lab_access', kind: 'terminal', x: 3, y: 2, hack: true,
      prompt: 'Lab Terminal // CORE ACCESS',
      unlockFlag: 'flag_lab_hack',
      transcript: '> Final facility before SHIVA core integration.\n> All enemy types present: drones, heavy units, phasing ghosts,\n> spitters (toxin-corroded vents), and brutes (ceramic armor plating).\n> Core chamber requires all keys collected.' },

    { id: 'terminal_brute_control', kind: 'terminal', x: 3, y: 17, hack: true,
      prompt: 'Brute Control Console',
      unlockFlag: 'flag_brute_stunned',
      transcript: "> Brute unit designated 'Atlas' has been in stasis since Phase 3.\n> Containment breach at 04:17. Heavy-caliber weapons effective\n> but slow to reload. Consider EMP trap in corridor B." },

    { id: 'terminal_spitter_vent', kind: 'terminal', x: 36, y: 8, hack: false,
      prompt: 'Vent Control // PHOTOSYNTHESIS NODE',
      transcript: '> Organic growth has colonized the eastern vents.\n> Spitters nest in the root-tubes. Toxin sacs are under pressure.\n> Recommend sealed-route traversal only.' },

    { id: 'log_lab_1', kind: 'audio_log', x: 40, y: 2,
      prompt: 'Audio Log // DR. ELENA VASQUEZ',
      audioKey: 'log_vasquez',
      transcript: 'SHIVA was supposed to be benign. A neural mapping tool.\nBut the mycelium interface... it grew beyond containment. The brutes\nwere military drones that failed. Now they are guardians of the core.' },

    { id: 'log_lab_2', kind: 'audio_log', x: 42, y: 5,
      prompt: 'Audio Log // CYSB TRANSFER',
      audioKey: 'log_cysb',
      transcript: 'Subject transfers to SHIVA matrix. Neural pattern matching\nat 98.7%. Warning: subject reports dreams of the Garden. Recommend\npsych screening before deployment.' },

    { id: 'keycard_lab', kind: 'keycard', x: 19, y: 12,
      prompt: 'Laboratory keycard — core access protocol' },

    { id: 'medkit_lab_1', kind: 'medkit', x: 4, y: 17,
      prompt: 'Surgical Medkit' },

    { id: 'medkit_lab_2', kind: 'medkit', x: 42, y: 17,
      prompt: 'Field Medkit' },

    { id: 'ammo_lab', kind: 'ammo', x: 37, y: 4,
      prompt: 'Pulse Rifle energy packs' },

    { id: 'credits_1', kind: 'credits', x: 38, y: 17 },
    { id: 'credits_2', kind: 'credits', x: 5, y: 7 },
  ],
  triggers: [
    { x: 15, y: 10, type: 'set_flag', data: { key: 'flag_brute_stunned' } },
    { x: 20, y: 18, type: 'spawn_ghost', data: { kind: 'drone' } },
    { x: 41, y: 25, type: 'set_flag', data: { key: 'flag_exit_level', next: 'core_chamber' } },
  ],
  zones: [
    { x: 0, y: 0, w: 8, h: 6, name: 'Entry Corridor' },
    { x: 8, y: 0, w: 12, h: 6, name: 'Testing Labs' },
    { x: 20, y: 0, w: 12, h: 7, name: 'Bio-Chamber' },
    { x: 32, y: 0, w: 13, h: 6, name: 'Screen Tower' },
    { x: 0, y: 7, w: 8, h: 7, name: 'Lower Facility' },
    { x: 8, y: 7, w: 14, h: 7, name: 'Central Complex' },
    { x: 22, y: 7, w: 23, h: 7, name: 'Spitter Vents' },
    { x: 0, y: 15, w: 14, h: 8, name: 'Brute Containment' },
    { x: 14, y: 15, w: 16, h: 9, name: 'Core Access' },
    { x: 30, y: 15, w: 15, h: 9, name: 'Spitter Nest' },
    { x: 0, y: 24, w: 45, h: 5, name: 'Core Approach' },
  ],
};

export default level4;
export const LEVEL_4 = level4;
