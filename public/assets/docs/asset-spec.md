# The Hoard Asset Specification

This project intentionally supports placeholder-first development.

## Folder map

- `public/assets/backgrounds/` cave backdrops and fog overlays
- `public/assets/dragon/` dragon layered sprites or sheets
- `public/assets/treasure/` treasure item sprites by type + rarity
- `public/assets/particles/` additive particle sprites
- `public/assets/ui/` ornamental panel frames, placeholders, badges
- `public/assets/audio/` optional audio clips

## Naming conventions

- Treasure: `<type>-<rarity>.png`
- Dragon layers: `dragon-<part>.png`
- Audio: `<event>-<variant>.ogg`

## Art direction notes

- Warm cave palette with amber highlights and charcoal shadows
- Gem accents: ruby/emerald/sapphire/amethyst
- Subtle teal only for arcane interactions
- Favor textured gradients over flat fills

## Technical constraints

- Keep individual textures modest (< 512 KB if possible)
- Prefer WebP/PNG for sprites with alpha
- Keep loops short and seamless for ambient audio
