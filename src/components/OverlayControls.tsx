import { CATEGORIES, RARITIES, type Category, type Rarity } from '../types/content';
import { DRAGON_COLOR_THEME_LABELS, DRAGON_COLOR_THEMES, type DragonColorTheme } from '../types/dragon';
import { BGM_TRACK_LABELS, BGM_TRACKS, SCENE_THEME_LABELS, SCENE_THEMES, type BgmTrack, type SceneTheme } from '../types/environment';
import type { ArrangeMode, FilterState } from '../types/filters';

interface OverlayControlsProps {
  filter: FilterState;
  onFilterChange: (next: FilterState) => void;
  arrangeMode: ArrangeMode;
  onArrangeModeChange: (mode: ArrangeMode) => void;
  muted: boolean;
  onMutedChange: (value: boolean) => void;
  reducedMotion: boolean;
  onReducedMotionChange: (value: boolean) => void;
  sceneTheme: SceneTheme;
  onSceneThemeChange: (value: SceneTheme) => void;
  bgmTrack: BgmTrack;
  onBgmTrackChange: (value: BgmTrack) => void;
  dragonColorTheme: DragonColorTheme;
  onDragonColorThemeChange: (value: DragonColorTheme) => void;
  featuredMode: boolean;
  onFeaturedModeChange: (value: boolean) => void;
  cleanMode: boolean;
  onCleanModeChange: (value: boolean) => void;
  browseMode: boolean;
  onBrowseModeChange: (value: boolean) => void;
  onResetPile: () => void;
  onOpenHelp: () => void;
  resultCount: number;
  totalCount: number;
  yearBounds: { min: number; max: number };
}

const toggleFromArray = <T,>(list: T[], value: T): T[] => {
  if (list.includes(value)) {
    return list.filter((entry) => entry !== value);
  }
  return [...list, value];
};

export const OverlayControls = ({
  filter,
  onFilterChange,
  arrangeMode,
  onArrangeModeChange,
  muted,
  onMutedChange,
  reducedMotion,
  onReducedMotionChange,
  sceneTheme,
  onSceneThemeChange,
  bgmTrack,
  onBgmTrackChange,
  dragonColorTheme,
  onDragonColorThemeChange,
  featuredMode,
  onFeaturedModeChange,
  cleanMode,
  onCleanModeChange,
  browseMode,
  onBrowseModeChange,
  onResetPile,
  onOpenHelp,
  resultCount,
  totalCount,
  yearBounds,
}: OverlayControlsProps) => {
  const update = (partial: Partial<FilterState>): void => {
    onFilterChange({ ...filter, ...partial });
  };

  return (
    <section className="controls" aria-label="Archive controls">
      <header className="controls-header">
        <h1>The Hoard</h1>
        <p>Mythic Archive of Builds and Relics</p>
      </header>

      <div className="controls-row">
        <label htmlFor="search">Search</label>
        <input
          id="search"
          type="search"
          value={filter.query}
          onChange={(event) => update({ query: event.target.value })}
          placeholder="Whisper a name, tag, or stack"
        />
      </div>

      <div className="controls-row">
        <label htmlFor="tags">Tag Sigil</label>
        <input
          id="tags"
          type="text"
          value={filter.tagQuery}
          onChange={(event) => update({ tagQuery: event.target.value })}
          placeholder="prototype, ai, lore..."
        />
      </div>

      <div className="controls-row">
        <span>Category</span>
        <div className="chip-grid">
          {CATEGORIES.map((category) => {
            const active = filter.categories.includes(category);
            return (
              <button
                key={category}
                type="button"
                className={`chip ${active ? 'active' : ''}`}
                onClick={() => update({ categories: toggleFromArray<Category>(filter.categories, category) })}
                aria-pressed={active}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <div className="controls-row">
        <span>Rarity</span>
        <div className="chip-grid">
          {RARITIES.map((rarity) => {
            const active = filter.rarities.includes(rarity);
            return (
              <button
                key={rarity}
                type="button"
                className={`chip rarity-${rarity} ${active ? 'active' : ''}`}
                onClick={() => update({ rarities: toggleFromArray<Rarity>(filter.rarities, rarity) })}
                aria-pressed={active}
              >
                {rarity}
              </button>
            );
          })}
        </div>
      </div>

      <div className="controls-row year-row">
        <span>Era Range</span>
        <div className="year-inputs">
          <label htmlFor="yearFrom" className="visually-hidden">
            Year from
          </label>
          <input
            id="yearFrom"
            type="number"
            min={yearBounds.min}
            max={yearBounds.max}
            value={filter.yearFrom}
            onChange={(event) => {
              const next = Number(event.target.value);
              update({ yearFrom: Number.isFinite(next) ? Math.max(yearBounds.min, Math.min(next, filter.yearTo)) : filter.yearFrom });
            }}
          />
          <span>to</span>
          <label htmlFor="yearTo" className="visually-hidden">
            Year to
          </label>
          <input
            id="yearTo"
            type="number"
            min={yearBounds.min}
            max={yearBounds.max}
            value={filter.yearTo}
            onChange={(event) => {
              const next = Number(event.target.value);
              update({ yearTo: Number.isFinite(next) ? Math.min(yearBounds.max, Math.max(next, filter.yearFrom)) : filter.yearTo });
            }}
          />
        </div>
      </div>

      <div className="controls-row">
        <label htmlFor="arrangeMode">Arrange</label>
        <select
          id="arrangeMode"
          value={arrangeMode}
          onChange={(event) => onArrangeModeChange(event.target.value as ArrangeMode)}
        >
          <option value="pile">Natural pile</option>
          <option value="timeline">By timeline</option>
          <option value="category">By category</option>
          <option value="era">By era</option>
        </select>
      </div>

      <div className="controls-row">
        <label htmlFor="dragonColorTheme">Dragon Palette</label>
        <select
          id="dragonColorTheme"
          value={dragonColorTheme}
          onChange={(event) => onDragonColorThemeChange(event.target.value as DragonColorTheme)}
        >
          {DRAGON_COLOR_THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {DRAGON_COLOR_THEME_LABELS[theme]}
            </option>
          ))}
        </select>
      </div>

      <div className="controls-row">
        <label htmlFor="sceneTheme">Scene</label>
        <select
          id="sceneTheme"
          value={sceneTheme}
          onChange={(event) => onSceneThemeChange(event.target.value as SceneTheme)}
        >
          {SCENE_THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {SCENE_THEME_LABELS[theme]}
            </option>
          ))}
        </select>
      </div>

      <div className="controls-row">
        <label htmlFor="bgmTrack">Music Track</label>
        <select id="bgmTrack" value={bgmTrack} onChange={(event) => onBgmTrackChange(event.target.value as BgmTrack)}>
          {BGM_TRACKS.map((track) => (
            <option key={track} value={track}>
              {BGM_TRACK_LABELS[track]}
            </option>
          ))}
        </select>
      </div>

      <div className="controls-row">
        <label htmlFor="featuredOnly">Featured Filter</label>
        <button
          id="featuredOnly"
          type="button"
          onClick={() => update({ featuredOnly: !filter.featuredOnly })}
          aria-pressed={filter.featuredOnly}
        >
          {filter.featuredOnly ? 'Showing featured only' : 'Include all relics'}
        </button>
      </div>

      <div className="controls-toggles" role="group" aria-label="Feature toggles">
        <button type="button" onClick={() => onMutedChange(!muted)} aria-pressed={!muted}>
          {muted ? 'Unmute cave' : 'Mute cave'}
        </button>
        <button type="button" onClick={() => onReducedMotionChange(!reducedMotion)} aria-pressed={reducedMotion}>
          {reducedMotion ? 'Enable motion' : 'Reduce motion'}
        </button>
        <button type="button" onClick={() => onFeaturedModeChange(!featuredMode)} aria-pressed={featuredMode}>
          {featuredMode ? 'Show all' : 'Featured glow'}
        </button>
        <button type="button" onClick={() => onCleanModeChange(!cleanMode)} aria-pressed={cleanMode}>
          {cleanMode ? 'Exit clean mode' : 'Clean mode'}
        </button>
        <button type="button" onClick={() => onBrowseModeChange(!browseMode)} aria-pressed={browseMode}>
          {browseMode ? 'Hide list' : 'Browse list'}
        </button>
      </div>

      <div className="controls-actions">
        <button type="button" onClick={onResetPile}>
          Reset pile
        </button>
        <button type="button" onClick={onOpenHelp}>
          Help
        </button>
      </div>

      <footer className="controls-footer">
        <span>{resultCount} visible relics</span>
        <span>{totalCount} total in vault</span>
      </footer>
    </section>
  );
};
