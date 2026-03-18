export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TREASURE_ATLAS_DATA = {
  imagePng: '/assets/atlases/treasure-atlas.png',
  imageWebp: '/assets/atlases/treasure-atlas.webp',
  frames: {
    'coin': { x: 10, y: 10, w: 320, h: 320 },
    'gem': { x: 340, y: 10, w: 320, h: 320 },
    'artifact': { x: 670, y: 10, w: 290, h: 290 },
    'legendary-relic': { x: 970, y: 10, w: 340, h: 340 },
    'cursed-item': { x: 1320, y: 10, w: 300, h: 300 },
    'metal-idol': { x: 1630, y: 10, w: 280, h: 280 },
    'arcane-crystal': { x: 10, y: 360, w: 300, h: 300 },
    'scroll-capsule': { x: 320, y: 360, w: 250, h: 250 },
  },
} as const;
export const DRAGON_ATLAS_DATA = {
  imagePng: '/assets/atlases/dragon-atlas.png',
  imageWebp: '/assets/atlases/dragon-atlas.webp',
  frames: {
    'dragon-body': { x: 10, y: 10, w: 420, h: 420 },
    'dragon-head': { x: 440, y: 10, w: 260, h: 260 },
    'dragon-jaw': { x: 710, y: 10, w: 130, h: 130 },
    'dragon-tail': { x: 850, y: 10, w: 230, h: 230 },
    'dragon-wing': { x: 1090, y: 10, w: 280, h: 280 },
    'dragon-eye': { x: 1380, y: 10, w: 50, h: 50 },
    'dragon-horn': { x: 1440, y: 10, w: 150, h: 150 },
    'dragon-scales': { x: 1600, y: 10, w: 180, h: 180 },
    'dragon-spines': { x: 1790, y: 10, w: 140, h: 140 },
    'dragon-glow': { x: 10, y: 440, w: 300, h: 300 },
  },
} as const;

export type TreasureAtlasFrameKey = keyof typeof TREASURE_ATLAS_DATA.frames;
export type DragonAtlasFrameKey = keyof typeof DRAGON_ATLAS_DATA.frames;
