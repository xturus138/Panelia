// src/services/scrape/scrapeAdapter.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ScrapeAdapter } from './scrapeAdapter';
import type { SiteConfig } from './types';

const fixtureHtml = readFileSync(
  join(__dirname, '__fixtures__/sample-page.html'),
  'utf-8'
);
const fixtureConfig: SiteConfig = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__/sample-config.json'), 'utf-8')
);
const fixtureChapterHtml = readFileSync(
  join(__dirname, '__fixtures__/sample-chapter.html'), 'utf-8'
);

describe('ScrapeAdapter', () => {
  describe('parseMangaPage', () => {
    it('extracts title, cover, and chapters from HTML', () => {
      const adapter = new ScrapeAdapter('src-1', fixtureConfig, 'https://example.com/manga/one-piece');
      const result = adapter.parseMangaPage(fixtureHtml);

      expect(result.title).toBe('One Piece');
      expect(result.coverUrl).toBe('https://example.com/covers/one-piece.jpg');
      expect(result.chapters).toHaveLength(2);
      expect(result.chapters[0].title).toContain('Chapter');
    });

    it('generates stable ids for manga and chapters based on URL', () => {
      const adapter = new ScrapeAdapter('src-1', fixtureConfig, 'https://example.com/manga/one-piece');
      const result = adapter.parseMangaPage(fixtureHtml);

      expect(result.id).toMatch(/^src-1:/);
      expect(result.chapters[0].id).toMatch(/^src-1:/);
    });
  });

  describe('parseChapterPage', () => {
    it('extracts page image URLs in order', () => {
      const adapter = new ScrapeAdapter('src-1', fixtureConfig, 'https://example.com/manga/one-piece');
      const pages = adapter.parseChapterPage(fixtureChapterHtml);

      expect(pages).toHaveLength(3);
      expect(pages[0].imageUrl).toBe('https://example.com/pages/1.jpg');
      expect(pages[0].index).toBe(0);
      expect(pages[2].index).toBe(2);
    });
  });

  describe('resolveUrl', () => {
    it('resolves relative URLs against the base URL', () => {
      const adapter = new ScrapeAdapter('src-1', fixtureConfig, 'https://example.com/manga/one-piece');
      const resolved = adapter.resolveUrl('/manga/one-piece/chapter-1');
      expect(resolved).toBe('https://example.com/manga/one-piece/chapter-1');
    });

    it('passes through absolute URLs unchanged', () => {
      const adapter = new ScrapeAdapter('src-1', fixtureConfig, 'https://example.com/manga/one-piece');
      const resolved = adapter.resolveUrl('https://other.com/page');
      expect(resolved).toBe('https://other.com/page');
    });
  });
});
