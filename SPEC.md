# NEURODOOM — Specification

> **Cyberpunk immersive-sim FPS — visceral combat meets deep systemic simulation, in the browser.**

## 1. Concept

You wake up inside a black-site neural implant facility. Your skull is wired to a network you don't recognize. Every terminal you jack into, every log you recover, walks you closer to a name: **SHIVA**, the corporate god that's been writing dreams into people's heads.

The mood: industrial, claustrophobic, neon-lit, dripping. Think *System Shock 2* + *Deus Ex* (2000) + *Cyberpunk 2077's* lowlife districts. Not pretty. Operative.

## 2. Pillars

1. **Atmosphere over spectacle.** Silence is weaponized; vents breathe; lights flicker on a timer. Lighting is the level designer.
2. **HUD as character.** Information density first, ornamentation second. The HUD is what the player IS, not what the player sees.
3. **World as conversation.** Doors, terminals, panels, signs — all "talk". Hacking, logging, inventory — all are ways of listening back.
4. **Modular dungeons.** Every level = a JSON; every system = a folder. Designers iterate, coders don't block.

## 3. Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + TS strict | Fast HMR, tree-shake, ESM native |
| Renderer | Canvas 2D (DDA column raycaster) | Spec'd by user; faithful to 90s immersive sim aesthetic |
| Sprites/Weapons | Separate canvas | Pixel-perfect overlay, high FPS |
| HUD | HTML + CSS Grid + CSS vars | Theming via `--neon` / `--shadow` etc; no React |
| State | Mini-ECS (custom) | Full control, ~200 LOC, no dep |
| Audio | Web Audio API + `PannerNode` (HRTF) | True 3D positional, scripted "phones" feel |
| Persistence | IndexedDB (raw, zero-dep) | Saves, audio cache, progress flags |
| Levels | `.ts` `MapManifest` registry | One typed, tree-shaken manifest per level |
| Assets | Procedural textures (canvas noise) | No external downloads; deterministic |

## 4. Systems

### 4.1 Raycaster
- DDA per-column, texture-mapped, z-buffer for sprites
- Distance fog (column darkening) for atmosphere
- Wall sliding on collision (no full stop — Doom-style)

### 4.2 Player Controller
- WASD + mouse look (pointer lock)
- Circle-radius collision against the tile grid (wall-sliding, no full stop)
- Stamina system: sprint → drains, idle → recovers
- Headbob timed with footsteps; step audio palette by surface

### 4.3 Combat
- Hitscan weapons first (pistol, shotgun, pulse-rifle)
- Damage = base × crit × distance-falloff × armor
- Enemy hit-react + telegraphed attacks
- Death state → reload from autosave

### 4.4 Enemies (BehaviorTree, not Utility AI)
States: `IDLE → PATROL → ALERT → CHASE → ATTACK → RETREAT → DEAD`
- Sound cones (sense footsteps, gunshots)
- Vision cones (line-of-sight, light-modulated)
- Patrol paths hardcoded in MAP.json
- Drop loot on death (credits, ammo, keycards)
- Kinds: `drone`, `heavy`, `ghost`, `turret`, and a one-per-level `boss` (higher HP/armor/damage, larger sprite scale). A level's `boss` dying is the run's win condition — see 4.11.
- Difficulty (`easy`/`normal`/`hard`, picked in Settings) scales only enemy→player damage via `EnemySystem.setDamageMultiplier`.

### 4.5 Inventory
- Slot grid (12 hot + 4 weapon)
- Items typed: weapon / consumable / key / data
- Pickup via proximity (use key)
- Drag-drop via mouse; quick-swap via number keys

### 4.6 Hacking Minigame (TIS-100-style procedural)
- Three randomized lines of code-shaped tokens
- Player patches a missing segment
- Three difficulties, three seconds-per-token tolerance
- Failure → trace alarm + enemy spawn in adjacent rooms

### 4.7 Terminals & Logs
- Each terminal holds an array of `TerminalLogEntry { id, title, transcript, source?, audioKey, played? }`
- Audio (a positional voice-bus transmission) plays once the player opens the log; transcript becomes readable
- Lexer parses `unlock:Door.A`, `lock:Door.B`, `spawn:Ghost.2`, `flag:story.shiva` from transcript tags

### 4.8 AudioBus
- `AudioContext` master + per-source `PannerNode` (HRTF)
- Categories: `sfx`, `voice`, `ambient`, `music`
- Adaptive layers: tension escalates by `world.threat`
- Pause on tab hidden

### 4.9 Persistence
- Save slots: `neurodoom:save:N`
- Atomic writes (write-then-replace)
- Versions: `schema_version` field on root
- Autosave: every 30s + on level transition

### 4.10 Level Registry
- `src/game/levels/registry.ts` lists `MAP.json` imports
- Levels gated by `flag:` items; saves carry flag set forward

### 4.11 Settings, Accessibility & Crash Logging
- `engine/Settings.ts`: persisted to `localStorage` (`neurodoom:settings`), separate from save slots — audio volumes (master/sfx/voice/ambient/music), mouse sensitivity, difficulty, reduce-motion flag
- `engine/Input.ts`: full key rebinding (`RemappableAction` → key, persisted via `neurodoom:keybindings`)
- Accessibility: reduce-motion dampens headbob; terminal/log audio always paired with a synced on-screen transcript (never audio-only); HUD bars/ammo/items labeled with text, not color alone
- Save export/import: a save slot can be exported/imported as a JSON file from the Options panel
- `engine/ErrorLog.ts`: `window.onerror` / `unhandledrejection` captured to `localStorage` (`neurodoom:errorlog`, last 50 entries) for post-crash diagnostics
- Win condition: a level's `boss` enemy reaching `DEAD` state ends the run with an ending screen (see 4.4)

## 5. File Layout

```
neurodoom/
├─ SPEC.md
├─ README.md
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ vitest.config.ts
├─ index.html              # Mount root (#root); HUD markup is built in main.ts
├─ src/
│  ├─ main.ts              # Boot + DOM/HUD markup injection
│  ├─ style.css            # Globals (CSS vars, scanlines, layout)
│  ├─ engine/
│  │  ├─ index.ts          # Public engine surface
│  │  ├─ types.ts          # Shared math/vector + helpers
│  │  ├─ GameShell.ts      # RAF loop + fixed-timestep accumulator
│  │  ├─ ECS.ts            # Entity/Component/System primitives
│  │  ├─ EventBus.ts       # Typed pub/sub
│  │  ├─ State.ts          # Global game state container
│  │  ├─ Input.ts          # Mouse + keyboard, pointer-lock
│  │  ├─ Audio.ts          # AudioBus with PannerNode (HRTF)
│  │  ├─ Persistence.ts    # IndexedDB wrapper (raw, zero-dep)
│  │  ├─ Assets.ts         # Texture/sound loaders (procedural + cache)
│  │  ├─ Procedural.ts     # Canvas noise textures + audio synths
│  │  ├─ Settings.ts       # Options menu state (audio/sensitivity/difficulty), localStorage-persisted
│  │  ├─ ErrorLog.ts       # window.onerror/unhandledrejection capture, localStorage-persisted
│  │  └─ LevelLoader.ts    # Builds runtime LevelData from a MapManifest
│  └─ game/
│     ├─ index.ts          # Game orchestrator (loop wiring, systems)
│     ├─ MapSchema.ts      # MapManifest types (tiles, interactables, triggers)
│     ├─ Level.ts          # Tile-grid collision (collidesAt / tryMove)
│     ├─ Player.ts         # Player entity + controller
│     ├─ MapRenderer.ts    # DDA raycaster + z-buffer
│     ├─ SpriteRenderer.ts # Sprites + weapons canvas
│     ├─ Enemy.ts          # Enemy entity + BehaviorTree
│     ├─ Inventory.ts      # Inventory slot-grid render + UI bridge
│     ├─ Item.ts           # Item kinds + snapshots
│     ├─ Terminal.ts       # Terminal interactable + log lexer
│     ├─ Hacking.ts        # TIS-100-style minigame
│     ├─ HUD.ts            # Wires DOM HUD to game state
│     ├─ Audio.ts          # Game audio: alarms, footsteps, logs, music
│     └─ levels/
│        ├─ registry.ts    # Level records (id/name/manifest)
│        └─ Level1.ts      # Vertical slice manifest (Sublevel 3)
└─ tests/                  # vitest specs
   ├─ hacking.spec.ts
   ├─ level.spec.ts
   ├─ math.spec.ts
   ├─ scenario.spec.ts     # lexer, triggers, door gating, enemy BT, loot, inventory
   └─ sprite-projection.spec.ts
```

> Levels are TypeScript `MapManifest` modules (not loose `.json` files) so they
> tree-shake and type-check; designers still edit one self-contained file per
> level. Audio samples are synthesized at runtime (`Procedural.ts`), so there is
> no `public/` or `assets/` directory to ship.

## 6. Vertical Slice (Milestone 0→6)

Milestone defining goals; collapses to features at build time.

| # | Feature | Acceptance |
|---|---|---|
| 0 | Scaffold runs | `npm run dev` → empty room, no errors |
| 1 | Walking + looking + collision | Player can navigate a closed box; mouse turns |
| 2 | Door + terminal interact | E prompt → terminal log plays in proximity |
| 3 | One weapon + one enemy | Pistol kills patrolling guard |
| 4 | Inventory + hack minigame | Pick up keycard; hack terminal unlocks door |
| 5 | Save / load | Reload preserves progress |
| 6 | Polish pass | Scanlines, vignette, main menu, settings |

Level 1 ships all 7 milestones end-to-end so a fresh player can complete ~10 minutes of "feel" playthrough.

## 7. Out of Scope (MVP)

- Multiplayer
- Mobile / touch input
- WebGL / WebGPU
- Shader-based lighting
- Mod tooling beyond MAP.json
- Online leaderboards

These are *intentional*. The vertical slice proves the core; expansion comes in v0.2.

## 8. Open Questions (post-scaffold)

- Energy meter vs HP-only?
- Voice cast: synthesis or silence?
- Twitch chat integration (jacking view = chat overlay)?
