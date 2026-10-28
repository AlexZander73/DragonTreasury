import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { filterProjects, loadProjects } from '../src/treasury/catalog.ts';

const candidates = [process.env.MAIN_WEBSITE_ROOT, resolve('../MainWebsite'), resolve('../..')].filter(Boolean);
const root = candidates.find(path => existsSync(resolve(path, 'data/showcase.json')));
const projects = root ? JSON.parse(readFileSync(resolve(root, 'data/showcase.json'), 'utf8')) : [];

test('filters use the live MainWebsite registry with no duplicate or synthetic entries', { skip: !root && 'MainWebsite checkout is required for integration tests' }, () => {
  assert.equal(filterProjects(projects, 'all', '').length, projects.length);
  assert.deepEqual(filterProjects(projects, 'shipped', '').map(p => p.id), projects.filter(p => p.status === 'shipped').map(p => p.id));
  for (const category of new Set(projects.map(p => p.category))) {
    assert.deepEqual(filterProjects(projects, category, '').map(p => p.id), projects.filter(p => p.category === category).map(p => p.id));
  }
  for (const project of projects) assert(filterProjects(projects, 'all', `  ${project.title.toUpperCase()}  `).some(p => p.id === project.id));
  assert.equal(filterProjects(projects, 'all', '__no_such_treasure__').length, 0);
  assert.equal(new Set(projects.map(p => p.id)).size, projects.length);
});

test('shared loader owns subpath URLs, order, launch counts and preview gating', { skip: !root && 'MainWebsite checkout is required for integration tests' }, async () => {
  const script = readFileSync(resolve(root, 'assets/js/project-catalog.js'), 'utf8');
  const requests = [];
  const window = {};
  runInNewContext(script, {
    window, URL,
    document: { currentScript: { src: 'https://example.test/portfolio/assets/js/project-catalog.js' } },
    fetch: async url => { requests.push(String(url)); return { ok: true, json: async () => JSON.parse(JSON.stringify(projects)) }; }
  });
  const api = window.ProjectCatalog;
  const loaded = await api.load();
  await api.load();
  assert.deepEqual(requests, ['https://example.test/portfolio/data/showcase.json']);
  assert.equal(api.unlockedCount(loaded), projects.filter(p => p.status === 'shipped').length);
  assert.equal(api.resolveUrl('/products/sample/'), 'https://example.test/portfolio/products/sample/');
  for (const project of loaded) {
    assert.equal(api.canEnter(project), Boolean(project.url) && (project.status === 'shipped' || project.previewAvailable === true));
    assert.match(project.image, /^https?:\/\//);
  }
});

test('treasury reports unavailable or invalid catalogs instead of inventing fallback content', async () => {
  globalThis.window = {};
  await assert.rejects(loadProjects(), /shared project catalog is unavailable/);
  globalThis.window = { ProjectCatalog: { load: async () => [{ id: 'duplicate' }, { id: 'duplicate' }] } };
  await assert.rejects(loadProjects(), /duplicate IDs/);
  globalThis.window = { ProjectCatalog: { load: async () => { throw new Error('Network failure'); } } };
  await assert.rejects(loadProjects(), /Network failure/);
  delete globalThis.window;
});
