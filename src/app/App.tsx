import { useEffect, useMemo, useRef, useState } from 'react';
import { loadHoardContent } from '../content';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { CATEGORIES, RARITIES, type HoardItem } from '../types/content';
import type { DragonColorTheme } from '../types/dragon';
import { BGM_TRACKS, SCENE_THEMES, type BgmTrack, type SceneTheme } from '../types/environment';
import type { ArrangeMode, FilterState } from '../types/filters';
import { deriveYearRange, filterItems } from '../utils/filterItems';
import { AccessibilityList } from '../components/AccessibilityList';
import { HelpPopover } from '../components/HelpPopover';
import { HoardCanvas, type HoardCanvasHandle } from '../components/HoardCanvas';
import { LoadingScreen } from '../components/LoadingScreen';
import { LorePanel } from '../components/LorePanel';
import { OverlayControls } from '../components/OverlayControls';

const FLAVOR_LINES = [
  'Coins settle like whispered history.',
  'The dragon tracks your movement with ancient patience.',
  'Dust motes drift through spell-warm air.',
  'Some relics remember being built more than being shipped.',
  'The cave occasionally exhales with a low ember hum.',
];

export const App = () => {
  const sceneRef = useRef<HoardCanvasHandle | null>(null);

  const systemReducedMotion = usePrefersReducedMotion();
  const [allItems, setAllItems] = useState<HoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sceneLoaded, setSceneLoaded] = useState(false);

  const [muted, setMuted] = useLocalStorageState<boolean>('hoard-muted', true);
  const [motionPreference, setMotionPreference] = useLocalStorageState<boolean>('hoard-reduced-motion', false);
  const [lastArrangeMode, setLastArrangeMode] = useLocalStorageState<ArrangeMode>('hoard-arrange-mode', 'pile');
  const [dragonColorTheme, setDragonColorTheme] = useLocalStorageState<DragonColorTheme>('hoard-dragon-color', 'ember');
  const [sceneTheme, setSceneTheme] = useLocalStorageState<SceneTheme>('hoard-scene-theme', 'cave');
  const [bgmTrack, setBgmTrack] = useLocalStorageState<BgmTrack>('hoard-bgm-track', 'scene');

  const reducedMotion = motionPreference || systemReducedMotion;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [browseMode, setBrowseMode] = useState(false);
  const [featuredMode, setFeaturedMode] = useState(false);
  const [cleanMode, setCleanMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [secretUnlocked, setSecretUnlocked] = useState(false);
  const [dragonTapCount, setDragonTapCount] = useState(0);

  const [viewportWidth, setViewportWidth] = useState<number>(() => window.innerWidth);
  const [flavorLine, setFlavorLine] = useState<string>(FLAVOR_LINES[0]);

  const [filter, setFilter] = useState<FilterState>({
    query: '',
    categories: [],
    rarities: [],
    yearFrom: 2012,
    yearTo: 2026,
    featuredOnly: false,
    tagQuery: '',
  });

  useEffect(() => {
    if (!SCENE_THEMES.includes(sceneTheme)) {
      setSceneTheme('cave');
    }
    if (!BGM_TRACKS.includes(bgmTrack)) {
      setBgmTrack('scene');
    }
  }, [sceneTheme, bgmTrack, setBgmTrack, setSceneTheme]);

  useEffect(() => {
    setFilter((current) => {
      const categories = current.categories.filter((category) => CATEGORIES.includes(category));
      const rarities = current.rarities.filter((rarity) => RARITIES.includes(rarity));
      if (categories.length === current.categories.length && rarities.length === current.rarities.length) {
        return current;
      }
      return { ...current, categories, rarities };
    });
  }, []);

  useEffect(() => {
    let active = true;
    loadHoardContent()
      .then((items) => {
        if (!active) {
          return;
        }
        setAllItems(items);
        const range = deriveYearRange(items);
        setFilter((current) => ({
          ...current,
          yearFrom: range.min,
          yearTo: range.max,
        }));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onResize = (): void => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFlavorLine((current) => {
        const index = FLAVOR_LINES.indexOf(current);
        return FLAVOR_LINES[(index + 1) % FLAVOR_LINES.length];
      });
    }, 12000);
    return () => window.clearInterval(interval);
  }, []);

  const unlockedItems = useMemo(() => {
    return allItems.filter((item) => !item.hiddenUntilUnlocked || secretUnlocked);
  }, [allItems, secretUnlocked]);

  const yearBounds = useMemo(() => {
    if (unlockedItems.length === 0) {
      return { min: 2012, max: 2026 };
    }
    return deriveYearRange(unlockedItems);
  }, [unlockedItems]);

  const filteredItems = useMemo(() => filterItems(unlockedItems, filter), [unlockedItems, filter]);
  const filterHasDirectConstraints = useMemo(() => {
    if (filter.query.trim().length > 0 || filter.tagQuery.trim().length > 0 || filter.featuredOnly) {
      return true;
    }
    if (filter.categories.length > 0 || filter.rarities.length > 0) {
      return true;
    }
    if (filter.yearFrom > yearBounds.min || filter.yearTo < yearBounds.max) {
      return true;
    }
    return false;
  }, [filter, yearBounds.max, yearBounds.min]);

  const effectiveFilteredItems = useMemo(() => {
    if (!filterHasDirectConstraints && filteredItems.length === 0 && unlockedItems.length > 0) {
      return unlockedItems;
    }
    return filteredItems;
  }, [filterHasDirectConstraints, filteredItems, unlockedItems]);

  const visibleItemIds = useMemo(() => new Set(effectiveFilteredItems.map((item) => item.id)), [effectiveFilteredItems]);

  const selectedItem = useMemo(
    () => unlockedItems.find((item) => item.id === selectedId) ?? null,
    [selectedId, unlockedItems],
  );

  const quality = useMemo(() => {
    const mobile = viewportWidth < 960;
    return {
      maxParticles: reducedMotion ? 70 : mobile ? 120 : 220,
    };
  }, [viewportWidth, reducedMotion]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    if (!unlockedItems.some((item) => item.id === selectedId)) {
      setSelectedId(null);
      setPanelOpen(false);
    }
  }, [selectedId, unlockedItems]);

  useEffect(() => {
    const unlockAudio = async (): Promise<void> => {
      await sceneRef.current?.unlockAudio();
    };

    const handleFirstInteraction = (): void => {
      void unlockAudio();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  const handleSelectFromScene = (payload: { itemId: string; inspect: boolean }): void => {
    setSelectedId(payload.itemId);
    setPanelOpen(true);

    if (payload.inspect) {
      sceneRef.current?.focusItem(payload.itemId);
    }
  };

  const handleDragonSecretUnlock = (): void => {
    setSecretUnlocked(true);
    setSelectedId('ember-crown-secret');
    setPanelOpen(true);
    setFeaturedMode(true);
  };

  const handleSelectFromList = (itemId: string): void => {
    setSelectedId(itemId);
    setPanelOpen(true);
    sceneRef.current?.focusItem(itemId);
  };

  const handleResetPile = (): void => {
    setLastArrangeMode('pile');
    sceneRef.current?.resetPile();
  };

  return (
    <div className={`app-shell ${cleanMode ? 'clean-mode' : ''}`}>
      <HoardCanvas
        ref={sceneRef}
        items={unlockedItems}
        visibleItemIds={visibleItemIds}
        selectedItemId={selectedId}
        arrangeMode={lastArrangeMode}
        featuredMode={featuredMode}
        reducedMotion={reducedMotion}
        muted={muted}
        dragonColorTheme={dragonColorTheme}
        sceneTheme={sceneTheme}
        bgmTrack={bgmTrack}
        quality={quality}
        onSelect={handleSelectFromScene}
        onDragonSecretUnlock={handleDragonSecretUnlock}
        onDragonClickCount={setDragonTapCount}
        onLoaded={() => setSceneLoaded(true)}
      />

      <div className="vignette" aria-hidden="true" />

      <div className="ui-layer" aria-live="polite">
        {!cleanMode ? (
          <OverlayControls
            filter={filter}
            onFilterChange={setFilter}
            arrangeMode={lastArrangeMode}
            onArrangeModeChange={setLastArrangeMode}
            muted={muted}
            onMutedChange={setMuted}
            reducedMotion={reducedMotion}
            onReducedMotionChange={setMotionPreference}
            sceneTheme={sceneTheme}
            onSceneThemeChange={setSceneTheme}
            bgmTrack={bgmTrack}
            onBgmTrackChange={setBgmTrack}
            dragonColorTheme={dragonColorTheme}
            onDragonColorThemeChange={setDragonColorTheme}
            featuredMode={featuredMode}
            onFeaturedModeChange={setFeaturedMode}
            cleanMode={cleanMode}
            onCleanModeChange={setCleanMode}
            browseMode={browseMode}
            onBrowseModeChange={setBrowseMode}
            onResetPile={handleResetPile}
            onOpenHelp={() => setHelpOpen(true)}
            resultCount={effectiveFilteredItems.length}
            totalCount={unlockedItems.length}
            yearBounds={yearBounds}
          />
        ) : null}

        {!cleanMode ? (
          <LorePanel item={selectedItem} open={panelOpen} onClose={() => setPanelOpen(false)} />
        ) : null}

        <AccessibilityList
          open={browseMode || reducedMotion}
          items={effectiveFilteredItems}
          selectedId={selectedId}
          onSelect={handleSelectFromList}
          onInspect={handleSelectFromList}
        />

        <HelpPopover open={helpOpen && !cleanMode} onClose={() => setHelpOpen(false)} />

        {!cleanMode ? (
          <footer className="ambient-strip">
            <span>{flavorLine}</span>
            {dragonTapCount > 0 ? <span>Dragon trust taps: {dragonTapCount}/6</span> : null}
            {secretUnlocked ? <span>Hidden relic awakened.</span> : null}
          </footer>
        ) : null}
      </div>

      <LoadingScreen visible={loading || !sceneLoaded} />
    </div>
  );
};
