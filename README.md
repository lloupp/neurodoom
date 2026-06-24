# NEURODOOM

> **Cyberpunk immersive-sim FPS — Doom's brutality meets System Shock's depth, in the browser.**

You wake up inside a black-site neural implant facility. Every terminal you jack into, every log you recover, walks you closer to a name: **SHIVA**, the corporate god rewriting dreams from inside a server farm.

[![License: MIT](https://img.shields.io/badge/license-MIT-4be3ff.svg)](./LICENSE)
[![Stack: TS strict](https://img.shields.io/badge/typescript-strict-4be3ff.svg)](https://www.typescriptlang.org)
[![Render: Canvas 2D DDA](https://img.shields.io/badge/render-canvas2d-ff3aa1.svg)](#)
[![Audio: Web Audio HRTF](https://img.shields.io/badge/audio-HRTF-aaff39.svg)](#)

## Architecture

```
GameShell (RAF loop, fixed-timestep simulation)
├─ engine/      GameShell • ECS • EventBus • Input • AudioBus • Persistence • Procedural • Assets • LevelLoader
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
npm run typecheck
npm run build
```

Click anywhere — pointer-lock engages. WASD + mouse look. `E` to interact with terminals and doors. `1/2/3` to swap weapons. `I` opens inventory. `Esc` pauses.

## Level Design

Levels are JSON. Each `MapManifest` declares:

- A tile grid (string array, single chars per tile)
- Player spawn
- Enemy patrols + sight ranges
- Interactables (doors, terminals, audio logs, keycards, medkits, ammo)
- Persistent `flag:` triggers unlocking doors / spawning ghosts

See `src/game/levels/Level1.ts` for the reference (Sublevel 3, Meridian Blacksite).

## Pillars

1. **Atmosphere over spectacle** — lighting is the level designer.
2. **HUD as character** — DOM overlay is the player-view of their own body.
3. **World as conversation** — every terminal is a way of *listening* to the level.
4. **Modular dungeons** — every level = a JSON, every system = a folder.

See `SPEC.md` for the full design doc.

## Out of Scope (MVP)

Multiplayer, mobile/touch, WebGL, online leaderboards. v0.2 territory.

## License

MIT — see [LICENSE](./LICENSE).
