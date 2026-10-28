# Dragon Treasury

An interactive Three.js world for Zach Mackay's portfolio. An animated, faceted dragon watches over metallic coin piles, treasure chests, crystals, spellbooks and armillary orbs. Every selectable relic corresponds to one real MainWebsite project.

**Canonical destination:** `https://zachmackay.com/projects/DragonTreasury/`

## One project catalog

MainWebsite's **`data/showcase.json` is the only project registry**. The treasury loads it at runtime through MainWebsite's existing `assets/js/project-catalog.js`. That shared loader controls ordering, site-relative URLs and which projects can be entered. There is no bundled snapshot, separate seed list, scraping step or fallback set of projects.

Catalog edits appear on the next page load, without rebuilding the treasury. Only `status: "shipped"` counts as released. In-development projects can be entered only when the catalog enables `previewAvailable`; all projects remain inspectable in the treasury. Decorative coins and rocks are scenery, not invented catalog records.

## MainWebsite layout

- `tools/dragon-treasury/`: editable source, package lock, tests and build configuration.
- `projects/DragonTreasury/`: generated static page and hashed assets, served by MainWebsite.
- `data/showcase.json`: existing shared project registry.
- `assets/js/project-catalog.js`: existing shared catalog API.

The original DragonTreasury checkout can also run against its sibling `../MainWebsite`. After integration, make future changes in MainWebsite's `tools/dragon-treasury/`.

## Develop

Use Node 22.18+ (Node 24 LTS recommended).

```sh
cd tools/dragon-treasury
npm ci
npm run dev
```

Open the printed `/projects/DragonTreasury/` URL. Vite reads the actual MainWebsite catalog, shared loader, project images and product pages through a read-only middleware. It does not duplicate them. Set `MAIN_WEBSITE_ROOT` if MainWebsite isn't the containing repository or the original sibling checkout.

## Preview the built MainWebsite copy

```sh
cd tools/dragon-treasury
npm run preview
```

Open `http://127.0.0.1:4178/projects/DragonTreasury/`. This serves the actual files in MainWebsite's `projects/DragonTreasury/` together with its shared catalog, images and linked product pages. It does not use the Vite development app or a separate catalog. Run `npm run build:site` first after source changes.

Opening an `index.html` directly with `file://` cannot run the app's JavaScript modules or fetch its shared catalog; it now shows these instructions instead of a blank page. On GitHub Pages, the built HTML, CSS, JavaScript and JSON are served normally. **No backend or running Node process is needed in production.**

## Validate and build

```sh
npm test
npm run build:site
```

`build:site` type-checks, bundles and exports into MainWebsite's `projects/DragonTreasury/`. Commit the source and generated output together. Catalog-only changes do not require this build. MainWebsite's normal deployment publishes the page at the canonical route. `npm run build` alone only writes local `dist/`.

For the MainWebsite catalog and sitemap, run these from the repository root:

```sh
python3 scripts/build-catalog.py
python3 scripts/build-catalog.py --check
node --test scripts/project-catalog.test.cjs
```

The treasury source workflow builds and tests source changes and checks that the committed static output is current. Sitemap discovery includes the public `projects` directory, and excludes the editable source under `tools`.

## Explore

- Drag to orbit, scroll or pinch to zoom; Reset returns to the entrance.
- Click a 3D treasure or its collection card to read the project and follow an enabled project link.
- Wake the dragon for a wing stretch, head movement and ember breath.
- Switch between the Ember Vault, Moonlit Grotto and Emerald Hollow lighting.
- Arrange relics in a natural hoard or a gallery.
- Search by name, description, platform, technology or tag; filter by featured, released or category.
- Collection view exposes the same records without spatial navigation.
- `/` focuses search; Escape closes panels; controls and cards support keyboard navigation.
- Pause animation, opt into ambient sound, or reduce motion in Help. Reduced motion follows the system preference initially and can be overridden locally.

## Rendering and graceful fallback

Three.js loads after the catalog UI. No 3D model downloads or paid services are required: the rig, world, relics and animations are generated locally. Coin piles use instancing; mobile screens use fewer coins and a capped pixel ratio. Rendering pauses in hidden tabs and Collection view. If WebGL initialization or context fails, Collection view remains usable. Catalog errors are explicit and never silently replaced with stale data.

The serif and UI fonts use Google Fonts with local system fallbacks. All project imagery comes from MainWebsite's shared catalog. Scene geometry and UI code are original procedural assets.

## Source guide

- `src/treasury/dragon.ts`: articulated dragon, wings, tail, blinking, breathing and ember particles.
- `src/treasury/world.ts`: chamber, lighting, instanced coins, relics, picking, orbit controls and cleanup.
- `src/treasury/Treasury.tsx`: collection, details, filtering, accessibility and controls.
- `src/treasury/catalog.ts`: typed access to the existing shared catalog API.
- `src/treasury/sound.ts`: optional browser-generated ambient audio.
- `src/treasury/treasury.css`: responsive presentation.
- `tests/catalog.test.mjs`: actual-catalog integration, URL/access parity, filtering and failure checks.

Legacy sprite artwork in the original checkout's `public/` is not used, copied or deployed by the new build.
