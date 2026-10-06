# NEURODOOM — Godot Production Track

The original TypeScript/browser game remains intact and is treated as an executable design reference.

The production game now lives in `godot/`.

## Recommended editor

Use **Godot 4.7.2 Standard** for the current production branch.

## Goal

Build NEURODOOM as a real first-person cyberpunk survival-horror FPS with first-person movement and combat, stylized 2.5D billboard enemies, authored art, 3D lighting/fog, data-driven content, editor tooling, desktop-first builds, and a reusable production pipeline.

GitHub Pages is no longer a production requirement.

## First milestone

The Godot track starts with a playable vertical slice:

PLAYER -> COMBAT -> TERMINAL -> RESTORE POWER -> OPEN SECURITY DOOR -> REACH SHIVA CORE -> COMPLETE SLICE

## Open it

1. Install Godot 4.7.2 Standard.
2. Open Godot Project Manager.
3. Import `godot/project.godot`.
4. Open the project.
5. Press F5.

Controls:

- WASD: move
- Mouse: look
- Left mouse: fire
- E: interact
- Shift: sprint
- Esc: pause/resume (controls are InputMap actions on physical keys; AZERTY keeps WASD positions)
- 1–4: select weapon
- R: reload
- TAB: inventory (pauses; read recovered logs)
- F5: quick-save
- F9: quick-load

## Production tooling

The Godot editor plugin exposes the vertical slice, Enemy Lab, Weapon Lab, Material/Lighting Lab, asset validation and Sprite Forge under the Tools menu.

Additional reusable authoring pieces are under `godot/scenes/tools/` for level blocks, encounter triggers and story terminals.

Playtests automatically write structured JSON events to `user://playtest_*.json` when the slice is completed.

See `godot/art/STYLE_GUIDE.md`.

## Migration rule

Nothing under `src/` is removed or replaced. The browser version remains available as a mechanics reference while the Godot production track grows.

## Campaign candidate update

The main scene now opens a New Game / Continue / Options / Quit menu. New Game runs five connected sectors and a Warden confrontation ending in credits and menu return. The original slice remains `godot/scenes/main.tscn`, independently smoke-tested. See `godot/docs/PRODUCTION_AUDIT.md` for implemented systems, known production gaps, save migration, debug traversal boundaries and mandatory human playtest. Keep PR #10 draft; no release claim or merge.
