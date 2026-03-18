import type { Category, Rarity } from './content';

export type ArrangeMode = 'pile' | 'timeline' | 'category' | 'era';

export interface FilterState {
  query: string;
  categories: Category[];
  rarities: Rarity[];
  yearFrom: number;
  yearTo: number;
  featuredOnly: boolean;
  tagQuery: string;
}
