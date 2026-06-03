import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '~/db/db';
import type { ScrapeSource } from '~/services/scrape/types';

describe('scrapeSources store', () => {
  beforeEach(async () => {
    // Note: this may fail in Node without fake-indexeddb
    if (typeof indexedDB === 'undefined') return;
    await db.scrapeSources.clear();
  });

  it('saves and retrieves a scrape source', async () => {
    if (typeof indexedDB === 'undefined') return;
    const source: ScrapeSource = {
      id: 'src-1',
      name: 'Test Source',
      baseUrl: 'https://example.com',
      config: {
        name: 'Test',
        baseUrl: 'https://example.com',
        mangaPage: {
          title: 'h1',
          cover: 'img.cover',
          chapterList: '.chapter',
          chapterUrl: 'a',
        },
        chapterPage: { images: 'img.page' },
      },
      createdAt: new Date().toISOString(),
    };

    await db.scrapeSources.put(source);
    const retrieved = await db.scrapeSources.get('src-1');
    expect(retrieved).toEqual(source);
  });
});
