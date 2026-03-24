# Optional Reference Sheets (Trace Cutout Mode)

You can drop raw reference sheets here to let `scripts/generate_painted_atlases.py`
cut out atlas parts directly from your art.

Supported filenames:

- Dragon sheet:
  - `dragon.png`
  - `dragon-reference.png`
  - `dragon-reference.webp`
  - `dragon-reference.jpg`
  - `dragon-sheet.png`
  - `dragon-sheet.webp`
  - `dragon-sheet.jpg`
- Treasure sheet:
  - `booty.png`
  - `treasure-reference.png`
  - `treasure-reference.webp`
  - `treasure-reference.jpg`
  - `treasure-sheet.png`
  - `treasure-sheet.webp`
  - `treasure-sheet.jpg`

When present, generator behavior is:

1. Crop predefined regions for parts.
2. Remove light/neutral background via chroma key.
3. Fit each cutout into the existing atlas frame contracts.

If files are absent, the script falls back to procedural painted generation.

## Optional Direct Part Cutouts (Preferred for Trace Mode)

If you already have traced cutouts, place them in:

- `public/assets/source/dragon-parts/`
- `public/assets/source/treasure-parts/`

Supported dragon part names (any of `.png|.webp|.jpg|.jpeg`):

- `dragon-body` (or `body`)
- `dragon-head` (or `head`)
- `dragon-jaw` (or `jaw`)
- `dragon-tail` (or `tail`)
- `dragon-wing` (or `wing`)
- `dragon-eye` (or `eye`)
- `dragon-horn` (or `horn`)
- `dragon-scales` (or `scales`)
- `dragon-spines` (or `spines`)
- `dragon-glow` (or `glow`)

Supported treasure part names include:

- `coin`, `gem`, `artifact`, `legendary-relic`, `cursed-item`,
  `metal-idol`, `arcane-crystal`, `scroll-capsule`

Priority order when generating each atlas frame:

1. Direct part cutout file from `dragon-parts/` or `treasure-parts/`
2. Crop from `dragon-reference.*` / `treasure-reference.*` sheet
3. Procedural painted fallback
