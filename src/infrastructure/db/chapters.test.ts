import { describe, expect, it } from 'vitest';
import { getChaptersByMangaId, saveChapters } from '~/infrastructure/db/chapters';
import { db } from '~/db/db';

describe('chapter repository helpers', () => {
  it('saves and loads chapters by manga id', async () => {
    const mangaId = 'test:manga';

    await saveChapters([
      {
        id: 'test:chapter:1',
        mangaId,
        chapterNumber: 1,
        title: 'One',
        scanlator: '',
        releaseDate: '',
        pageCount: 0,
        read: false,
        lastReadPage: 0,
        status: 'unread',
      },
    ]);

    const chapters = await getChaptersByMangaId(mangaId);
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.id).toBe('test:chapter:1');

    await db.chapters.delete('test:chapter:1');
  });
});
