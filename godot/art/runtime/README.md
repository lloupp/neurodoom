# NEURODOOM runtime sprite pack

Runtime-ready vector baseline for the Godot production track.

Enemy sheets are 8 columns x 5 rows.
- directions: front, front-left, left, back-left, back, back-right, right, front-right
- states: idle, walk, attack, hit, death
- frame: 256 x 320

Weapon sheets are 5 columns:
idle, fire, recoil, reload, empty.
- frame: 768 x 460

The runtime selects a region from these atlases with AtlasTexture, so the full sheet is never shown as one billboard.

Final hand-painted PNG/WebP frames can later replace these SVGs without changing the sheet contract.
