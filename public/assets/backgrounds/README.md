# Cave Background Layers

Runtime uses these layers as optional sprite overlays:

- `cave-backdrop.svg` (far cave)
- `cave-midground.svg` (depth/mound tint)
- `cave-fog.svg` (soft atmospheric haze)

`src/scene/HoardScene.ts` still draws vector fallback geometry beneath these.
