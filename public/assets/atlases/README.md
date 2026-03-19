# Painted Texture Atlases

Runtime now uses atlas textures for dragon and treasure rendering.

Files:

- `treasure-atlas.png`
- `treasure-atlas.webp`
- `treasure-atlas.json`
- `dragon-atlas.png`
- `dragon-atlas.webp`
- `dragon-atlas.json`

Code wiring:

- `src/scene/atlasData.ts`
- `src/scene/atlasTextures.ts`
- `src/scene/TreasureVisuals.ts`
- `src/scene/DragonActor.ts`

The rig and physics systems are unchanged.

Regenerate painted atlas textures:

```bash
python3 scripts/generate_painted_atlases.py
```
