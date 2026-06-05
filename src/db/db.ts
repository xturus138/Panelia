import Dexie, { type EntityTable } from 'dexie';
import type { Manga, Chapter, LibraryEntry, Category, ReadProgress, AppSettings, DownloadedChapter } from '~/types';
import type { ScrapeSource } from '~/services/scrape/types';

class PaneliaDB extends Dexie {
  manga!: EntityTable<Manga, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  libraryEntries!: EntityTable<LibraryEntry, 'mangaId'>;
  categories!: EntityTable<Category, 'id'>;
  readProgress!: EntityTable<ReadProgress, 'chapterId'>;
  settings!: EntityTable<AppSettings, 'theme'>;
  downloadedChapters!: EntityTable<DownloadedChapter, 'id'>;
  scrapeSources!: EntityTable<ScrapeSource, 'id'>;

  constructor() {
    super('panelia-db');
    this.version(1).stores({
      manga: 'id, sourceId, title',
      chapters: 'id, mangaId, chapterNumber',
      libraryEntries: 'mangaId, *categories',
      categories: 'id, sortOrder',
      readProgress: 'chapterId, mangaId, lastReadAt',
      settings: 'theme',
      downloadedChapters: 'id, chapterId, mangaId',
    });
    // v2: add scrapeSources
    this.version(2).stores({
      scrapeSources: 'id, baseUrl, createdAt',
    });
    // v3: add status/viewed tracking fields to chapters and libraryEntries
    this.version(3).stores({
      chapters: 'id, mangaId, chapterNumber, status',
      libraryEntries: 'mangaId, *categories, lastViewedAt',
    });
  }
}

export const db = new PaneliaDB();