export interface Manga {
  id: string;
  sourceId: string;
  title: string;
  coverUrl: string;
  author: string;
  artist: string;
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'unknown';
  description: string;
  genres: string[];
  tags: string[];
  thumbnailUrl?: string;
  url?: string;
}

export interface Chapter {
  id: string;
  mangaId: string;
  chapterNumber: number;
  title: string;
  scanlator: string;
  releaseDate: string;
  pageCount: number;
  read: boolean;
  lastReadPage: number;
  url?: string;
}

export interface Page {
  index: number;
  imageUrl: string;
  width?: number;
  height?: number;
}

export interface Source {
  id: string;
  name: string;
  baseUrl: string;
  iconUrl: string;
  isInstalled: boolean;
  isNsfw: boolean;
  version: number;
  languages: string[];
}

export interface LibraryEntry {
  mangaId: string;
  categories: string[];
  dateAdded: string;
  unreadCount: number;
  lastChapterRead?: number;
  lastReadDate?: string;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ReadProgress {
  chapterId: string;
  mangaId: string;
  lastPage: number;
  totalPages: number;
  completed: boolean;
  lastReadAt: string;
}

export interface DownloadedChapter {
  id: string;
  chapterId: string;
  mangaId: string;
  pages: Array<{ index: number; blobUrl: string }>;
  downloadedAt: string;
  sizeBytes: number;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  readerMode: 'vertical-scroll' | 'webtoon' | 'single-page' | 'double-page';
  readingDirection: 'rtl' | 'ltr';
  pageFitMode: 'fit-width' | 'fit-height' | 'original' | 'auto';
  libraryViewMode: 'grid' | 'list';
  brightness: number; // 0-100
  languageFilter: string;
  showNsfw: boolean;
}

export interface SourceProvider {
  getPopular(page: number): Promise<Manga[]>;
  getLatest(page: number): Promise<Manga[]>;
  search(query: string, page: number): Promise<Manga[]>;
  getMangaDetails(id: string): Promise<Manga>;
  getChapters(mangaId: string): Promise<Chapter[]>;
  getPages(chapterId: string): Promise<Page[]>;
}