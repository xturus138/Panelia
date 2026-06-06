import type { Manga, Chapter, Page } from '~/domain/types';

export interface SourceProvider {
  readonly id: string;
  readonly name: string;
  getPopular(page: number): Promise<Manga[]>;
  getLatest(page: number): Promise<Manga[]>;
  search(query: string, page: number): Promise<Manga[]>;
  getMangaDetails(id: string): Promise<Manga>;
  getChapters(mangaId: string): Promise<Chapter[]>;
  getPages(chapterId: string): Promise<Page[]>;
}
