export interface LibraryEntry {
  mangaId: string;
  categories: string[];
  dateAdded: string;
  unreadCount: number;
  lastChapterRead?: number;
  lastReadDate?: string;
  lastViewedAt?: string;
  lastViewedChapterId?: string;
  lastViewedPage?: number;
  viewedCount?: number;
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
