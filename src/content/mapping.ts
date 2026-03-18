import type { Category, HoardItem, PhysicsProfile, Rarity, SizeClass, TreasureType } from '../types/content';

export const categoryToTreasureType: Record<Category, TreasureType> = {
  products: 'gem',
  projects: 'artifact',
  experiments: 'coin',
  systems: 'arcane-crystal',
  notes: 'scroll-capsule',
  relics: 'legendary-relic',
  prototypes: 'metal-idol',
  abandoned: 'cursed-item',
  favorite: 'legendary-relic',
  'physical-builds': 'metal-idol',
  'ai-tools': 'arcane-crystal',
};

const rarityScaleToSize: Record<Rarity, SizeClass> = {
  common: 'small',
  uncommon: 'small',
  rare: 'medium',
  epic: 'large',
  legendary: 'huge',
};

const baseMassBySize: Record<SizeClass, number> = {
  tiny: 0.4,
  small: 0.8,
  medium: 1.5,
  large: 2.2,
  huge: 3.6,
};

const typeBounciness: Record<TreasureType, number> = {
  coin: 0.38,
  gem: 0.3,
  artifact: 0.18,
  'legendary-relic': 0.14,
  'cursed-item': 0.22,
  'metal-idol': 0.09,
  'arcane-crystal': 0.28,
  'scroll-capsule': 0.2,
};

const typeFriction: Record<TreasureType, number> = {
  coin: 0.025,
  gem: 0.04,
  artifact: 0.08,
  'legendary-relic': 0.1,
  'cursed-item': 0.09,
  'metal-idol': 0.12,
  'arcane-crystal': 0.07,
  'scroll-capsule': 0.11,
};

const rarityMassMult: Record<Rarity, number> = {
  common: 0.9,
  uncommon: 1,
  rare: 1.15,
  epic: 1.28,
  legendary: 1.45,
};

export const buildPhysicsProfile = (type: TreasureType, rarity: Rarity, sizeOverride?: SizeClass): PhysicsProfile => {
  const sizeClass = sizeOverride ?? rarityScaleToSize[rarity];
  const mass = baseMassBySize[sizeClass] * rarityMassMult[rarity];

  return {
    mass,
    sizeClass,
    restitution: typeBounciness[type],
    friction: typeFriction[type],
    frictionAir: type === 'coin' ? 0.015 : 0.03,
  };
};

export const createDefaultItem = (
  partial: Omit<HoardItem, 'type' | 'physics'> & { type?: TreasureType; physics?: Partial<PhysicsProfile> },
): HoardItem => {
  const type = partial.type ?? categoryToTreasureType[partial.category];
  const basePhysics = buildPhysicsProfile(type, partial.rarity);

  return {
    ...partial,
    type,
    physics: {
      ...basePhysics,
      ...(partial.physics ?? {}),
    },
  };
};
