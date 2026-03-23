import { BlurFilter, Container, Graphics, Sprite, Text } from 'pixi.js';
import type { HoardItem, Rarity } from '../types/content';
import { sizeClassToPixels } from '../physics/physicsConfig';
import { rarityWeight } from '../utils/rarityStyles';
import { hashString } from '../utils/seededRandom';
import { getTreasureAtlasTexture } from './atlasTextures';

const raritySpriteTint: Record<Rarity, number> = {
  common: 0xfff8ec,
  uncommon: 0xfffdf4,
  rare: 0xfafcff,
  epic: 0xfff9ff,
  legendary: 0xfff7e8,
};

const spriteScaleByType: Record<HoardItem['type'], { width: number; height: number }> = {
  coin: { width: 2.1, height: 2.1 },
  gem: { width: 2.15, height: 2.15 },
  artifact: { width: 2.84, height: 2.28 },
  'legendary-relic': { width: 2.44, height: 2.44 },
  'cursed-item': { width: 2.46, height: 2.14 },
  'metal-idol': { width: 2.0, height: 2.72 },
  'arcane-crystal': { width: 2.06, height: 2.86 },
  'scroll-capsule': { width: 3.08, height: 1.96 },
};

const typeGlowTint: Record<HoardItem['type'], number> = {
  coin: 0xf0c47d,
  gem: 0xa0c8ff,
  artifact: 0xd2a56f,
  'legendary-relic': 0xffde8a,
  'cursed-item': 0xd16d89,
  'metal-idol': 0xb4bfd0,
  'arcane-crystal': 0x73d7df,
  'scroll-capsule': 0xe4c089,
};

const typeSpriteBoostTint: Record<HoardItem['type'], number> = {
  coin: 0xffefc6,
  gem: 0xffffff,
  artifact: 0xf8e0b2,
  'legendary-relic': 0xffefbd,
  'cursed-item': 0xffd7e8,
  'metal-idol': 0xe2d8c4,
  'arcane-crystal': 0xd8fbff,
  'scroll-capsule': 0xf4d8aa,
};

const SOFT_SHADOW_FILTER = new BlurFilter({ strength: 4.4, quality: 2 });
const SOFT_GLOW_FILTER = new BlurFilter({ strength: 2.3, quality: 1 });

export interface TreasureVisual {
  container: Container;
  shadow: Graphics;
  castShadow: Graphics;
  occlusion: Graphics;
  glow: Graphics;
  caustic: Graphics | null;
  glint: Graphics;
  sprite: Sprite;
  shade: Sprite;
  sheen: Sprite;
  ring: Graphics;
  radius: number;
  phase: number;
  depthScale: number;
  baseGlowAlpha: number;
}

export const createTreasureVisual = (item: HoardItem): TreasureVisual => {
  const container = new Container();
  container.sortableChildren = true;

  const radius = sizeClassToPixels[item.physics.sizeClass] * (item.featured ? 1.06 : 1);
  const glowTint = typeGlowTint[item.type];

  const castShadow = new Graphics();
  castShadow.ellipse(0, radius * 0.78, radius * 1.42, radius * 0.52).fill({ color: 0x000000, alpha: 0.19 });
  castShadow.zIndex = -0.4;
  castShadow.filters = [SOFT_SHADOW_FILTER];

  const shadow = new Graphics();
  shadow.ellipse(0, radius * 0.7, radius * 0.92, radius * 0.31).fill({ color: 0x000000, alpha: 0.26 });
  shadow.zIndex = 0;
  shadow.filters = [SOFT_SHADOW_FILTER];

  const glow = new Graphics();
  const baseGlowAlpha = 0.075 + rarityWeight[item.rarity] * 0.048;
  glow.ellipse(0, 0, radius * (1.26 + rarityWeight[item.rarity] * 0.14), radius * 0.94).fill({
    color: glowTint,
    alpha: baseGlowAlpha,
  });
  glow.zIndex = 1;
  glow.filters = [SOFT_GLOW_FILTER];
  glow.blendMode = 'add';

  const texture = getTreasureAtlasTexture(item.type);
  const spriteScale = spriteScaleByType[item.type];

  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.width = radius * spriteScale.width;
  sprite.height = radius * spriteScale.height;
  sprite.tint = typeSpriteBoostTint[item.type];
  sprite.alpha = 0.97;
  sprite.zIndex = 2;

  const shade = new Sprite(texture);
  shade.anchor.set(0.5);
  shade.width = sprite.width;
  shade.height = sprite.height;
  shade.position.set(0, radius * 0.08);
  shade.tint = 0x27160f;
  shade.alpha = 0.3;
  shade.blendMode = 'multiply';
  shade.zIndex = 2.05;

  const sheen = new Sprite(texture);
  sheen.anchor.set(0.5);
  sheen.width = sprite.width;
  sheen.height = sprite.height;
  sheen.tint = raritySpriteTint[item.rarity];
  sheen.alpha = item.type === 'metal-idol' ? 0.13 : 0.17;
  sheen.blendMode = 'screen';
  sheen.zIndex = 2.1;

  const occlusion = new Graphics();
  occlusion.ellipse(0, radius * 0.02, radius * 0.94, radius * 0.76).fill({ color: 0x060406, alpha: 0.12 });
  occlusion.zIndex = 2.2;
  occlusion.blendMode = 'multiply';

  const caustic =
    item.type === 'gem' || item.type === 'arcane-crystal' || item.rarity === 'legendary' || item.rarity === 'epic'
      ? new Graphics()
      : null;

  if (caustic) {
    caustic.ellipse(0, 0, radius * 0.96, radius * 0.42).fill({
      color: item.type === 'arcane-crystal' ? 0x92f0f3 : item.rarity === 'legendary' ? 0xffe39c : 0xffedd6,
      alpha: item.type === 'arcane-crystal' ? 0.2 : item.rarity === 'legendary' ? 0.16 : 0.1,
    });
    caustic.blendMode = 'add';
    caustic.rotation = -0.3;
    caustic.zIndex = 2.3;
  }

  const glint = new Graphics();
  glint
    .poly([
      -radius * 0.72,
      -radius * 1.06,
      -radius * 0.42,
      -radius * 1.06,
      radius * 0.66,
      radius * 1.04,
      radius * 0.4,
      radius * 1.04,
    ])
    .fill({ color: 0xfff7e4, alpha: 0.2 });
  glint.zIndex = 2.4;
  glint.alpha = 0.08;
  glint.blendMode = 'screen';

  const ring = new Graphics();
  ring.circle(0, 0, radius * 1.08).stroke({
    color: 0xffe7bc,
    width: 1.5,
    alpha: 0,
  });
  ring.zIndex = 3;

  if (item.featured || item.rarity === 'legendary') {
    const marker = new Text({
      text: item.rarity === 'legendary' ? '✦' : '•',
      style: {
        fill: '#ffe6ae',
        fontFamily: 'Georgia',
        fontSize: Math.max(13, radius * 0.5),
        stroke: { color: '#462811', width: 3 },
      },
    });
    marker.anchor.set(0.5);
    marker.position.set(radius * 0.78, -radius * 0.74);
    marker.alpha = 0.8;
    marker.zIndex = 5;
    container.addChild(marker);
  }

  if (caustic) {
    container.addChild(castShadow, shadow, glow, sprite, shade, sheen, occlusion, caustic, glint, ring);
  } else {
    container.addChild(castShadow, shadow, glow, sprite, shade, sheen, occlusion, glint, ring);
  }

  const phase = (hashString(item.id) % 628) / 100;

  return {
    container,
    shadow,
    castShadow,
    occlusion,
    glow,
    caustic,
    glint,
    sprite,
    shade,
    sheen,
    ring,
    radius,
    phase,
    depthScale: 1,
    baseGlowAlpha,
  };
};

export const setTreasureVisualState = (
  visual: TreasureVisual,
  options: {
    selected: boolean;
    hovered: boolean;
    visible: boolean;
    featuredMode: boolean;
    featured: boolean;
    reducedMotion: boolean;
    time: number;
    depthScale: number;
  },
): void => {
  const { selected, hovered, visible, featuredMode, featured, reducedMotion, time, depthScale } = options;

  const emphasis = selected ? 1.17 : hovered ? 1.08 : 1;
  const shimmerWave = reducedMotion ? 0.72 : 0.72 + 0.28 * Math.sin(time * 2 + visual.phase);

  visual.container.alpha = visible ? 1 : 0.15;
  visual.depthScale = depthScale;
  visual.container.scale.set(emphasis * depthScale);

  visual.sprite.alpha = visible ? (selected ? 1 : hovered ? 0.98 : 0.95) : 0.3;
  visual.shade.alpha = visible ? (selected ? 0.22 : 0.3) : 0.08;
  visual.sheen.alpha = visible ? (selected ? 0.26 : hovered ? 0.22 : 0.16) : 0.05;
  visual.sheen.x = reducedMotion ? 0 : Math.sin(time * 1.4 + visual.phase) * (visual.radius * 0.09);
  visual.sheen.y = reducedMotion ? 0 : Math.cos(time * 0.9 + visual.phase) * (visual.radius * 0.04);

  const featuredBoost = featuredMode && featured ? 0.07 : 0;
  visual.glow.alpha = visible ? visual.baseGlowAlpha + featuredBoost + (selected ? 0.05 : hovered ? 0.03 : 0) : 0.02;

  visual.shadow.scale.set(0.94 * depthScale, 0.95);
  visual.castShadow.scale.set(1 + (selected ? 0.11 : 0), 1 + (hovered ? 0.07 : 0));

  visual.ring.clear();
  if (selected || hovered || (featuredMode && featured)) {
    visual.ring.circle(0, 0, visual.radius * 1.1).stroke({
      color: selected ? 0xffefbf : hovered ? 0x9fd8db : 0xffd88e,
      width: selected ? 2.7 : 1.5,
      alpha: selected ? 0.86 : 0.76,
    });
  }

  visual.glint.alpha = visible ? (selected ? 0.24 : hovered ? 0.18 : 0.09) * shimmerWave : 0.02;
  visual.glint.x = reducedMotion ? 0 : Math.sin(time * 1.5 + visual.phase) * (visual.radius * 0.15);

  if (visual.caustic) {
    const causticWave = reducedMotion ? 0.76 : 0.65 + 0.35 * Math.sin(time * 1.12 + visual.phase * 1.2);
    visual.caustic.alpha = visible ? causticWave * (selected ? 0.28 : hovered ? 0.22 : 0.16) : 0.04;
    visual.caustic.rotation = -0.3 + (reducedMotion ? 0 : Math.sin(time * 0.74 + visual.phase) * 0.1);
  }
};
