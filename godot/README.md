# NEURODOOM / Godot production

Godot 4.7.2 **Standard**. Import `project.godot`, press F5, choose **NEW GAME**.

A short authored campaign candidate: Meridian Blacksite → Garden → Spire → Underground Lab → SHIVA Core. Each sector has an entry, resource route, enemies, narrative and exit. Restore sector power at the relay, find its card and unlock access. Spire additionally requires brute containment clearance. Defeat the Warden then interact with the exit to end the campaign and return to the menu.

This candidate still needs human combat/layout/visual/audio validation. See [audit](docs/PRODUCTION_AUDIT.md) for production gaps and the baseline art limitations. Original TypeScript game remains untouched.

## Controls

- WASD: move; mouse: aim; Shift: sprint; LMB: shoot.
- 1–4: pistol, shotgun, pulse rifle, rocket launcher. R: reload.
- E: collect/use/read/exit; TAB: inventory summary.
- ESC: pause/resume. F5/F9: save/load during gameplay.
- Death: retry level-entry checkpoint or load saved run.

Continue validates schema v2. Explicit v1 migration supports original native slice saves. Invalid/future schemas are rejected visibly. Writes preserve a `.bak` before committing a temporary file. User files remain in Godot's native `user://` folder. No telemetry leaves the machine.

## Verification

Run `python3 godot/tools/run_checks.py --godot /path/to/godot` from the repository root. It isolates save/settings files and rejects diagnostic errors, warnings and resource leaks. Includes import, menu, original slice, three labs, campaign and production tests.

Structural traversal in production tests fulfills objectives directly; it is **not** normal gameplay evidence. A separate `tests/simulation_playthrough.tscn` exercises normal mechanics automatically, with no forced HP, teleport, kills or objective completion. A bot simulation still does not replace a human playthrough.

For graphical capture, set `NEURO_CAPTURE_DIR` to an output directory and run `tests/visual_smoke.tscn` with a real display. It exercises menu/options/gameplay and captures viewport PNGs. Audio playback is intentionally absent in headless tests.

## Tools

Editor Tools menu keeps the original Vertical Slice and the Enemy/Weapon/Material labs. Enemy/Weapon Labs: F2 releases the cursor to inspect and tune, F2 returns to combat. Enemy selection, tuning, animation and spawn/reset; weapon damage/interval/recoil/spread/pellets/reload and ammo refill. Material Lab: F toggles fog, L toggles key light. LevelBlock, EncounterTrigger and StoryTerminal remain reusable authoring components. Runtime atlas validation and Sprite Forge inspect naming, dimensions and missing frames; feet alignment still requires visual inspection.

## Desktop builds

Install matching Godot 4.7.2 export templates. Run `python3 godot/tools/run_checks.py --godot /path/to/godot --export` to create Windows/Linux debug test builds in ignored `godot/export/`. Godot Production CI also uploads desktop test builds as artifacts. No automatic release/deploy/merge.

Original synthesized WAVs are documented in `audio/README.md`; they are placeholders. Final voices, spatial mix, textures, decals and temporal sprite art remain production work.
