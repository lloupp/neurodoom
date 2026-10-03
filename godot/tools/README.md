# NEURODOOM Production Tools

## Implemented

### Sprite Forge
Editor menu command scans `art/source/` and emits `art/generated/sprite_manifest.json`.

### Asset Validator
Checks required production paths and reports source-art counts.

### Enemy Lab
Run `scenes/labs/enemy_lab.tscn` to test enemy pursuit, damage and billboard readability in a controlled arena.

### Weapon Lab
Run `scenes/labs/weapon_lab.tscn` to test shotgun feel and target response without loading a campaign level.

### Material / Lighting Lab
Run `scenes/labs/material_lab.tscn` to compare the base industrial material families under production lighting.

### Level Builder Kit
Instance `scenes/tools/level_block.tscn` and edit block size/material values in the inspector.

### Encounter Editor
Instance `scenes/tools/encounter_trigger.tscn`, configure spawn offsets in the inspector, and place it in a level.

### Terminal / Story Editor
Instance `scenes/tools/story_terminal.tscn` and author log text, objective transitions and power-restoration behavior directly in the inspector.

### Playtest Recorder
Runs automatically and writes JSON event logs to `user://playtest_*.json` when the vertical slice is completed.

### Build Manager
`tools/build_manager.gd` documents/prints the release CLI commands once export presets are configured.

## Next art-production step

Replace the placeholder SVG enemy and shotgun with authored PNG/WebP frames following `art/STYLE_GUIDE.md`.
