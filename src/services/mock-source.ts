import type { Manga, Chapter, Page } from '~/types';

export class MockSourceProvider {
  async getPopular(): Promise<Manga[]> {
    const res = await fetch('/demo-data/manga.json');
    return res.json();
  }

  async getLatest(): Promise<Manga[]> {
    const res = await fetch('/demo-data/manga.json');
    return res.json();
  }

  async search(query: string): Promise<Manga[]> {
    const manga = await this.getPopular();
    return manga.filter(m => m.title.toLowerCase().includes(query.toLowerCase()));
  }

  async getMangaDetails(id: string): Promise<Manga> {
    const mangaList = await this.getPopular();
    const manga = mangaList.find(m => m.id === id);
    if (!manga) throw new Error('Manga not found');
    return manga;
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    const res = await fetch('/demo-data/chapters.json');
    const data = await res.json();
    return data[mangaId] || [];
  }

  async getPages(chapterId: string): Promise<Page[]> {
    // Generate placeholder pages for testing reader
    return Array.from({ length: 5 }).map((_, i) => ({
      index: i,
      imageUrl: `https://placehold.co/800x1200/1a1a1a/cccccc?text=Page+${i + 1}`,
    }));
  }
}

export const mockSource = new MockSourceProvider();