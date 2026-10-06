# Product evolution — 2026-10-06

Baseline: `2d0d74d`, PR #10. This branch is stacked on the native campaign branch; do not merge master or the campaign without explicit authorization.

| Audit item | Delivered | Validation boundary |
|---|---|---|
| 1 Notifications | Narrative subtitles and operational messages have separate channels | Test subtitles off/save still visible |
| 2 Controls | Interaction and help prompts resolve InputMap keys | Remap test |
| 3 Objectives | Remaining relay/card/containment requirements and next action | State-based test |
| 4 Documentation | Native entrypoint, updated production/tools guidance | Reviewed commands |
| 5 Saves | Manual/auto/previous campaign/legacy and backups; recovery picker; New Game confirmation | Corruption, independent slots and preservation tests |
| 6 UI | Scroll/focus-follow, font scale, pause save feedback, readable log titles | Engine tests; graphical CI captures |
| 7 Onboarding | HOW TO PLAY, context-sensitive instructions, guided hacking start and wrong-token feedback | Timer waits for explicit start; graphical CI |
| 8 Art sample | Authored textured sector dressing, worn shotgun SVG, generated front heavy study in Enemy Lab | Source alpha and runtime atlas extraction; human visual review still required |
| 9 Audio | Bounded 3D enemy/footstep/explosion sources with distance falloff | Engine structural checks; listening/mix review still required |
| 10 Navigation | Deterministic four-neighbour routes, closed doors, local steering/separation | Paths around walls/gates and gameplay traversal |
| 11 Campaign | Garden isolation valve; Spire containment/lift; Lab auxiliary card bridge; alternate passage | Normal-mechanics simulation plus human navigation review |
| 12 Progression | Pistol start; shotgun/pulse/rocket caches; credits spent on healing/ammo | Unlock, resource and charge validation |
| 13 Authoring | Sector editor dock, cell brush, undo, safe switching, validator and resource backups | Plugin import; map/reachability/deadlock validation; graphical authoring review pending |
| 14 Playtest | Sampled positions, session/chunk logs, graphical frame timing, summary CLI, capture CI and human protocol | Automated evidence does not substitute for a human |

## Scope decisions

No multiplayer, LLM enemies, open world, mobile port or full crafting. Those were explicitly marked not recommended in the audit, and are outside the 14 approved opportunities.

Art/audio are samples and placeholders; do not label them final. The generated pose study has imperfect spacing and does not satisfy all directions/temporal frames. Campaign art remains the baseline while the study is reviewable in the lab. Materials/dressing are actually used in campaign geometry.

## Findings while implementing

- A solid maintenance station obstructed the Spire card route in the automated playthrough. Stations now use the interaction layer and do not block movement, perception or shots. A collision-layer regression test protects this. The failed simulation output was retained during diagnosis.
- Invalid JSON parsing originally emitted engine errors even though the save was rejected. The save reader now uses the parser's return status and reports a recoverable UI error instead of engine diagnostics.
- Quick Load prefers the manual slot, falling back to Continue selection when unavailable. Continue chooses the latest primary valid save. Recovery options never silently rewrite files.

## Remaining release gates

An unfamiliar human completing the campaign, actual audio listening, Windows execution, ordinary hardware performance, graphical editor usability and final art direction sign-off remain open. Graphical CI uses software rendering and a dummy audio driver; its screenshots are layout evidence, not human gameplay or audio validation.
