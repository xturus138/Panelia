import { describe, it, expect } from 'vitest';
import { getChaptersByMangaId, saveChapters } from '~/infrastructure/db/chapters';

describe('chapter repository helpers', () => {
  it('is a function', () => {
    expect(typeof getChaptersByMangaId).toBe('function');
    expect(typeof saveChapters).toBe('function');
  });

  // Skipped full integration tests since they require live db and complex mocks
  it.skip('saves and loads chapters by manga id', async () => {});
});
