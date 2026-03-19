import type { SizeClass } from '../types/content';

export const sizeClassToPixels: Record<SizeClass, number> = {
  tiny: 14,
  small: 20,
  medium: 28,
  large: 38,
  huge: 50,
};

export const PHYSICS_LIMITS = {
  maxLinearVelocity: 12,
  centerPull: 0.00009,
  arrangementPull: 0.00022,
  dragTossMultiplier: 0.1,
  floorBounceDamp: 0.82,
};
