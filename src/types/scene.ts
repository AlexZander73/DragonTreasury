import type { ArrangeMode } from './filters';
import type { HoardItem, Rarity } from './content';
import type { DragonColorTheme } from './dragon';

export interface SceneQuality {
  maxParticles: number;
  dragonDetail: 'full' | 'lite';
  effects: boolean;
}

export interface SceneSelectionPayload {
  itemId: string;
  inspect: boolean;
}

export interface SceneCallbacks {
  onSelect: (payload: SceneSelectionPayload) => void;
  onDragonSecretUnlock: () => void;
  onDragonClick?: (count: number) => void;
  onAggressivePileDisturbance?: () => void;
}

export interface HoardSceneOptions {
  host: HTMLDivElement;
  items: HoardItem[];
  callbacks: SceneCallbacks;
  reducedMotion: boolean;
  muted: boolean;
  dragonColorTheme: DragonColorTheme;
  quality: SceneQuality;
}

export interface SceneRuntimeState {
  arrangeMode: ArrangeMode;
  highlightedItemId: string | null;
  visibleItemIds: Set<string>;
  featuredMode: boolean;
  reducedMotion: boolean;
}

export interface RarityStyle {
  glow: number;
  outline: number;
  sparkleChance: number;
  selectionTone: number;
}

export type RarityStyleMap = Record<Rarity, RarityStyle>;
