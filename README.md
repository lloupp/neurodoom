# NEURODOOM

> **Cyberpunk immersive-sim FPS — visceral combat meets deep systemic simulation, in the browser.**

You wake up inside a black-site neural implant facility. Every terminal you jack into, every log you recover, walks you closer to a name: **SHIVA**, the corporate god rewriting dreams from inside a server farm.

[![License: Proprietary](https://img.shields.io/badge/license-proprietary-4be3ff.svg)](./LICENSE)
[![Stack: TS strict](https://img.shields.io/badge/typescript-strict-4be3ff.svg)](https://www.typescriptlang.org)
[![Render: Canvas 2D DDA](https://img.shields.io/badge/render-canvas2d-ff3aa1.svg)](#)
[![Audio: Web Audio HRTF](https://img.shields.io/badge/audio-HRTF-aaff39.svg)](#)
[![CI](https://github.com/lloupp/neurodoom/actions/workflows/ci.yml/badge.svg)](./.github/workflows/ci.yml)

## Architecture

```
GameShell (RAF loop, fixed-timestep simulation)
├─ engine/      GameShell • ECS • EventBus • Input • AudioBus • Persistence • Procedural • Assets • LevelLoader • Settings • ErrorLog
├─ game/        Player • MapRenderer (DDA) • SpriteRenderer • Enemy BT • Inventory • Terminal • Hacking • HUD • Audio
├─ game/levels  TypeScript MapManifest modules (one per level, registered in levels/registry.ts)
├─ (hud markup) built and injected by main.ts (CSS grid overlay, neon theming)
└─ tests/       vitest specs (hacking, level loader, math, scenario, sprite projection)
```

## Quickstart

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build on every push/PR.

Click anywhere — pointer-lock engages. WASD + mouse look. `E` to interact with terminals and doors. `1/2/3/4` to swap weapons. `I` opens inventory. `Esc` pauses and opens Options (audio/sensitivity/key rebinding/difficulty/accessibility/save export-import).

## Settings & Accessibility

Persisted separately from save slots (`localStorage`, applies across all runs):

- **Audio**: master/SFX/voice/ambient/music volume sliders.
- **Controls**: mouse sensitivity, full key rebinding (forward/back/strafe/jump/crouch/interact/inventory).
- **Gameplay**: difficulty (easy/normal/hard — scales incoming damage only).
- **Accessibility**: "reduce camera motion" dampens headbob for motion-sensitive players. Audio logs and terminal transmissions always show a full text transcript in sync with playback (not audio-only). Items, HP/stamina, and ammo are labeled with text, not color alone.
- **Save**: export/import your save slot as a JSON file.

Runtime errors are captured to `localStorage` (`neurodoom:errorlog`, last 50 entries) via `window.onerror`/`unhandledrejection` listeners installed at boot, for post-crash diagnostics.

## Level Design

Levels are JSON. Each `MapManifest` declares:

- A tile grid (string array, single chars per tile)
- Player spawn
- Enemy patrols + sight ranges (`drone`/`heavy`/`ghost`/`turret`, plus a one-off `boss` per level)
- Interactables (doors, terminals, audio logs, keycards, medkits, ammo)
- Persistent `flag:` triggers unlocking doors / spawning ghosts

See `src/game/levels/Level1.ts` for the reference (Sublevel 3, Meridian Blacksite). Its climactic encounter — SHIVA's warden, gated behind the secure-lab hacking puzzle — is the current build's win condition: killing it ends the run with an ending screen.

## Pillars

1. **Atmosphere over spectacle** — lighting is the level designer.
2. **HUD as character** — DOM overlay is the player-view of their own body.
3. **World as conversation** — every terminal is a way of *listening* to the level.
4. **Modular dungeons** — every level = a JSON, every system = a folder.

See `SPEC.md` for the full design doc.

## Out of Scope (MVP)

Multiplayer, mobile/touch, WebGL, online leaderboards. v0.2 territory.

## License

All rights reserved — see [LICENSE](./LICENSE). This codebase is not open source;
contact the copyright holder for licensing terms. (This file is a placeholder
license text, not legal advice — have it reviewed by a lawyer before shipping
commercially.)
