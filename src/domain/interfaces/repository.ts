import type { Chapter, LibraryEntry, Manga, ReadProgress, DownloadedChapter, AppSettings } from '~/domain/types';
import type { ScrapeSource } from '~/services/scrape/types';

export interface MangaRepository {
  getById(id: string): Promise<Manga | undefined>;
  save(manga: Manga): Promise<void>;
}

export interface ChapterRepository {
  getByMangaId(mangaId: string): Promise<Chapter[]>;
  getById(id: string): Promise<Chapter | undefined>;
  saveMany(chapters: Chapter[]): Promise<void>;
}

export interface LibraryRepository {
  getEntry(mangaId: string): Promise<LibraryEntry | undefined>;
  saveEntry(entry: LibraryEntry): Promise<void>;
  deleteEntry(mangaId: string): Promise<void>;
}

export interface ReadProgressRepository {
  save(progress: ReadProgress): Promise<void>;
}

export interface DownloadedChapterRepository {
  deleteByMangaId(mangaId: string): Promise<void>;
}

export interface ScrapeSourceRepository {
  getById(id: string): Promise<ScrapeSource | undefined>;
  save(source: ScrapeSource): Promise<void>;
}

export interface SettingsRepository {
  save(settings: AppSettings): Promise<void>;
}
