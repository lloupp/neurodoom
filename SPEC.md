# NEURODOOM — Specification

> **Cyberpunk immersive-sim FPS — Doom's brutality meets System Shock's depth, in the browser.**

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
| Persistence | IndexedDB (idb-keyval) | Saves, audio cache, progress flags |
| Levels | `MAP.json` registry | Designers ship maps without recompiling |
| Assets | Procedural textures (canvas noise) | No external downloads; deterministic |

## 4. Systems

### 4.1 Raycaster
- DDA per-column, texture-mapped, z-buffer for sprites
- Distance fog (column darkening) for atmosphere
- Wall sliding on collision (no full stop — Doom-style)

### 4.2 Player Controller
- WASD + mouse look (pointer lock)
- AABB collision against tile grid
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
- Each terminal holds an array of `LogEntry { id, src, audioUrl, transcript, heard }`
- Audio plays once player approaches; transcript becomes readable
- Lexer parses `unlock:Door.A`, `spawn:Ghost.2`, `flag:story.shiva` from transcript tags

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

## 5. File Layout

```
neurodoom/
├─ SPEC.md
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ index.html              # Mount root
├─ public/                 # Static (audio samples synthesized)
├─ src/
│  ├─ main.ts              # Boot
│  ├─ style.css            # Globals (CSS vars, scanlines, layout)
│  ├─ engine/
│  │  ├─ index.ts          # Public engine surface
│  │  ├─ GameShell.ts      # RAF loop + fixed-timestep accumulator
│  │  ├─ ECS.ts            # Entity/Component/System primitives
│  │  ├─ EventBus.ts       # Typed pub/sub
│  │  ├─ State.ts          # Global game state container
│  │  ├─ Input.ts          # Mouse + keyboard, pointer-lock
│  │  ├─ Audio.ts          # AudioBus with PannerNode
│  │  ├─ Persistence.ts    # IndexedDB wrapper
│  │  ├─ Assets.ts         # Texture/sound loaders (procedural + cache)
│  │  └─ Procedural.ts     # Canvas noise textures, palette gen
│  ├─ game/
│  │  ├─ index.ts          # Bootstrap game state
│  │  ├─ Level.ts          # Loader for MAP.json, spawns, triggers
│  │  ├─ Player.ts         # Player entity + controller
│  │  ├─ MapRenderer.ts    # DDA raycaster + z-buffer
│  │  ├─ SpriteRenderer.ts # Sprites + weapons canvas
│  │  ├─ Enemy.ts          # Enemy entity + BehaviorTree
│  │  ├─ Inventory.ts      # Inventory system + UI bridge
│  │  ├─ Terminal.ts       # Terminal interactable + log playback
│  │  ├─ Hacking.ts        # TIS-100-style minigame
│  │  ├─ HUD.ts            # Wires DOM HUD to game state
│  │  ├─ Audio.ts          # Game audio: alarms, footsteps, music
│  │  └─ levels/
│  │     ├─ registry.ts
│  │     ├─ Level1.json    # Vertical slice: 8 rooms, est. 10 min
│  │     └─ Level2.json    # (after polish)
│  ├─ hud/                 # DOM markup (HUD.html imported via Vite ?raw)
│  │  └─ index.html
│  └─ assets/
│     ├─ logs/             # Audio log manifests
│     └─ palette.json      # Color tokens for procedural gen
└─ tests/
   ├─ engine.fixedStep.spec.ts
   ├─ map.dda.spec.ts
   └─ hacking.solver.spec.ts
```

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
