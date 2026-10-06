# Production audit — 2026-10-04 UTC

Reference: PR #10, branch `feat/godot-production-vertical-slice`, baseline `d2ae08088e213ad3d1e54f84000797c1ae36a7be`. No changes to `src/` or master. Read production docs, style/source contract, runtime manifest, all Godot scripts/scenes/tools, web Enemy/Player/Assets and Level1–4, campaign registry and orchestration (save/menu/hacking/projectile paths).

## Baseline gates and findings

- npm audit and runtime audit: zero vulnerabilities; lint/typecheck/build passed; 17 files / 288 unit tests passed.
- Initial web E2E could not start without Chromium. Installed matching headless shell from Chrome for Testing and reran successfully. Playwright CDN download returned a truncated zip; dependency failure was not a game failure.
- Godot 4.7.2 official Standard imported and ran all four scenes headless.
- P1: Sprite Forge did not compile (`suffix` inferred from untyped loop). Godot returned success despite an import diagnostic. Corrected explicit type and added a runner that rejects errors/warnings/leaks in logs as well as nonzero exit.
- P1: Enemies caused contact damage without occlusion. Added body collision, LOS before telegraph and resolution, swept projectile rays and blast occlusion.
- P1: Save retained no defeated enemies, pickups, inventory or campaign. Added validated schema v2, backups, temporary writes and scene reconstruction. Loading an earlier save rebuilds the world instead of only emitting forward door signals.
- P1: ESC released mouse while enemies kept attacking. Now scene-tree pause, death and menu input states stop simulation.
- P2: Every enemy was the same chasing heavy, every shot a single shotgun ray. Replaced with catalogs, differentiated states/attacks and four weapon functions.
- P2: HUD missed initial player signals; completion offered no menu return. HUD reads initial state and final screen has a working menu action.
- P1: Imported SVG symbols expanded to the whole sheet because `<use>` had no explicit cell dimensions. Fixed use dimensions, compatible references and per-cell clipping; inspected the real Godot-imported pixels. Added nonempty cell tests.
- P2: Sheets existed but only the top-left frame was used. Added cached directional/state region selection and explicit single-pose temporal handling.

## Web systems missing from baseline Godot

| Web reference system | Native outcome / remaining work |
| --- | --- |
| Four weapon definitions, switching, rocket simulation, splash | Native magazines, timed reloads, pellets, automatic pulse, swept projectiles and occluded blast implemented. Balance remains provisional. |
| Nine enemy kinds, armor, patrol/alert/chase/retreat/death, perception | Native catalog and state machine, LOS, sound investigation, cloak, ranged projectiles, strafing, Warden telegraph/volley/shockwave/half-health cooldown implemented. Local steering is not global pathfinding. |
| Inventory/credits/keys/logs | Native persistent arrays and pickups, TAB summary; drag/reorder hotbar and full inventory browser not ported. |
| Terminals, transcript/tag events and hacking puzzle | Native short transcript feedback, sector power/card/containment gates and data-driven story component. Full hacking minigame/tag language not ported. |
| Four maps/registry/transitions | Five compact authored Godot sectors using native LevelBlock; web geometry not copied. Layout and resource tuning need human testing. |
| Stamina/difficulty/light-modulated awareness | Native acceleration/sprint/head/weapon bob and settings; stamina, difficulty and light-based stealth not implemented. |
| Audio mixer/adaptive threat/voices | Native buses, bounded SFX pool and original synthesized temporary sounds/music/ambient. Spatial mixing/adaptive score/recorded logs remain. Headless does not start audio playback. |
| FX/boss intro/HP/death/final stats | Native transient impacts, flash, hitmarker, damage overlay/shake, boss HP bar and ending stats. Final decals/particles/true vignette shader remain. |
| Menu/pause/options/save import/export | Native menu/pause/options/validated Continue/checkpoint/save v2; user save-file import/export UI not implemented. |
| Map renderer/procedural materials/browser touch/platform shell | Native collision/3D environment/block kit/labs/export presets; procedural texture pipeline, touch/Android deferred. |
| Local telemetry | Native event timing/level/objective durations/combat/pickup/death positions and run summary, local files only. |

## Art truth

Runtime sheets override preferred *source* sizes: enemy 2048×1600 (8 directions × 5 states, cell 256×320), weapon 3840×460 (5 states, cell 768×460). Each cell currently contains **one** pose. Eight columns are directions, not temporal frames. Several directions reuse a silhouette or mirrored art. Baseline remains intact; no generated art passed off as final.

SpriteController uses cached atlas regions and frame timers, procedural baseline bob/hit/death motion. Optional sequential `<kind>_sheet_001.png` etc retain the same grid and can supply painted temporal frames. Final per-direction silhouettes and authored multi-frame animations are still P2 production work. Weapon states sequence fire/recoil/reload/empty with bob/sway/muzzle flash; current sheets remain single-pose states.

## Validation boundaries

`production_tests.tscn` traverses all sectors by **debug fulfillment** of objectives: structural evidence only. Its normal ray/LOS/damage/reload/input cases are actual engine/physics tests, but do not prove combat feel. `simulation_playthrough.tscn` separately uses normal movement, collision, ammo, damage and ray interaction without teleports/HP overrides/forced kills; its result must be reported explicitly.

Desktop exports are test builds. Linux is runnable headless locally. Windows export is not proof of Windows execution. This environment cannot establish an X11/Wayland display (including attempted Xvfb socket startup), so visual capture, normal audio playback and 60 FPS on ordinary hardware remain unverified locally. `visual_smoke.tscn` is ready for a graphical environment and captures menu/options/gameplay; no human playtest has occurred.

This is a campaign **candidate**, not a release declaration. The principal gate—an unfamiliar human playing New Game through credits—remains open. Keep PR draft, no merge.

## Automated gameplay outcome

A normal-mechanics headless bot completed sectors 0–4 without HP overrides, teleport, forced kills, objective flags or resource grants: 77.57 simulated seconds, 0 deaths, 13 enemies defeated, 75 shots, 73 successful shots, 33 damage, 5 pickups. This validates mechanical reachability, not human difficulty: the bot aims precisely and uses the catalogs. The mandatory seeded rerun also passed: 80.68 simulated seconds, 0 deaths, 13 kills, 77 shots, 75 successful shots, 13 damage, 5 pickups. Production tests now cover 560 checks, including imported per-cell pixels. Pickups now use a separate collision layer: ray-interactable but do not block walking, enemy perception or projectiles. Earlier stalled simulations were retained in the scratch logs and corrected (door interaction threshold in the bot; solid pickup obstruction).

## Cycle 2026-10-06

- P1: enemies shot from beyond hearing range (24 m; pistol range 44 m) never reacted. Damage now sets last known position to the shooter and alerts idle/patrolling enemies.
- P2: moving enemies had no separation and stacked on one point. Added light local separation steering.
- P2: legacy slice "RETRY CHECKPOINT" respawned in place but left the death menu up, tree paused and mouse released. Pause menu now resumes before respawn.
- Tests: 562 checks (alert-on-damage, separation). All Godot gates and gameplay simulation pass. No human playtest has occurred.
- fx.svg now drives impacts (spark on walls, energy on enemies), toxic/energy/rocket projectiles and explosions (with a short unshadowed light). The sheet has no grid, so explicit regions live in `NeuroImpact.REGIONS` and `runtime_manifest.json` `fx_regions`; tests check manifest match, non-empty pixels and no clipping. `bolt` region is directional and not yet used.
- Player input moved from hard-coded keycodes to InputMap actions on physical keys (registered by the Settings autoload). A rebinding UI is not implemented yet.
- Options → CONTROLS: per-action rebinding (click, press key; Esc cancels), conflicting key is swapped so no action is left unbound, RESET DEFAULTS, persisted in `neurodoom_settings.cfg` `[bindings]`.
- Scorch decals (darkened fx spark, ImageTexture because decals use the renderer atlas) on hitscan wall hits and rocket blasts; pool of 32, oldest recycled.
- Damage feedback: full-screen red tint replaced by an edge-only shader vignette; persistent slow pulse at HP ≤ 30. Headless uses a dummy renderer, so shader appearance is unverified until a graphical run.
- Sprint stamina from web reference (drain 35/s, regen 30/s, no sprint below 1); thin HUD bar hidden when full. Not saved (transient).
- Difficulty Easy/Normal/Hard in Options scales damage taken 0.6/1.0/1.5 (web `DIFFICULTY_DAMAGE_TAKEN`). Rocket self-damage is scaled too.
- TAB inventory panel: pauses, lists HP, credits, cards, per-weapon ammo and recovered logs; logs are re-readable (text resolved from campaign data by level id). Esc/TAB close.
- Hitscan tracer using the `bolt` fx region, stretched along the shot and turned toward the camera, 70 ms. One tracer per shot, including shotgun.
- Adaptive mix: AudioDirector computes world threat (max awareness: chase/attack/retreat 1.0, alert 0.6), rising fast and decaying slowly; music bed −32→−12 dB, ambient −20→−28 dB. Headless cannot play audio; only the volume logic is tested.
- Light stealth: player light level 0.25–1 from campaign `quality_lights` (web `lightLevelAt`: 0.35 floor + 0.6 falloff per light), sampled every 0.2 s. Unalerted enemy sight range scales 50–100% with it; alerted enemies keep full range. HUD shows "IN SHADOW" below 0.5. Scenes without campaign lights count as fully lit. How often campaign spaces fall into shadow needs human playtest.
- Hacking minigame ported from web `Hacking.ts` (3 lines, Caesar+1 hints, token bank, 3 s/token, traces 5/3/2 by difficulty). Campaign neural relays now require a breach; failure triggers a trace (nearby enemies converge) and the relay can be retried; Esc aborts without penalty. The gameplay bot solves each breach by decoding hints (levels 0–3), not by setting flags.

## Product evolution follow-up

The 2026-10-06 product audit and authorized implementation are tracked in [PRODUCT_EVOLUTION.md](PRODUCT_EVOLUTION.md). Earlier gap tables above describe their historical baseline; use the follow-up for current native controls, hacking, inventory, save UX, audio and authoring status.
