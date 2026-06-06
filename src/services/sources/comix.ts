import type { Manga, Chapter, Page, SourceProvider } from '~/types';

const COMIX_API = 'https://comix.to/api/v1';
const PROXY_PREFIX = '/api/proxy?url=';

interface ComixManga {
  id: number;
  hid: string;
  title: string;
  poster: {
    medium: string;
    large: string;
  };
  type: string;
  status: string;
  synopsis: string;
  authors?: { title: string }[];
  genres?: { title: string }[];
  tags?: { title: string }[];
  links?: Record<string, string>;
}

interface ComixChapter {
  id: number;
  hid: string;
  title: string;
  chapter: string;
  volume: string;
  updated_at: string;
}

interface ComixResponse<T> {
  status: string;
  result: T;
}

interface ComixPaginated<T> {
  items: T[];
}

export class ComixProvider implements SourceProvider {
  private async fetchJson<T>(url: string): Promise<T> {
    const proxyUrl = `${PROXY_PREFIX}${encodeURIComponent(url)}`;
    console.log('[ComixProvider] fetchJson proxyUrl:', proxyUrl);
    const response = await fetch(proxyUrl);
    console.log('[ComixProvider] fetchJson response status:', response.status);
    if (!response.ok) {
      let errMsg = `Comix API error: ${response.status}`;
      try {
        const body = await response.json();
        if (body.message) errMsg += ` (${body.message})`;
      } catch {
        // ignore parse errors
      }
      throw new Error(errMsg);
    }
    const data = await response.json();
    console.log('[ComixProvider] fetchJson data keys:', Object.keys(data || {}));
    return data;
  }

  async getPopular(page: number = 1): Promise<Manga[]> {
    const url = `${COMIX_API}/manga?page=${page}&limit=28&order[views_7d]=desc&content_rating=suggestive&types[]=manhwa&types[]=manhua`;
    console.log('[ComixProvider] getPopular url:', url);
    const data = await this.fetchJson<ComixResponse<ComixPaginated<ComixManga>>>(url);
    console.log('[ComixProvider] getPopular result:', data);
    const items = data.result?.items || [];
    console.log('[ComixProvider] items count:', items.length);
    return this.mapMangaList(items);
  }

  async getLatest(page: number = 1): Promise<Manga[]> {
    const data = await this.fetchJson<ComixResponse<ComixPaginated<ComixManga>>>(
      `${COMIX_API}/manga?page=${page}&limit=28&order[chapter_updated_at]=desc`
    );
    return this.mapMangaList(data.result.items);
  }

  async search(query: string, page: number = 1): Promise<Manga[]> {
    const url = `${COMIX_API}/manga?page=${page}&limit=28&q=${encodeURIComponent(query)}`;
    console.log('[ComixProvider] search url:', url);
    const data = await this.fetchJson<ComixResponse<ComixPaginated<ComixManga>>>(url);
    console.log('[ComixProvider] search result:', data);
    const items = data.result?.items || [];
    console.log('[ComixProvider] items count:', items.length);
    return this.mapMangaList(items);
  }

  async getMangaDetails(id: string): Promise<Manga> {
    const data = await this.fetchJson<ComixResponse<ComixManga>>(`${COMIX_API}/manga/${id}`);
    return this.mapManga(data.result);
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    const data = await this.fetchJson<ComixResponse<ComixChapter[] | ComixPaginated<ComixChapter>>>(
      `${COMIX_API}/manga/${mangaId}/chapters?page=1&limit=500`
    );

    const items = Array.isArray(data.result) ? data.result : data.result.items;

    return items.map((ch) => ({
      id: ch.hid,
      mangaId,
      chapterNumber: parseFloat(ch.chapter) || 0,
      title: ch.title || `Chapter ${ch.chapter}`,
      scanlator: 'Comix',
      releaseDate: ch.updated_at,
      pageCount: 0,
      read: false,
      lastReadPage: 0,
      status: 'unread' as const,
      url: `https://comix.to/title/${mangaId}/${ch.hid}`,
    }));
  }

  async getPages(chapterId: string): Promise<Page[]> {
    const data = await this.fetchJson<any>(`${COMIX_API}/chapter/${chapterId}`);
    return (data.result.images || []).map((url: string, index: number) => ({
      index,
      imageUrl: url,
    }));
  }

  private mapMangaList(items: ComixManga[]): Manga[] {
    return items.map((item) => this.mapManga(item));
  }

  private mapManga(item: ComixManga): Manga {
    return {
      id: item.hid,
      sourceId: 'comix',
      title: item.title,
      coverUrl: item.poster?.medium || item.poster?.large || '',
      author: item.authors?.map((a) => a.title).join(', ') || 'Unknown',
      artist: 'Unknown',
      status: this.mapStatus(item.status),
      description: item.synopsis || '',
      genres: item.genres?.map((g) => g.title) || [],
      tags: item.tags?.map((t) => t.title) || [],
      url: `https://comix.to/title/${item.hid}`,
    };
  }

  private mapStatus(status: string): Manga['status'] {
    const statusMap: Record<string, Manga['status']> = {
      releasing: 'ongoing',
      completed: 'completed',
      on_hiatus: 'hiatus',
      cancelled: 'cancelled',
    };
    return statusMap[status?.toLowerCase()] || 'unknown';
  }
}

export const comixProvider = new ComixProvider();
