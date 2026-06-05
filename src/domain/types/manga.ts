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

export type ReadStatus = 'unread' | 'viewed' | 'completed';

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
  status: ReadStatus;
  viewedAt?: string;
  completedAt?: string;
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
