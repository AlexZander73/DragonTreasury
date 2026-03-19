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
  tiny: 0.65,
  small: 1.2,
  medium: 2.1,
  large: 3.2,
  huge: 5.1,
};

const typeBounciness: Record<TreasureType, number> = {
  coin: 0.22,
  gem: 0.24,
  artifact: 0.1,
  'legendary-relic': 0.07,
  'cursed-item': 0.13,
  'metal-idol': 0.05,
  'arcane-crystal': 0.2,
  'scroll-capsule': 0.08,
};

const typeFriction: Record<TreasureType, number> = {
  coin: 0.09,
  gem: 0.08,
  artifact: 0.15,
  'legendary-relic': 0.18,
  'cursed-item': 0.16,
  'metal-idol': 0.24,
  'arcane-crystal': 0.11,
  'scroll-capsule': 0.22,
};

const rarityMassMult: Record<Rarity, number> = {
  common: 0.95,
  uncommon: 1,
  rare: 1.18,
  epic: 1.34,
  legendary: 1.54,
};

const typeAirDrag: Record<TreasureType, number> = {
  coin: 0.05,
  gem: 0.045,
  artifact: 0.055,
  'legendary-relic': 0.06,
  'cursed-item': 0.055,
  'metal-idol': 0.068,
  'arcane-crystal': 0.05,
  'scroll-capsule': 0.064,
};

export const buildPhysicsProfile = (type: TreasureType, rarity: Rarity, sizeOverride?: SizeClass): PhysicsProfile => {
  const sizeClass = sizeOverride ?? rarityScaleToSize[rarity];
  const mass = baseMassBySize[sizeClass] * rarityMassMult[rarity];

  return {
    mass,
    sizeClass,
    restitution: typeBounciness[type],
    friction: typeFriction[type],
    frictionAir: typeAirDrag[type],
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
