# Human playtest protocol

Use the Windows/Linux test build or import `godot/project.godot` in Godot 4.7.2 Standard. Start without reading the map data or asking the developer for the route.

1. New Game. Record whether movement, shooting, reload and interaction become clear within the first room.
2. Find the shotgun cache, relay, card and exit. Record any unexplained blocked access, wrong prompt or excessive backtracking.
3. Garden: find the pulse cache, close the root valve, explore the alternate passage and read the recovered log.
4. Spire: find the launcher, clear Atlas containment and route the lift. Check enemies around corners and doors.
5. Lab: compare neural hacking with the card-operated auxiliary bridge. Spend credits at supplies; check full health does not consume credits.
6. SHIVA Core: note whether volley/shockwave warnings are readable and give enough time. Complete → credits → menu.
7. Save manually; fulfill an objective that autosaves; Quick Load should return to the manual point. Test Continue and LOAD / RECOVER separately.
8. Start a new campaign: confirm the warning, check manual save and previous campaign remain recoverable.
9. Remap interaction; all interaction prompts must show the new key. Disable subtitles; operational notifications must remain visible.
10. Try maximum text scale, different resolution, inventory/logs, options/controls, pause save feedback and guided hacking. Check mouse capture/resume.
11. Enemy Lab: inspect front heavy art study under lighting, feet baseline and silhouette; compare campaign materials and shotgun states.

Record: OS, CPU/GPU/RAM, build commit, quality/resolution, campaign completion, navigation blockers, deaths, ammo shortages, weapon preference, motion discomfort, audio localization and worst frame-time moments.

Recorder logs are local `user://playtest_*.json`. Run:

```sh
python3 godot/tools/playtest_report.py /path/to/playtest_*.json --output playtest-summary.json
```

Graphical frame mean/p95 in the summary is for the sampled recent window, including scene work; it is not a hardware-independent FPS certification. Headless logs explicitly report frame timing unavailable.

Decision: fix blockers first, then tune combat/resources based on observed play. Do not declare release ready from bot success alone.
