import type { RarityStyleMap } from '../types/scene';

export const rarityWeight: Record<keyof RarityStyleMap, number> = {
  common: 0.7,
  uncommon: 0.9,
  rare: 1.1,
  epic: 1.35,
  legendary: 1.65,
};

export const rarityStyles: RarityStyleMap = {
  common: {
    glow: 0.06,
    outline: 0.7,
    sparkleChance: 0.002,
    selectionTone: 240,
  },
  uncommon: {
    glow: 0.12,
    outline: 1,
    sparkleChance: 0.004,
    selectionTone: 360,
  },
  rare: {
    glow: 0.2,
    outline: 1.35,
    sparkleChance: 0.008,
    selectionTone: 560,
  },
  epic: {
    glow: 0.28,
    outline: 1.8,
    sparkleChance: 0.012,
    selectionTone: 740,
  },
  legendary: {
    glow: 0.38,
    outline: 2.3,
    sparkleChance: 0.02,
    selectionTone: 980,
  },
};
