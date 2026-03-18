import { Rectangle, Texture } from 'pixi.js';
import { withBase } from '../utils/basePath';
import {
  DRAGON_ATLAS_DATA,
  TREASURE_ATLAS_DATA,
  type AtlasFrame,
  type DragonAtlasFrameKey,
  type TreasureAtlasFrameKey,
} from './atlasData';

const supportsWebp = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    if (!canvas.getContext) {
      return false;
    }
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
};

const canUseWebp = supportsWebp();

const atlasDefs = {
  treasure: TREASURE_ATLAS_DATA,
  dragon: DRAGON_ATLAS_DATA,
} as const;

type AtlasKind = keyof typeof atlasDefs;

const baseTextureCache = new Map<AtlasKind, Texture>();
const frameTextureCache = new Map<string, Texture>();

const getAtlasBaseTexture = (kind: AtlasKind): Texture => {
  const cached = baseTextureCache.get(kind);
  if (cached) {
    return cached;
  }

  const def = atlasDefs[kind];
  const imagePath = canUseWebp ? def.imageWebp : def.imagePng;
  const base = Texture.from(withBase(imagePath));
  baseTextureCache.set(kind, base);
  return base;
};

const getFrameTexture = (kind: AtlasKind, key: string, frame: AtlasFrame): Texture => {
  const cacheKey = `${kind}:${key}`;
  const cached = frameTextureCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const base = getAtlasBaseTexture(kind);
  const texture = new Texture({
    source: base.source,
    frame: new Rectangle(frame.x, frame.y, frame.w, frame.h),
  });

  frameTextureCache.set(cacheKey, texture);
  return texture;
};

export const getTreasureAtlasTexture = (key: TreasureAtlasFrameKey): Texture => {
  const frame = TREASURE_ATLAS_DATA.frames[key];
  return getFrameTexture('treasure', String(key), frame);
};

export const getDragonAtlasTexture = (key: DragonAtlasFrameKey): Texture => {
  const frame = DRAGON_ATLAS_DATA.frames[key];
  return getFrameTexture('dragon', String(key), frame);
};
