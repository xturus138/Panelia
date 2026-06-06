import { Manga, Chapter, LibraryEntry, Category, ReadProgress, AppSettings, DownloadedChapter } from '~/types';
import { ScrapeSource } from '~/services/scrape/types';

export interface BackupData {
  version: number;
  metadata: {
    createdAt: string;
    appVersion: string;
    device?: string;
  };
  data: {
    manga: Manga[];
    chapters: Chapter[];
    libraryEntries: LibraryEntry[];
    categories: Category[];
    readProgress: ReadProgress[];
    settings: AppSettings;
    downloadedChapters: DownloadedChapter[];
    scrapeSources: ScrapeSource[];
  };
}
