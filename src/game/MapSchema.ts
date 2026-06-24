// MAP.json schema — strongly typed for editor/runtime consistency.

export interface MapTrigger {
  /** Tile coords */
  x: number;
  y: number;
  /** Picked up by trigger system and routed to a handler */
  type: 'unlock' | 'lock' | 'spawn_ghost' | 'set_flag' | 'play_log' | 'teleport';
  /** Free-form payload */
  data?: Record<string, unknown>;
}

export interface MapInteractable {
  id: string;
  kind: 'door' | 'terminal' | 'panel' | 'keycard' | 'medkit' | 'ammo' | 'audio_log' | 'credits';
  x: number; y: number;        // tile coords
  /** Door/terminal direction (0=east, 90=north, 180=west, 270=south) */
  face?: number;
  /** True by default; set false to require unlock */
  locked?: boolean;
  /** terminates unlock flow */
  unlockFlag?: string;
  /** for terminal: hacking minigame required */
  hack?: boolean;
  /** for audio log: drop-in script for terminal screen */
  prompt?: string;
  /** for audio log: audio key in audio logs index */
  audioKey?: string;
  /** for audio log: text shown if audio not played */
  transcript?: string;
}

export interface MapEnemySpawn {
  kind: 'drone' | 'heavy';
  x: number; y: number;
  /** Path as a series of tile coords to walk in order */
  patrol: Array<[number, number]>;
  /** Vision range in tiles */
  sight?: number;
}

export interface MapManifest {
  id: string;
  name: string;
  author?: string;
  /** Tile grid using single-char tile codes.
    *  # = solid metal
    *  . = empty
    *  P = solid panel
    *  X = circuit (electric hazard)
    *  S = screen (emissive)
    *  M = metal solid
    *  C = concrete solid
    *  O = organic (biological hazard)
    *  D = door tile (rendered as wall + interactable)
    *  g = metal grating floor (walkable; SPEC 4.2 footstep palette)
    *  w = organic floor (walkable; SPEC 4.2 footstep palette)
    */
  tiles: string[];
  /** Tile side length in world units (1 world unit = 1 tile) */
  cellSize: number;
  /** Texture styles per tile char (overriding the default skin) */
  tileTexture?: Record<string, string>;
  /** Player spawn */
  spawn: { x: number; y: number; face: number };
  /** Encounters */
  enemies: MapEnemySpawn[];
  /** Interactions */
  interactables: MapInteractable[];
  /** Persistent narrative triggers (e.g., unlock next level on flag) */
  triggers: MapTrigger[];
}
