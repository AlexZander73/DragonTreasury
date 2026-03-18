import type { SizeClass } from '../types/content';

export const sizeClassToPixels: Record<SizeClass, number> = {
  tiny: 14,
  small: 20,
  medium: 28,
  large: 38,
  huge: 50,
};

export const PHYSICS_LIMITS = {
  maxLinearVelocity: 16,
  centerPull: 0.000075,
  arrangementPull: 0.00016,
  dragTossMultiplier: 0.12,
  floorBounceDamp: 0.88,
};
