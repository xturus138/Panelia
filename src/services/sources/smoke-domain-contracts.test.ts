import { describe, expect, it } from 'vitest';
import type { Manga, Chapter, AppSettings } from '~/domain/types';
import type { SourceProvider } from '~/domain/interfaces';
import type { Manga as CompatManga, Chapter as CompatChapter, AppSettings as CompatSettings } from '~/types';

describe('domain contract entrypoints', () => {
  it('exposes domain types and source provider contract from new paths', () => {
    const manga: Manga = {
      id: 'mangadex:1',
      sourceId: 'mangadex',
      title: 'Test',
      coverUrl: 'https://example.com/cover.jpg',
      author: 'Author',
      artist: 'Artist',
      status: 'ongoing',
      description: 'Desc',
      genres: [],
      tags: [],
    };

    const chapter: Chapter = {
      id: 'mangadex:ch:1',
      mangaId: manga.id,
      chapterNumber: 1,
      title: 'Chapter 1',
      scanlator: '',
      releaseDate: '',
      pageCount: 0,
      read: false,
      lastReadPage: 0,
      status: 'unread',
    };

    const settings: AppSettings = {
      theme: 'dark',
      readerMode: 'webtoon',
      readingDirection: 'ltr',
      pageFitMode: 'fit-width',
      libraryViewMode: 'grid',
      brightness: 100,
      languageFilter: 'all',
      showNsfw: false,
    };

    const providerShape = {
      getPopular: async (_page: number) => [manga],
      getLatest: async (_page: number) => [manga],
      search: async (_query: string, _page: number) => [manga],
      getMangaDetails: async (_id: string) => manga,
      getChapters: async (_id: string) => [chapter],
      getPages: async (_id: string) => [],
    } satisfies SourceProvider;

    expect(manga.title).toBe('Test');
    expect(settings.readerMode).toBe('webtoon');
    expect(typeof providerShape.getPopular).toBe('function');
  });

  it('exposes types from compatibility barrel (~/types)', () => {
    const compatManga: CompatManga = {
      id: 'compat:1',
      sourceId: 'compat',
      title: 'Compat Test',
      coverUrl: 'https://example.com/cover.jpg',
      author: 'Author',
      artist: 'Artist',
      status: 'ongoing',
      description: 'Desc',
      genres: [],
      tags: [],
    };

    const compatChapter: CompatChapter = {
      id: 'compat:ch:1',
      mangaId: compatManga.id,
      chapterNumber: 1,
      title: 'Chapter 1',
      scanlator: '',
      releaseDate: '',
      pageCount: 0,
      read: false,
      lastReadPage: 0,
      status: 'unread',
    };

    const compatSettings: CompatSettings = {
      theme: 'light',
      readerMode: 'paged',
      readingDirection: 'rtl',
      pageFitMode: 'fit-height',
      libraryViewMode: 'list',
      brightness: 100,
      languageFilter: 'all',
      showNsfw: false,
    };

    expect(compatManga.title).toBe('Compat Test');
    expect(compatSettings.readerMode).toBe('paged');
    expect(compatChapter.chapterNumber).toBe(1);
  });
});