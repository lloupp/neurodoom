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
- Esc: release/capture mouse
- F5: quick-save
- F9: quick-load

## Production tooling

The Godot editor plugin exposes the vertical slice, Enemy Lab, Weapon Lab, Material/Lighting Lab, asset validation and Sprite Forge under the Tools menu.

Additional reusable authoring pieces are under `godot/scenes/tools/` for level blocks, encounter triggers and story terminals.

Playtests automatically write structured JSON events to `user://playtest_*.json` when the slice is completed.

See `godot/art/STYLE_GUIDE.md`.

## Migration rule

Nothing under `src/` is removed or replaced. The browser version remains available as a mechanics reference while the Godot production track grows.
