# The Hoard (Working Title)

An interactive 2.5D dragon cave archive where every item in the treasure pile represents a project, product, experiment, note, or relic.

This is intentionally atmospheric and tactile rather than practical portfolio UI.

## Concept

The Hoard is a static site that runs entirely in the browser and deploys cleanly to GitHub Pages.

- `PixiJS` renders a layered cave scene with fake depth (parallax, haze, glow, vignette, particles).
- `Matter.js` drives physical treasure collisions and drag/toss interactions.
- `GSAP` handles polish animations (intro fade, panel transitions, dragon behavior beats).
- Local content modules provide the source of truth for relic metadata.

## Stack

- Vite
- React + TypeScript
- PixiJS
- Matter.js
- GSAP
- GitHub Actions for GitHub Pages deploy

## Quick Start

```bash
npm install
npm run dev
```

Open the local Vite URL shown in terminal.

## Build

```bash
npm run build
npm run preview
```

Build output is generated in `dist/`.

## GitHub Pages Deployment

This repository includes `.github/workflows/deploy-pages.yml`.

Deployment assumptions:

- Branch: `main`
- Action sets `VITE_BASE_PATH=/<repo-name>/`
- Built static output from `dist/` is uploaded and deployed via `actions/deploy-pages`

If your Pages configuration is repository-based (not custom domain), this works out of the box.

## Project Structure

```text
src/
  app/                App orchestration/state
  audio/              WebAudio manager (ambient + SFX)
  components/         React UI and scene host components
  content/            Seed data, taxonomy mapping, adapter abstraction
  hooks/              Local storage + motion preference hooks
  physics/            Matter engine setup and arrangement logic
  scene/              Pixi scene, dragon actor, particles, treasure visuals
  styles/             Global and UI styling
  types/              Shared domain types
  utils/              Filtering, seeded RNG, helpers
public/assets/
  backgrounds/
  dragon/
  treasure/
  particles/
  ui/
  audio/
  docs/
scripts/
  generate_painted_atlases.py
```

## Content System

Runtime content source:

- `src/content/seedData.ts`

Current seed includes:

- A curated sample archive
- Real catalog entries from your provided `Products` and `Projects` lists
- Supplemental seed entries for interaction/scale testing

Key schema (`HoardItem`) includes:

- id, title, short/long descriptions
- type, category, rarity, status, year
- tags, tech stack, links, images
- repo/live URL, notes, why-it-matters
- visual hints, physics properties, dragon affinity, featured flag

### Edit / Add Items

1. Open `src/content/seedData.ts`.
2. Add or update entries using `createDefaultItem({...})`.
3. Keep IDs unique.
4. Rebuild and confirm behavior in filters + scene.

### Future Import Adapter

The app does not depend on scraping.

For future ingestion:

- Implement `ContentAdapter` in `src/content/adapters.ts`.
- Add build-time importer scripts (optional) under a `scripts/` folder.
- Validate imported entries with `validateHoardItems`.

See `src/content/importer/README.md`.

## Interaction Summary

- Drag/toss treasure items; neighboring objects react through real collisions.
- Single click selects and opens lore.
- Double click focuses item and opens lore with stronger emphasis.
- Toggle arrange mode:
  - pile
  - timeline
  - category
  - era
- Scene switcher with distinct atmosphere:
  - dragon cave
  - castle vault
  - mountain summit
  - ancient forest
  - sunken treasury
- Filters: category, rarity, year range, tags, query, featured highlight.
- Accessibility fallback: browse list mode for keyboard-first navigation.

## Dragon Behavior System

Implemented in `src/scene/DragonActor.ts`.

Includes:

- breathing and chest glow cycle
- blinking and subtle head/eye tracking
- tail and wing idle motion
- periodic smoke
- reactive look/huff on stronger disturbances
- legendary focus reaction
- occasional nudge of nearby treasure
- hidden interaction path (secret relic unlock)

## Audio System

Implemented in `src/audio/AudioManager.ts`.

- Ambient cave loop (procedural fallback)
- Scene-reactive ambient profiles (different EQ/noise per environment)
- Optional BGM tracks (including auto scene-linked mode)
- Collision accents
- Select accents by rarity
- Dragon huff/rumble cues
- Mute toggle persisted in localStorage
- Audio unlock deferred until first user interaction (browser-policy safe)

Optional replacement audio files can be added under `public/assets/audio/`.

## Performance and Quality Tuning

Controls and safeguards are spread across:

- `src/physics/physicsConfig.ts`
- `src/scene/ParticleSystem.ts`
- `src/app/App.tsx` (quality selection)

Important knobs:

- `maxParticles`
- drag toss multiplier and velocity limits
- arrangement pull strength
- reduced motion toggle
- mobile quality fallback

Target range is approximately 40–100 physics items with graceful behavior.

## Accessibility Considerations

- Keyboard-accessible controls
- Visible focus rings
- Reduced motion toggle
- Mute toggle
- Browse list fallback for non-drag navigation
- Lore panel scroll support and readable contrast
- Escape key closes lore panel

## Asset Replacement Guide

- Read `public/assets/docs/asset-spec.md`
- Dragon layer guide: `public/assets/dragon/dragon-layer-guide.txt`
- Treasure sheet naming: `public/assets/treasure/treasure-sheet-guide.txt`
- Runtime dragon + treasure visuals are atlas-driven from `public/assets/atlases/*.png|*.webp` (frame metadata in `*.json`).
- Regenerate current painted atlas set with:

```bash
python3 scripts/generate_painted_atlases.py
```

Optional trace-cutout mode:

- Drop `dragon-reference.(png|webp|jpg)` and/or `treasure-reference.(png|webp|jpg)` into `public/assets/source/`.
- Shortcut names are also supported: `public/assets/source/dragonhero.png`, `public/assets/source/dragon.png`, and `public/assets/source/booty.png`.
- Optional: place direct traced cutouts in `public/assets/source/dragon-parts/` and `public/assets/source/treasure-parts/` with part names from `public/assets/source/README.md`.
- The generator prefers direct cutout files, then sheet crops, then procedural painted fallback.

The rig and physics layer contracts stay stable as long as frame keys and dimensions remain consistent.

## Notes on Static Compatibility

- No backend required.
- No runtime database.
- No paid services.
- No runtime scraping dependency.
- Local content data is the source of truth.
- `dist/` output is fully static and GitHub Pages compatible.

## Future Extensions

- Swap generated atlases with fully hand-painted production atlases
- Optional sprite sheets for richer dragon animation cycles
- Build-time importer from external JSON sources
- Save user-created display presets (filter + arrange mode)
- Expanded hidden lore chains and rare ambient events
