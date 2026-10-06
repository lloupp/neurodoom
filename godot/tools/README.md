# NEURODOOM production tools

- **Sector editor dock:** choose a sector, paint cell symbols, Ctrl+Z undo, validate/save native resource overrides under `data/maps/`. Unsaved switching is blocked; explicit discard reloads the saved map. Existing resources receive `.bak` backups. Validator checks row widths, boundaries, symbols, required actors, reachability and card/relay gate deadlocks. Runtime and simulation use these resources; absent overrides fall back to authored campaign data.
- **Enemy Lab:** F2 opens controls; choose enemy, tune parameters, select state and reset. ART STUDY shows the front heavy specimen from `art/samples/` for review; it does not replace directional campaign animation.
- **Weapon Lab:** choose weapon, tune damage/interval/recoil/spread/pellets/reload and refill ammo.
- **Material/Lighting Lab:** inspect materials under fog/light toggles. Authored metal/concrete/neural materials are editable SVGs consumed by LevelBlock and campaign sectors.
- **LevelBlock / EncounterTrigger / StoryTerminal:** reusable inspector-driven components.
- **Asset Validator / Sprite Forge:** editor menu diagnostics for the source/frame and runtime atlas contracts; no automatic AI-generated art is marked final.
- **Playtest Recorder:** local, bounded event chunks with position samples and graphical frame timing. `playtest_report.py` groups chunks by session and summarizes objectives and frequently visited cells. Headless never claims FPS.
- **Build/check runner:** `python3 godot/tools/run_checks.py --godot /path/to/godot`. `--export` requires matching templates and produces Windows/Linux debug test builds.
- **Visual capture:** set `NEURO_CAPTURE_DIR`, run `tests/visual_smoke.tscn` on a display. CI uploads software-rendered screenshots separately from desktop builds.

See `../docs/HUMAN_PLAYTEST.md` for the production acceptance session. Editor UI, audio and hardware performance still need direct human review.
