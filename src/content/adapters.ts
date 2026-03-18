import type { HoardItem } from '../types/content';
import { validateHoardItems } from '../utils/contentValidation';
import { seedHoardItems } from './seedData';

export interface ContentAdapter {
  id: string;
  load: () => Promise<HoardItem[]>;
}

export class LocalSeedAdapter implements ContentAdapter {
  id = 'local-seed';

  async load(): Promise<HoardItem[]> {
    return validateHoardItems(seedHoardItems);
  }
}

export const loadHoardContent = async (adapter: ContentAdapter = new LocalSeedAdapter()): Promise<HoardItem[]> => {
  const loaded = await adapter.load();
  return validateHoardItems(loaded);
};
