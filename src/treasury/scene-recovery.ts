export type SceneStage = 'download' | 'startup' | 'context-lost' | 'render';
export interface SceneFailure { stage: SceneStage; detail: string }
export const sceneFailure = (stage: SceneStage, error: unknown): SceneFailure => ({
  stage,
  detail: error instanceof Error ? error.message : String(error || 'No further details were supplied.'),
});
export const sceneFailureMessage = (failure: SceneFailure) => ({
  download: 'The 3D files could not be loaded. Reload the page to try again.',
  startup: 'The 3D scene could not start, even with reduced graphics settings.',
  'context-lost': 'The graphics connection was interrupted. Try reopening the 3D world.',
  render: 'The 3D scene stopped while drawing. Try reopening it.',
})[failure.stage];

export function renderPixelRatio(width: number, height: number, deviceRatio: number, reducedGraphics: boolean) {
  const pixelBudget = reducedGraphics ? 900_000 : 2_000_000;
  return Math.min(deviceRatio, reducedGraphics ? 1 : 1.5, Math.sqrt(pixelBudget / Math.max(width * height, 1)));
}

// Keep module downloads distinct from graphics failures, and bound automatic
// recovery to one lighter attempt so an unavailable GPU cannot cause a loop.
export function startScene<T extends { dispose(): void }, M>(options: {
  load: () => Promise<M>;
  create: (module: M, reducedGraphics: boolean) => T;
  ready: (scene: T) => void;
  recovering: () => void;
  failed: (failure: SceneFailure) => void;
  reducedGraphics?: boolean;
}) {
  let stopped = false;
  let reducedGraphics = options.reducedGraphics ?? false;
  let scene: T | undefined;
  let module: M;
  const disposeScene = () => { scene?.dispose(); scene = undefined; };
  const failed = (failure: SceneFailure) => {
    if (stopped) return;
    disposeScene();
    console.error(`Treasury 3D ${failure.stage}: ${failure.detail}`);
    options.failed(failure);
  };
  const create = () => {
    if (stopped) return;
    try { scene = options.create(module, reducedGraphics); }
    catch (error) {
      if (!reducedGraphics) {
        console.warn('Treasury 3D startup failed; retrying with reduced graphics.', error);
        reducedGraphics = true;
        create();
      } else failed(sceneFailure('startup', error));
      return;
    }
    options.ready(scene);
  };
  options.load().then(loaded => { module = loaded; create(); }, error => failed(sceneFailure('download', error)));
  return {
    interrupted(failure: SceneFailure) {
      if (stopped || !scene) return;
      disposeScene();
      if (reducedGraphics) { failed(failure); return; }
      reducedGraphics = true;
      options.recovering();
      // Finish dispatching the old canvas's event before creating its replacement.
      queueMicrotask(create);
    },
    dispose() { stopped = true; disposeScene(); },
  };
}
