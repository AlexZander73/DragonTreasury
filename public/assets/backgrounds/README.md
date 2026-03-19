# Background Layers

Runtime scenes share a common lighting stack (`cave-color-grade.svg`, `cave-vignette.svg`, `torch-light.svg`, `foreground-mist.svg`)
and swap scene-specific geography layers:

- Cave:
  - `cave-backdrop.svg`
  - `cave-midground.svg`
  - `cave-fog.svg`
- Castle:
  - `castle-backdrop.svg`
  - `castle-midground.svg`
  - `castle-fog.svg`
- Mountain:
  - `mountain-backdrop.svg`
  - `mountain-midground.svg`
  - `mountain-fog.svg`
- Forest:
  - `forest-backdrop.svg`
  - `forest-midground.svg`
  - `forest-fog.svg`
- Ocean:
  - `ocean-backdrop.svg`
  - `ocean-midground.svg`
  - `ocean-fog.svg`

These files are safe to replace with painted assets if dimensions remain 1920x1080.
