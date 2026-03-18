import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const getBasePath = (): string => {
  if (process.env.VITE_BASE_PATH) {
    return process.env.VITE_BASE_PATH;
  }

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return '/';
  }

  const repoName = repository.split('/')[1];
  return repoName ? `/${repoName}/` : '/';
};

export default defineConfig({
  plugins: [react()],
  base: getBasePath(),
  build: {
    target: 'es2020',
    sourcemap: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
});
