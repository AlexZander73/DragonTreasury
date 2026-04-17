import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { HoardItem } from '../types/content';
import type { DragonColorTheme } from '../types/dragon';
import type { BgmTrack, SceneTheme } from '../types/environment';
import type { ArrangeMode } from '../types/filters';
import { HoardScene } from '../scene/HoardScene';
import { preloadAtlasTextures } from '../scene/atlasTextures';

export interface HoardCanvasHandle {
  resetPile: () => void;
  focusItem: (id: string) => void;
  unlockAudio: () => Promise<void>;
}

interface HoardCanvasProps {
  items: HoardItem[];
  visibleItemIds: Set<string>;
  selectedItemId: string | null;
  arrangeMode: ArrangeMode;
  featuredMode: boolean;
  reducedMotion: boolean;
  muted: boolean;
  dragonColorTheme: DragonColorTheme;
  sceneTheme: SceneTheme;
  bgmTrack: BgmTrack;
  quality: {
    maxParticles: number;
  };
  onSelect: (payload: { itemId: string; inspect: boolean }) => void;
  onDragonSecretUnlock: () => void;
  onDragonClickCount: (count: number) => void;
  onLoaded: () => void;
}

export const HoardCanvas = forwardRef<HoardCanvasHandle, HoardCanvasProps>(function HoardCanvas(
  {
    items,
    visibleItemIds,
    selectedItemId,
    arrangeMode,
    featuredMode,
    reducedMotion,
    muted,
    dragonColorTheme,
    sceneTheme,
    bgmTrack,
    quality,
    onSelect,
    onDragonSecretUnlock,
    onDragonClickCount,
    onLoaded,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HoardScene | null>(null);
  const sceneReadyRef = useRef(false);
  const latestItemsRef = useRef<HoardItem[]>(items);
  const latestVisibleItemIdsRef = useRef<Set<string>>(visibleItemIds);

  latestItemsRef.current = items;
  latestVisibleItemIdsRef.current = visibleItemIds;

  useImperativeHandle(
    ref,
    () => ({
      resetPile: () => sceneRef.current?.resetPile(),
      focusItem: (id: string) => sceneRef.current?.focusItem(id),
      unlockAudio: () => sceneRef.current?.unlockAudio() ?? Promise.resolve(),
    }),
    [],
  );

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    let cancelled = false;
    let loadedSignaled = false;
    sceneReadyRef.current = false;
    const signalLoaded = (): void => {
      if (loadedSignaled) {
        return;
      }
      loadedSignaled = true;
      onLoaded();
    };

    const initTimeout = window.setTimeout(() => {
      if (cancelled || sceneReadyRef.current) {
        return;
      }
      console.warn('Scene initialization timed out; continuing UI load.');
      signalLoaded();
    }, 6500);

    const waitForHostSize = async (host: HTMLDivElement): Promise<void> => {
      const deadline = performance.now() + 2200;
      while (!cancelled && performance.now() < deadline) {
        const rect = host.getBoundingClientRect();
        if (rect.width > 120 && rect.height > 120) {
          return;
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    };

    const initialize = async (): Promise<void> => {
      const host = hostRef.current;
      if (!host) {
        return;
      }
      await waitForHostSize(host);
      if (cancelled) {
        return;
      }

      const scene = new HoardScene({
        host,
        items,
        reducedMotion,
        muted,
        dragonColorTheme,
        sceneTheme,
        bgmTrack,
        quality: {
          maxParticles: quality.maxParticles,
          dragonDetail: 'full',
          effects: true,
        },
        callbacks: {
          onSelect,
          onDragonSecretUnlock,
          onDragonClick: onDragonClickCount,
        },
      });

      sceneRef.current = scene;
      await preloadAtlasTextures();
      if (cancelled) {
        return;
      }
      await scene.init(items);
      if (cancelled) {
        return;
      }

      window.clearTimeout(initTimeout);
      sceneReadyRef.current = true;
      scene.setItems(latestItemsRef.current);
      scene.setVisibleItems(latestVisibleItemIdsRef.current);
      signalLoaded();
    };

    initialize().catch((error) => {
      window.clearTimeout(initTimeout);
      console.error('Failed to initialize scene', error);
      if (!cancelled) {
        signalLoaded();
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(initTimeout);
      sceneReadyRef.current = false;
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
    // Initialize once; subsequent state updates are handled by effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sceneReadyRef.current) {
      return;
    }
    sceneRef.current?.setItems(items);
  }, [items]);

  useEffect(() => {
    if (!sceneReadyRef.current) {
      return;
    }
    sceneRef.current?.setVisibleItems(visibleItemIds);
  }, [visibleItemIds]);

  useEffect(() => {
    sceneRef.current?.setSelectedItem(selectedItemId);
  }, [selectedItemId]);

  useEffect(() => {
    sceneRef.current?.setArrangeMode(arrangeMode);
  }, [arrangeMode]);

  useEffect(() => {
    sceneRef.current?.setFeaturedMode(featuredMode);
  }, [featuredMode]);

  useEffect(() => {
    sceneRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    sceneRef.current?.setDragonColorTheme(dragonColorTheme);
  }, [dragonColorTheme]);

  useEffect(() => {
    sceneRef.current?.setSceneTheme(sceneTheme);
  }, [sceneTheme]);

  useEffect(() => {
    sceneRef.current?.setBgmTrack(bgmTrack);
  }, [bgmTrack]);

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    sceneRef.current?.updateQuality(quality.maxParticles);
  }, [quality.maxParticles]);

  return <div ref={hostRef} className="scene-host" aria-label="Interactive dragon hoard scene" />;
});
