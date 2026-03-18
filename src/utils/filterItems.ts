import type { HoardItem } from '../types/content';
import type { FilterState } from '../types/filters';

const normalize = (value: string): string => value.toLowerCase().trim();

export const filterItems = (items: HoardItem[], filter: FilterState): HoardItem[] => {
  const query = normalize(filter.query);
  const tagQuery = normalize(filter.tagQuery);

  return items.filter((item) => {
    if (item.year < filter.yearFrom || item.year > filter.yearTo) {
      return false;
    }

    if (filter.featuredOnly && !item.featured) {
      return false;
    }

    if (filter.categories.length > 0 && !filter.categories.includes(item.category)) {
      return false;
    }

    if (filter.rarities.length > 0 && !filter.rarities.includes(item.rarity)) {
      return false;
    }

    if (query.length > 0) {
      const blob = [
        item.title,
        item.shortSummary,
        item.longDescription,
        item.category,
        item.type,
        item.status,
        ...item.tags,
        ...item.techStack,
      ]
        .join(' ')
        .toLowerCase();

      if (!blob.includes(query)) {
        return false;
      }
    }

    if (tagQuery.length > 0) {
      const tagsJoined = item.tags.join(' ').toLowerCase();
      if (!tagsJoined.includes(tagQuery)) {
        return false;
      }
    }

    return true;
  });
};

export const deriveYearRange = (items: HoardItem[]): { min: number; max: number } => {
  const years = items.map((item) => item.year);
  return {
    min: Math.min(...years),
    max: Math.max(...years),
  };
};
