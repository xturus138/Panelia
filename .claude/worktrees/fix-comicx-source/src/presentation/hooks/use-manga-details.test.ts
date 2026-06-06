import { describe, expect, it } from 'vitest';
import { useMangaDetailsViewModel } from '~/presentation/hooks/use-manga-details';

describe('useMangaDetailsViewModel', () => {
  it('exports a hook function', () => {
    expect(typeof useMangaDetailsViewModel).toBe('function');
  });
});