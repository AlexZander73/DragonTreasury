import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { HoardItem } from '../types/content';
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

  latestItemsRef.current = items;

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
    sceneReadyRef.current = false;
    const scene = new HoardScene({
      host: hostRef.current,
      items,
      reducedMotion,
      muted,
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

    preloadAtlasTextures()
      .then(() => scene.init(items))
      .then(() => {
        if (cancelled) {
          return;
        }
        sceneReadyRef.current = true;
        scene.setItems(latestItemsRef.current);
        onLoaded();
      })
      .catch((error) => {
        console.error('Failed to initialize scene', error);
        if (!cancelled) {
          onLoaded();
        }
      });

    return () => {
      cancelled = true;
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
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    sceneRef.current?.updateQuality(quality.maxParticles);
  }, [quality.maxParticles]);

  return <div ref={hostRef} className="scene-host" aria-label="Interactive dragon hoard scene" />;
});
