import type { MapManifest } from '../MapSchema';

const level2: MapManifest = {
  id: 'sector_9',
  name: 'Sector 9 — Garden',
  author: 'neurodoom-system',
  cellSize: 1,
  spawn: { x: 2.5, y: 2.5, face: 0 },
  // 40x25 — 12+ rooms: Entry Foyer, Overgrown Hub, Greenhouse A/B,
  //   Server Vault, Root Chamber, Bio-Lab, Maintenance Corridor,
  //   Cold Storage East, Hive Chamber, Archives, Restricted Wing
  // tile legend: '#'=solid '.'=empty 'D'=door 'M'=metal 'P'=panel 'X'=circuit
  //              'S'=screen 'O'=organic 'C'=concrete
  tiles: [
    '########################################',
    '#......D.......#...........D.........O##',
    '#......D.......#...........D.........O##',
    '#.....###.....##.#########.###.......O##',
    '#.....O.O.....##.#....O#..OO#........###',
    '#.....O.O.....##.#....O#..OO#........###',
    '#.....O.O.....OO.#....D#...O#........###',
    '#.....O.O.....OO.#....O#...O#........###',
    '#.....O.O......O.......#...O#........###',
    '#.....O.O......O.......#....##.......###',
    '#.....O.O......#..C####.......##....####',
    '#.....O.O......#..C#..#........##...####',
    '#.....O.O......#..C#..D.........##..####',
    '#.....O.O......#..C#..#..........#..####',
    '#.....O.O......M..#...#..........#..####',
    '#.....O.O......#..#...#..........#..####',
    '#.....O.O......#..#...#..........#..####',
    '#.....O.O......#..#...####D####..#..####',
    '#.....O.O......#..#..........O#...#..###',
    '#.....O.O......#..#..........O#...#..###',
    '#.....O.O......#..#..........O#...#..###',
    '#.....O.O......#..#############D####.###',
    '#.....O.O......D.................O#..###',
    '#.....O.O...............M........O#..###',
    '########################################',
  ],
  enemies: [
    {
      kind: 'drone',
      x: 18,
      y: 5,
      patrol: [
        [17, 5],
        [23, 5],
        [23, 8],
        [17, 8],
      ],
      sight: 9,
    },
    {
      kind: 'drone',
      x: 10,
      y: 12,
      patrol: [
        [9, 11],
        [13, 11],
        [13, 15],
        [9, 15],
      ],
      sight: 8,
    },
    {
      kind: 'heavy',
      x: 17,
      y: 17,
      patrol: [
        [16, 16],
        [20, 16],
        [20, 20],
        [16, 20],
      ],
      sight: 7,
    },
    {
      kind: 'drone',
      x: 32,
      y: 4,
      patrol: [
        [31, 3],
        [35, 3],
        [35, 8],
        [31, 8],
      ],
      sight: 9,
    },
  ],
  interactables: [
    // ── Doors ──
    { id: 'door_entry_hub', kind: 'door', x: 7, y: 1, locked: false },
    { id: 'door_hub_greenhouse', kind: 'door', x: 16, y: 4, locked: false },
    { id: 'door_greenhouse_a', kind: 'door', x: 23, y: 4, locked: false },
    { id: 'door_greenhouse_bio', kind: 'door', x: 12, y: 12, locked: true, unlockFlag: 'flag_garden_terminal' },
    { id: 'door_hub_vault', kind: 'door', x: 14, y: 7, locked: false },
    { id: 'door_vault_cold', kind: 'door', x: 26, y: 15, locked: true, unlockFlag: 'flag_vault_key' },
    { id: 'door_maintenance_hive', kind: 'door', x: 28, y: 20, locked: true, unlockFlag: 'flag_hive_clear' },
    { id: 'door_hive_archives', kind: 'door', x: 35, y: 21, locked: false },

    // ── Terminals ──
    { id: 'terminal_entry_log', kind: 'terminal', x: 4, y: 6, hack: false,
      prompt: 'Entry Terminal // SECTOR 9 PERIMETER',
      transcript: '> Sector 9 — codename GARDEN. Hydroponics x cybernetics.\n> After the SHIVA leak, root-network overgrew containment.\n> Bio-adjunct husks patrol the greenways. They hear better than they see.' },

    { id: 'terminal_greenhouse_scan', kind: 'terminal', x: 20, y: 5, hack: false,
      prompt: 'Greenhouse Console // PHYTO-STATION 7',
      transcript: '> Phytoremediation at 340% capacity. Algal bloom in server coolant.\n> Root mat thickness: 2.1m. Do NOT walk barefoot in Bay C.\n> The walls breathe. That is not metaphor.' },

    { id: 'terminal_vault_access', kind: 'terminal', x: 10, y: 14, hack: true,
      prompt: 'Bio-Lab Terminal // ROOT ACCESS REQUIRED',
      unlockFlag: 'flag_garden_terminal',
      transcript: '> Specimen 9-THETA embedded in substrate. Heartbeat detected at 0.7 Hz.\n> Neural traces match SHIVA carrier wave. Wake protocol: /rootrise/\n> The Garden does not let you leave. It grows through you.' },

    { id: 'terminal_cold_storage', kind: 'terminal', x: 34, y: 2, hack: false,
      prompt: 'Cold Storage // CRYO-LOG 09',
      transcript: '> Cryogenic failure — batch 7 thawed 72h ago.\n> Occupants: 14 SHIVA integral subjects. Status: MOBILE.\n> If you hear rustling in the vents, it is not mechanical.' },

    { id: 'terminal_hive_control', kind: 'terminal', x: 36, y: 10, hack: true,
      prompt: 'Hive Core Terminal // OVERRIDE',
      unlockFlag: 'flag_hive_clear',
      transcript: '> Bio-adjunct network collapsed at 04:17. Hive mind fragmenting.\n> Kill the three husk-nodes and the door to Archives opens.\n> Final truth: SHIVA is not a program. It is the mycelium itself.' },

    // ── Audio Logs ──
    { id: 'log_garden_1', kind: 'audio_log', x: 4, y: 2,
      prompt: 'Audio Log // DR. VALE — Day 41',
      audioKey: 'log_dr_vale_41',
      transcript: 'The root tips trace the fiber channels. Where data flows, the mycelium follows. I told them not to mix organic and digital. They called it convergence. I call it a grave.' },

    { id: 'log_garden_2', kind: 'audio_log', x: 20, y: 1,
      prompt: 'Audio Log // MAINTENANCE CHIEF KOVA',
      audioKey: 'log_kova',
      transcript: 'Power drain in sector 9 is triple nominal. The growth is drawing current directly from the bus. I shut off corridor lights to compensate. Now the husks navigate by sound alone.' },

    { id: 'log_garden_3', kind: 'audio_log', x: 34, y: 5,
      prompt: 'Audio Log // SUBJECT 14 — Fragment B',
      audioKey: 'log_subject14_b',
      transcript: 'I found the greenhouse. The walls are wet. The terminals drip. Someone carved "ROOTRISE" into the console glass. I think it was me.' },

    { id: 'log_garden_4', kind: 'audio_log', x: 17, y: 22,
      prompt: 'Audio Log // UNKNOWN — garbled',
      audioKey: 'log_garden_unknown',
      transcript: '[static] ...the Garden remembers everything that dies in its soil. The servers are compost now. Data becomes mulch. We become... [end]' },

    // ── Pickup items ──
    { id: 'keycard_garden', kind: 'keycard', x: 9, y: 2,
      prompt: 'Garden keycard — bio-wing override' },

    { id: 'medkit_garden', kind: 'medkit', x: 35, y: 8,
      prompt: 'Field Medkit' },
    { id: 'medkit_garden_2', kind: 'medkit', x: 4, y: 20,
      prompt: 'Field Medkit' },

    { id: 'ammo_garden', kind: 'ammo', x: 30, y: 12,
      prompt: 'Shotgun shells' },
    { id: 'ammo_garden_2', kind: 'ammo', x: 15, y: 22,
      prompt: 'Pulse Rifle charge pack' },
  ],
  triggers: [
    { x: 12, y: 13, type: 'set_flag', data: { key: 'flag_garden_terminal' } },
    { x: 26, y: 16, type: 'set_flag', data: { key: 'flag_vault_key' } },
    { x: 36, y: 11, type: 'set_flag', data: { key: 'flag_hive_clear' } },
    { x: 20, y: 17, type: 'spawn_ghost', data: { kind: 'heavy' } },
    { x: 10, y: 18, type: 'spawn_ghost', data: { kind: 'drone' } },
  ],
};

export default level2;
export const LEVEL_2 = level2;
