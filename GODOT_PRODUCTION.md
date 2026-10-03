# NEURODOOM — Godot Production Track

The original TypeScript/browser game remains intact and is treated as an executable design reference.

The production game now lives in `godot/` and targets Godot 4.

## Goal

Build NEURODOOM as a real first-person cyberpunk survival-horror FPS with first-person movement and combat, stylized 2.5D billboard enemies, authored art, 3D lighting/fog, data-driven content, editor tooling, desktop-first builds, and a reusable production pipeline.

GitHub Pages is no longer a production requirement.

## First milestone

The Godot track starts with a playable vertical slice:

PLAYER -> COMBAT -> TERMINAL -> RESTORE POWER -> OPEN SECURITY DOOR -> REACH SHIVA CORE -> COMPLETE SLICE

## Open it

1. Install Godot 4.x.
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

The Godot editor plugin adds commands for:

- running the vertical slice;
- validating the production asset structure;
- building a sprite manifest from directional animation frames.

See `godot/art/STYLE_GUIDE.md`.

## Migration rule

Nothing under `src/` is removed or replaced. The browser version remains available as a mechanics reference while the Godot production track grows.
