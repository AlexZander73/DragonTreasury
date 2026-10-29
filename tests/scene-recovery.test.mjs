import test from 'node:test';
import assert from 'node:assert/strict';
import { startScene, sceneFailure, renderPixelRatio } from '../src/treasury/scene-recovery.ts';

const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(overrides = {}) {
  const attempts = [], scenes = [], failures = [];
  let recoveries = 0;
  const session = startScene({
    load: async () => ({}),
    create: (_, reduced) => {
      attempts.push(reduced);
      return { disposed: false, dispose() { this.disposed = true; } };
    },
    ready: scene => scenes.push(scene),
    recovering: () => { recoveries++; },
    failed: failure => failures.push(failure),
    ...overrides,
  });
  return { session, attempts, scenes, failures, get recoveries() { return recoveries; } };
}

test('a lost graphics context gets one lighter replacement; repeated losses stop retrying', async () => {
  const app = harness();
  await flush();
  const failure = sceneFailure('context-lost', new Error('WebGL: context lost.'));
  app.session.interrupted(failure);
  await flush();
  assert.deepEqual(app.attempts, [false, true]);
  assert.equal(app.scenes[0].disposed, true);
  assert.equal(app.scenes[1].disposed, false);
  assert.equal(app.recoveries, 1);
  assert.equal(app.failures.length, 0);
  app.session.interrupted(failure);
  await flush();
  assert.equal(app.scenes[1].disposed, true);
  assert.deepEqual(app.failures, [failure]);
  assert.equal(app.attempts.length, 2);
  app.session.dispose();
});

test('failed downloads are reported as downloads without trying to initialize graphics', async () => {
  const app = harness({ load: async () => { throw new Error('Failed to fetch dynamically imported module'); } });
  await flush();
  assert.deepEqual(app.attempts, []);
  assert.equal(app.failures[0].stage, 'download');
  assert.match(app.failures[0].detail, /Failed to fetch/);
  app.session.dispose();
});

test('startup retries at reduced quality and keeps the original error if both attempts fail', async () => {
  const attempts = [];
  const app = harness({ create: (_, reduced) => { attempts.push(reduced); throw new Error('WebGL context unavailable'); } });
  await flush();
  assert.deepEqual(attempts, [false, true]);
  assert.deepEqual(app.failures, [{ stage: 'startup', detail: 'WebGL context unavailable' }]);
  app.session.dispose();
});

test('startup can recover without sending users to collection view', async () => {
  const app = harness({ create: (_, reduced) => {
    if (!reduced) throw new Error('Initial allocation failed');
    return { dispose() {} };
  } });
  await flush();
  assert.equal(app.scenes.length, 1);
  assert.equal(app.failures.length, 0);
  app.session.dispose();
});

test('unmount cancels an in-flight download and a queued graphics replacement', async () => {
  let resolveDownload;
  const app = harness({ load: () => new Promise(resolve => { resolveDownload = resolve; }) });
  app.session.dispose(); resolveDownload({});
  await flush();
  assert.equal(app.attempts.length, 0);
  const running = harness();
  await flush();
  running.session.interrupted(sceneFailure('context-lost', 'WebGL: context lost.'));
  running.session.dispose();
  await flush();
  assert.deepEqual(running.attempts, [false]);
  assert.equal(running.scenes[0].disposed, true);
});

test('manual retry starts lighter and does not enter another automatic retry loop', async () => {
  const app = harness({ reducedGraphics: true });
  await flush();
  app.session.interrupted(sceneFailure('context-lost', 'WebGL: context lost.'));
  await flush();
  assert.deepEqual(app.attempts, [true]);
  assert.equal(app.failures.length, 1);
  app.session.dispose();
});

test('Retina and large windows stay within the graphics pixel budget after resizing', () => {
  for (const [width, height, dpr] of [[1512, 900, 2], [3024, 1700, 2], [5120, 2880, 2], [390, 844, 3]]) {
    for (const reduced of [false, true]) {
      const ratio = renderPixelRatio(width, height, dpr, reduced);
      assert(width * height * ratio ** 2 <= (reduced ? 900_000 : 2_000_000) + 1);
      assert(ratio <= dpr);
    }
  }
  assert(Number.isFinite(renderPixelRatio(0, 0, 2, false)));
});
