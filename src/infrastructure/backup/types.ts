import { Manga, Chapter, LibraryEntry, Category, ReadProgress, AppSettings, DownloadedChapter } from '~/types';
import { ScrapeSource } from '~/services/scrape/types';

export interface BackupMeta {
  version: number;       // 1, 2, 3... for migrations
  exportedAt: string;    // ISO timestamp
  appVersion: string;    // e.g. "0.1.0"
  exportedBy: 'file';    // | 'firebase' (future)
}

export interface BackupData {
  meta: BackupMeta;
  data: {
    manga: Manga[];
    chapters: Chapter[];
    libraryEntries: LibraryEntry[];
    categories: Category[];
    readProgress: ReadProgress[];
    downloadedChapters: DownloadedChapter[];
    scrapeSources: ScrapeSource[];
    settings: AppSettings;
  };
}

export type ImportMode = 'replace' | 'merge';
export type BackupAdapter = 'file' | 'firebase';
export interface ValidationResult { valid: boolean; errors: string[]; }
