# NEURODOOM Art Direction

## Target

NEURODOOM remains a **first-person** cyberpunk survival-horror FPS.

The visual language should be deliberately game-like and illustrated rather than photorealistic:

- readable silhouettes;
- painterly and gritty surfaces;
- restrained geometry;
- slightly chunky industrial props;
- dark neutral base palette;
- cyan / magenta / warning amber as emissive accents;
- fog and local light doing more work than texture detail;
- enemies presented as high-quality billboard sprites;
- first-person weapons presented as transparent viewmodel sprites.

Do not copy another game's assets or UI. References are for broad graphic treatment only.

## Enemy sprite contract

Preferred source size: 512x768 transparent PNG/WebP.

Directions:

- front
- front_left
- left
- back_left
- back
- back_right
- right
- front_right

Animations:

- idle
- walk
- attack
- hit
- death

Naming:

`<animation>_<direction>_<frame:03>.png`

Examples:

- `idle_front_000.png`
- `walk_front_left_003.png`
- `attack_right_002.png`
- `death_back_005.png`

Feet must stay on a stable baseline and transparent padding must remain consistent.

## First-person weapon contract

Canvas: 1024x512 transparent PNG/WebP.

Animations:

- idle
- fire
- recover
- reload
- inspect (optional)

Keep muzzle position stable enough for a separate muzzle-flash layer.

## Environment textures

Prefer authored materials at 256x256 or 512x512.

Families:

- concrete
- painted metal
- oxidized metal
- lab panels
- neural-organic surfaces
- signage
- blood/grime decals

## Palette roles

- cyan: access / information
- magenta: SHIVA / neural systems
- amber: caution / maintenance
- red: damage / hostile state

## Performance

Billboards and viewmodels must be atlas-friendly. Avoid giant transparent borders and unnecessary 4K runtime textures.
