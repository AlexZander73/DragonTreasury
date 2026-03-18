import { CATEGORIES, RARITIES, SIZE_CLASSES, STATUSES, TREASURE_TYPES, type HoardItem } from '../types/content';

const categorySet = new Set(CATEGORIES);
const raritySet = new Set(RARITIES);
const statusSet = new Set(STATUSES);
const typeSet = new Set(TREASURE_TYPES);
const sizeClassSet = new Set(SIZE_CLASSES);

export const validateHoardItems = (items: HoardItem[]): HoardItem[] => {
  return items.filter((item) => {
    return (
      typeof item.id === 'string' &&
      item.id.length > 0 &&
      typeSet.has(item.type) &&
      categorySet.has(item.category) &&
      raritySet.has(item.rarity) &&
      statusSet.has(item.status) &&
      sizeClassSet.has(item.physics.sizeClass)
    );
  });
};
