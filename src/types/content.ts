export const TREASURE_TYPES = [
  'coin',
  'gem',
  'artifact',
  'legendary-relic',
  'cursed-item',
  'metal-idol',
  'arcane-crystal',
  'scroll-capsule',
] as const;

export const CATEGORIES = [
  'products',
  'projects',
  'experiments',
  'systems',
  'notes',
  'relics',
  'prototypes',
  'abandoned',
  'favorite',
  'physical-builds',
  'ai-tools',
] as const;

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

export const STATUSES = ['shipped', 'in-progress', 'prototype', 'archived', 'paused', 'abandoned'] as const;

export const SIZE_CLASSES = ['tiny', 'small', 'medium', 'large', 'huge'] as const;

export type TreasureType = (typeof TREASURE_TYPES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Rarity = (typeof RARITIES)[number];
export type Status = (typeof STATUSES)[number];
export type SizeClass = (typeof SIZE_CLASSES)[number];

export interface ContentLink {
  label: string;
  url: string;
  kind?: 'repo' | 'live' | 'doc' | 'video' | 'other';
}

export interface ContentImage {
  src: string;
  alt: string;
  caption?: string;
}

export interface PhysicsProfile {
  mass: number;
  restitution: number;
  friction: number;
  frictionAir?: number;
  sizeClass: SizeClass;
}

export interface HoardItem {
  id: string;
  title: string;
  shortSummary: string;
  longDescription: string;
  type: TreasureType;
  category: Category;
  rarity: Rarity;
  status: Status;
  year: number;
  tags: string[];
  techStack: string[];
  links: ContentLink[];
  images?: ContentImage[];
  repoUrl?: string;
  liveUrl?: string;
  notes?: string;
  whyItMatters?: string;
  visualHint?: string;
  physics: PhysicsProfile;
  dragonAffinity?: number;
  featured?: boolean;
  hiddenUntilUnlocked?: boolean;
}
