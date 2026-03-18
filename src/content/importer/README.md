# Importer Adapter Area

The Hoard uses a local static content source (`src/content/seedData.ts`) as the canonical runtime input.

Future ingestion can plug in here by implementing the `ContentAdapter` interface from `src/content/adapters.ts`.

Guidelines:

- Keep runtime static-only for GitHub Pages.
- Pull external data at build time only (scripts, CI, or manual sync).
- Convert imported records into `HoardItem` objects.
- Validate with `validateHoardItems` before exporting.

Example extension path:

1. Add a script in `scripts/import-*.ts`.
2. Fetch remote JSON or GitHub metadata during build/prebuild.
3. Output a generated module or JSON file in `src/content/generated/`.
4. Add a new adapter that merges generated data with `seedData`.
