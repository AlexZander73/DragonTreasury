import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { HoardItem, Rarity } from '../types/content';
import { sizeClassToPixels } from '../physics/physicsConfig';
import { withBase } from '../utils/basePath';
import { rarityWeight } from '../utils/rarityStyles';

const rarityColor: Record<Rarity, number> = {
  common: 0xb39670,
  uncommon: 0x7abb89,
  rare: 0x5b8de3,
  epic: 0xa36ae6,
  legendary: 0xf2bf5a,
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
  glow: Graphics;
  sprite: Sprite;
  core: Graphics;
  ring: Graphics;
  radius: number;
  baseGlowAlpha: number;
}

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
  shadow.ellipse(0, radius * 0.65, radius * 0.95, radius * 0.38).fill({ color: 0x000000, alpha: 0.2 });
  shadow.zIndex = 0;

  const glow = new Graphics();
  const baseGlowAlpha = 0.08 + rarityWeight[item.rarity] * 0.05;
  glow.circle(0, 0, radius * (1.3 + rarityWeight[item.rarity] * 0.12)).fill({
    color,
    alpha: baseGlowAlpha,
  });
  glow.zIndex = 1;

  const sprite = Sprite.from(withBase(`/assets/treasure/${item.type}.svg`));
  const spriteScale = spriteScaleByType[item.type];
  sprite.anchor.set(0.5);
  sprite.width = radius * spriteScale.width;
  sprite.height = radius * spriteScale.height;
  sprite.alpha = 0.94;
  sprite.zIndex = 2;

  const core = new Graphics();
  drawTypeShape(core, item, radius, color);
  core.alpha = 0.24;
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

  container.addChild(shadow, glow, sprite, core, ring);

  return {
    container,
    shadow,
    glow,
    sprite,
    core,
    ring,
    radius,
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
  },
): void => {
  const { selected, hovered, visible, featuredMode, featured, reducedMotion } = options;

  visual.container.alpha = visible ? 1 : 0.17;
  visual.glow.alpha = visible ? visual.baseGlowAlpha : 0.02;
  visual.sprite.alpha = visible ? (selected ? 1 : 0.94) : 0.28;

  const emphasis = selected ? 1.16 : hovered ? 1.07 : 1;
  visual.container.scale.set(emphasis);

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

  if (featuredMode && !featured) {
    visual.container.alpha *= 0.5;
  }
};
