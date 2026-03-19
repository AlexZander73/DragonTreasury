import { Assets, Rectangle, Texture } from 'pixi.js';
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
const preloadPromises = new Map<AtlasKind, Promise<Texture>>();
const loadedPathByKind = new Map<AtlasKind, string>();

const getPreferredImagePaths = (kind: AtlasKind): string[] => {
  const def = atlasDefs[kind];
  return canUseWebp ? [def.imageWebp, def.imagePng] : [def.imagePng, def.imageWebp];
};

const preloadAtlasKind = async (kind: AtlasKind): Promise<Texture> => {
  const cached = baseTextureCache.get(kind);
  if (cached) {
    return cached;
  }

  const existing = preloadPromises.get(kind);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    let lastError: unknown;
    for (const imagePath of getPreferredImagePaths(kind)) {
      const url = withBase(imagePath);
      try {
        const loaded = await Assets.load(url);
        const texture = loaded instanceof Texture ? loaded : Texture.from(url);
        baseTextureCache.set(kind, texture);
        loadedPathByKind.set(kind, imagePath);
        return texture;
      } catch (error) {
        lastError = error;
      }
    }

    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Unable to preload ${kind} atlas texture. ${reason}`);
  })();

  preloadPromises.set(kind, promise);
  return promise;
};

export const preloadAtlasTextures = async (): Promise<void> => {
  await Promise.all((Object.keys(atlasDefs) as AtlasKind[]).map((kind) => preloadAtlasKind(kind)));
};

const getAtlasBaseTexture = (kind: AtlasKind): Texture => {
  const cached = baseTextureCache.get(kind);
  if (cached) {
    return cached;
  }

  const def = atlasDefs[kind];
  const imagePath = loadedPathByKind.get(kind) ?? (canUseWebp ? def.imageWebp : def.imagePng);
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
