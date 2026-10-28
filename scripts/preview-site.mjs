import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

// Preview the actual MainWebsite output, including its one shared catalog.
// This helper is local tooling only; GitHub Pages serves the static files itself.
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [process.env.MAIN_WEBSITE_ROOT, resolve(sourceRoot, '../..'), resolve(sourceRoot, '../MainWebsite')].filter(Boolean).map(path => resolve(path));
const root = candidates.find(path => existsSync(resolve(path, 'data/showcase.json')));
if (!root) throw new Error('Set MAIN_WEBSITE_ROOT to the checkout containing data/showcase.json.');
if (!existsSync(resolve(root, 'projects/DragonTreasury/index.html'))) {
  throw new Error('The MainWebsite treasury has not been built. Run npm run build:site first.');
}

await preview({
  configFile: false,
  root: dirname(root),
  base: '/',
  publicDir: false,
  build: { outDir: root, emptyOutDir: false },
  preview: { host: '127.0.0.1', port: 4178, strictPort: true, open: false },
});
console.log('\nMainWebsite preview: http://127.0.0.1:4178/projects/DragonTreasury/');
console.log('Serving the built MainWebsite files and its existing shared catalog. Press Ctrl+C to stop.\n');
