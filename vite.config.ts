import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

// Development reads the real MainWebsite files; it never creates a second catalog.
function mainWebsite(): Plugin {
  const candidates = [process.env.MAIN_WEBSITE_ROOT, resolve(process.cwd(), '../MainWebsite'), resolve(process.cwd(), '../..')].filter(Boolean) as string[];
  const root = candidates.find(path => existsSync(resolve(path, 'data/showcase.json')));
  return {
    name: 'main-website-catalog',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = decodeURIComponent((request.url || '/').split('?')[0]);
        if (!root || !(/^\/(data|products|assets|support|privacy)\//.test(pathname) || /^\/(index|projects|about|campaign|contact)\.html$/.test(pathname))) return next();
        let file = resolve(root, `.${pathname}`);
        if (!file.startsWith(root + sep) || !existsSync(file)) return next();
        if (statSync(file).isDirectory()) file = resolve(file, 'index.html');
        if (!existsSync(file) || !statSync(file).isFile()) return next();
        const types: Record<string, string> = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
        response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
        response.setHeader('Cache-Control', 'no-cache');
        createReadStream(file).pipe(response);
      });
    }
  };
}

export default defineConfig({
  plugins: [mainWebsite(), react()],
  base: process.env.VITE_BASE_PATH || '/projects/DragonTreasury/',
  publicDir: false,
  build: { target: 'es2020', sourcemap: true, outDir: 'dist', chunkSizeWarningLimit: 900 },
});
