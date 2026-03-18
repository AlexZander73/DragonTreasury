import { BlurFilter, Container, Graphics, Sprite, Text } from 'pixi.js';
import type { HoardItem, Rarity } from '../types/content';
import { sizeClassToPixels } from '../physics/physicsConfig';
import { withBase } from '../utils/basePath';
import { rarityWeight } from '../utils/rarityStyles';
import { hashString } from '../utils/seededRandom';

const rarityColor: Record<Rarity, number> = {
  common: 0xb39670,
  uncommon: 0x7abb89,
  rare: 0x5b8de3,
  epic: 0xa36ae6,
  legendary: 0xf2bf5a,
};

const raritySpriteTint: Record<Rarity, number> = {
  common: 0xf6edd8,
  uncommon: 0xe4f5e8,
  rare: 0xdde8ff,
  epic: 0xf0ddff,
  legendary: 0xffefc9,
};

const typeColorOverride: Partial<Record<HoardItem['type'], number>> = {
  coin: 0xc7a35a,
  gem: 0x79b8ff,
  artifact: 0xbe8b5a,
  'legendary-relic': 0xf4d58a,
  'cursed-item': 0xba5566,
  'metal-idol': 0x9ca8bc,
  'arcane-crystal': 0x5ecfd0,
  'scroll-capsule': 0xc4a37c,
};

export interface TreasureVisual {
  container: Container;
  shadow: Graphics;
  castShadow: Graphics;
  occlusion: Graphics;
  glow: Graphics;
  caustic: Graphics | null;
  glint: Graphics;
  sprite: Sprite;
  textureOverlay: Sprite;
  core: Graphics;
  ring: Graphics;
  radius: number;
  phase: number;
  depthScale: number;
  baseGlowAlpha: number;
}

const SOFT_SHADOW_FILTER = new BlurFilter({ strength: 4, quality: 2 });
const SOFT_GLOW_FILTER = new BlurFilter({ strength: 2, quality: 1 });

const spriteScaleByType: Record<HoardItem['type'], { width: number; height: number }> = {
  coin: { width: 2.16, height: 2.16 },
  gem: { width: 2.12, height: 2.12 },
  artifact: { width: 2.9, height: 2.26 },
  'legendary-relic': { width: 2.38, height: 2.38 },
  'cursed-item': { width: 2.5, height: 2.2 },
  'metal-idol': { width: 1.95, height: 2.7 },
  'arcane-crystal': { width: 2.05, height: 2.8 },
  'scroll-capsule': { width: 3.02, height: 1.9 },
};

const textureByType: Partial<Record<HoardItem['type'], string>> = {
  coin: '/assets/textures/metal-grain.svg',
  artifact: '/assets/textures/metal-grain.svg',
  'legendary-relic': '/assets/textures/metal-grain.svg',
  'metal-idol': '/assets/textures/metal-grain.svg',
  'cursed-item': '/assets/textures/metal-grain.svg',
  gem: '/assets/textures/gem-grain.svg',
  'arcane-crystal': '/assets/textures/gem-grain.svg',
  'scroll-capsule': '/assets/textures/metal-grain.svg',
};

const drawTypeShape = (core: Graphics, item: HoardItem, radius: number, color: number): void => {
  core.clear();

  switch (item.type) {
    case 'coin': {
      core.circle(0, 0, radius).fill({ color, alpha: 0.98 });
      core.circle(0, 0, radius * 0.68).stroke({ color: 0xfde7b6, width: 2, alpha: 0.55 });
      break;
    }
    case 'gem': {
      core.poly([
        0,
        -radius,
        radius * 0.85,
        -radius * 0.18,
        radius * 0.56,
        radius,
        -radius * 0.56,
        radius,
        -radius * 0.85,
        -radius * 0.18,
      ]).fill({ color, alpha: 0.96 });
      core.poly([
        0,
        -radius,
        radius * 0.85,
        -radius * 0.18,
        radius * 0.56,
        radius,
        -radius * 0.56,
        radius,
        -radius * 0.85,
        -radius * 0.18,
      ]).stroke({ color: 0xeef5ff, width: 2, alpha: 0.5 });
      break;
    }
    case 'artifact': {
      core.roundRect(-radius * 0.95, -radius * 0.74, radius * 1.9, radius * 1.48, radius * 0.22).fill({
        color,
        alpha: 0.96,
      });
      core.circle(0, 0, radius * 0.3).fill({ color: 0xf4dba8, alpha: 0.35 });
      break;
    }
    case 'legendary-relic': {
      core.star(0, 0, 8, radius * 1.08, radius * 0.72, 0.2).fill({ color, alpha: 0.98 });
      core.circle(0, 0, radius * 0.5).stroke({ color: 0xfff5cc, width: 2, alpha: 0.6 });
      break;
    }
    case 'cursed-item': {
      core.poly([
        -radius,
        -radius * 0.8,
        radius,
        -radius * 0.2,
        radius * 0.6,
        radius,
        -radius * 0.8,
        radius * 0.78,
      ]).fill({ color, alpha: 0.93 });
      core.moveTo(-radius * 0.3, -radius * 0.6).lineTo(radius * 0.38, radius * 0.65).stroke({
        color: 0x22090f,
        width: 2,
        alpha: 0.6,
      });
      break;
    }
    case 'metal-idol': {
      core.roundRect(-radius * 0.72, -radius, radius * 1.44, radius * 2, radius * 0.22).fill({
        color,
        alpha: 0.98,
      });
      core.circle(0, -radius * 0.18, radius * 0.2).fill({ color: 0x152436, alpha: 0.7 });
      core.roundRect(-radius * 0.3, radius * 0.25, radius * 0.6, radius * 0.2, radius * 0.08).fill({
        color: 0x202b37,
        alpha: 0.66,
      });
      break;
    }
    case 'arcane-crystal': {
      core.poly([
        0,
        -radius * 1.1,
        radius * 0.64,
        -radius * 0.2,
        radius * 0.34,
        radius * 1.06,
        -radius * 0.34,
        radius * 1.06,
        -radius * 0.64,
        -radius * 0.2,
      ]).fill({ color, alpha: 0.95 });
      core.poly([
        0,
        -radius * 1.1,
        radius * 0.64,
        -radius * 0.2,
        radius * 0.34,
        radius * 1.06,
        -radius * 0.34,
        radius * 1.06,
        -radius * 0.64,
        -radius * 0.2,
      ]).stroke({ color: 0xdffaf7, width: 2, alpha: 0.55 });
      break;
    }
    case 'scroll-capsule': {
      core.roundRect(-radius * 1.08, -radius * 0.55, radius * 2.16, radius * 1.1, radius * 0.28).fill({
        color,
        alpha: 0.95,
      });
      core.circle(-radius * 0.9, 0, radius * 0.28).fill({ color: 0x6a4327, alpha: 0.82 });
      core.circle(radius * 0.9, 0, radius * 0.28).fill({ color: 0x6a4327, alpha: 0.82 });
      break;
    }
    default:
      core.circle(0, 0, radius).fill({ color, alpha: 0.95 });
  }
};

export const createTreasureVisual = (item: HoardItem): TreasureVisual => {
  const container = new Container();
  container.sortableChildren = true;

  const radius = sizeClassToPixels[item.physics.sizeClass] * (item.featured ? 1.06 : 1);
  const color = typeColorOverride[item.type] ?? rarityColor[item.rarity];

  const shadow = new Graphics();
  shadow.ellipse(0, radius * 0.68, radius * 0.88, radius * 0.28).fill({ color: 0x000000, alpha: 0.22 });
  shadow.zIndex = 0;
  shadow.filters = [SOFT_SHADOW_FILTER];

  const castShadow = new Graphics();
  castShadow.ellipse(0, radius * 0.7, radius * 1.2, radius * 0.44).fill({ color: 0x000000, alpha: 0.14 });
  castShadow.zIndex = -0.2;
  castShadow.filters = [SOFT_SHADOW_FILTER];

  const occlusion = new Graphics();
  occlusion.circle(0, 0, radius * 0.96).fill({ color: 0x080608, alpha: 0.1 });
  occlusion.zIndex = 1.8;
  occlusion.blendMode = 'multiply';

  const glow = new Graphics();
  const baseGlowAlpha = 0.08 + rarityWeight[item.rarity] * 0.05;
  glow.circle(0, 0, radius * (1.3 + rarityWeight[item.rarity] * 0.12)).fill({
    color,
    alpha: baseGlowAlpha,
  });
  glow.zIndex = 1;
  glow.filters = [SOFT_GLOW_FILTER];
  glow.blendMode = 'add';

  const sprite = Sprite.from(withBase(`/assets/treasure/${item.type}.svg`));
  const spriteScale = spriteScaleByType[item.type];
  sprite.anchor.set(0.5);
  sprite.width = radius * spriteScale.width;
  sprite.height = radius * spriteScale.height;
  sprite.tint = raritySpriteTint[item.rarity];
  sprite.alpha = 0.94;
  sprite.zIndex = 2;

  const textureOverlay = Sprite.from(withBase(textureByType[item.type] ?? '/assets/textures/metal-grain.svg'));
  textureOverlay.anchor.set(0.5);
  textureOverlay.width = sprite.width * 0.96;
  textureOverlay.height = sprite.height * 0.96;
  textureOverlay.alpha = 0.2;
  textureOverlay.blendMode = item.type === 'gem' || item.type === 'arcane-crystal' ? 'screen' : 'multiply';
  textureOverlay.zIndex = 2.05;

  const caustic =
    item.type === 'gem' || item.type === 'arcane-crystal' || item.rarity === 'legendary' || item.rarity === 'epic'
      ? new Graphics()
      : null;
  if (caustic) {
    caustic.ellipse(0, 0, radius * 0.92, radius * 0.46).fill({
      color: item.type === 'arcane-crystal' ? 0x8ce6ea : 0xffe2a4,
      alpha: item.type === 'arcane-crystal' ? 0.14 : 0.1,
    });
    caustic.blendMode = 'add';
    caustic.rotation = -0.32;
    caustic.zIndex = 2.1;
  }

  const glint = new Graphics();
  glint
    .poly([
      -radius * 0.66,
      -radius * 1.05,
      -radius * 0.4,
      -radius * 1.05,
      radius * 0.64,
      radius * 1.02,
      radius * 0.4,
      radius * 1.02,
    ])
    .fill({ color: 0xfff6df, alpha: 0.18 });
  glint.zIndex = 2.3;
  glint.alpha = 0.08;
  glint.blendMode = 'screen';

  const core = new Graphics();
  drawTypeShape(core, item, radius, color);
  core.alpha = 0.08;
  core.zIndex = 2.2;

  const ring = new Graphics();
  ring.circle(0, 0, radius * 1.06).stroke({
    color: 0xffe7bb,
    width: 1.5,
    alpha: 0,
  });
  ring.zIndex = 3;

  if (item.featured || item.rarity === 'legendary') {
    const marker = new Text({
      text: item.rarity === 'legendary' ? '✦' : '•',
      style: {
        fill: '#ffe3a2',
        fontFamily: 'Georgia',
        fontSize: Math.max(14, radius * 0.55),
        stroke: { color: '#462510', width: 3 },
      },
    });
    marker.anchor.set(0.5);
    marker.position.set(radius * 0.75, -radius * 0.72);
    marker.alpha = 0.78;
    marker.zIndex = 5;
    container.addChild(marker);
  }

  if (caustic) {
    container.addChild(castShadow, shadow, glow, occlusion, sprite, textureOverlay, caustic, glint, core, ring);
  } else {
    container.addChild(castShadow, shadow, glow, occlusion, sprite, textureOverlay, glint, core, ring);
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
    textureOverlay,
    core,
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

  visual.container.alpha = visible ? 1 : 0.17;
  visual.glow.alpha = visible ? visual.baseGlowAlpha : 0.02;
  visual.sprite.alpha = visible ? (selected ? 1 : 0.94) : 0.28;
  visual.textureOverlay.alpha = visible ? (selected ? 0.26 : 0.2) : 0.06;
  visual.depthScale = depthScale;

  const emphasis = selected ? 1.16 : hovered ? 1.07 : 1;
  visual.container.scale.set(emphasis * depthScale);
  visual.shadow.scale.set(0.95 * depthScale, 0.95);
  visual.castShadow.scale.set(1 + (selected ? 0.1 : 0), 1 + (hovered ? 0.06 : 0));

  visual.ring.clear();
  if (selected || hovered || (featuredMode && featured)) {
    visual.ring
      .circle(0, 0, visual.radius * 1.1)
      .stroke({ color: selected ? 0xffeead : 0x8ccfd3, width: selected ? 2.6 : 1.4, alpha: 0.8 });
  }

  if (!reducedMotion && hovered) {
    visual.glow.rotation += 0.01;
    visual.sprite.rotation += 0.006;
  }

  const shimmerBase = selected ? 0.22 : hovered ? 0.18 : 0.08;
  const shimmerWave = reducedMotion ? 0.7 : 0.75 + 0.25 * Math.sin(time * 2 + visual.phase);
  visual.glint.alpha = visible ? shimmerBase * shimmerWave : 0.02;
  visual.glint.x = reducedMotion ? 0 : Math.sin(time * 1.5 + visual.phase) * (visual.radius * 0.14);
  visual.textureOverlay.rotation = reducedMotion ? 0 : Math.sin(time * 0.4 + visual.phase * 0.6) * 0.03;

  if (visual.caustic) {
    const causticWave = reducedMotion ? 0.75 : 0.68 + 0.32 * Math.sin(time * 1.2 + visual.phase * 1.2);
    visual.caustic.alpha = visible ? causticWave * (selected ? 0.22 : 0.15) : 0.03;
    visual.caustic.rotation = -0.32 + (reducedMotion ? 0 : Math.sin(time * 0.8 + visual.phase) * 0.08);
  }

  visual.occlusion.alpha = visible ? (selected ? 0.06 : 0.1) : 0.03;

  if (featuredMode && !featured) {
    visual.container.alpha *= 0.5;
  }
};
