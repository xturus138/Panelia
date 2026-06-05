import { describe, expect, it } from 'vitest';
import { useReaderChapterViewModel } from '~/presentation/hooks/use-reader-chapter';

describe('useReaderChapterViewModel', () => {
  it('exports a hook function', () => {
    expect(typeof useReaderChapterViewModel).toBe('function');
  });
});