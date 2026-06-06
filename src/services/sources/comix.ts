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
  id = 'comix';
  name = 'Comix';
  private readonly FETCH_LIMIT = 30;

  private async fetchJson<T>(url: string): Promise<T> {
    const referer = encodeURIComponent('https://comix.to/');
    const response = await fetch(`${PROXY_PREFIX}${encodeURIComponent(url)}&referer=${referer}`);
    if (!response.ok) {
      let errMsg = `Comix API error: ${response.status}`;
      try {
        const body = await response.json();
        if (body.message) errMsg += ` (${body.message})`;
        else if (body.detail) errMsg += ` (${body.detail})`;
        else if (body.error) errMsg += ` (${body.error})`;
      } catch {
        // ignore parse errors
      }
      throw new Error(errMsg);
    }
    return response.json();
  }

  private async fetchHtml(url: string): Promise<string> {
    const referer = encodeURIComponent('https://comix.to/');
    const response = await fetch(`${PROXY_PREFIX}${encodeURIComponent(url)}&referer=${referer}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }
    return response.text();
  }

  private extractTokenFromHtml(html: string): string | null {
    // Try to find the token in script tags or as a generated value
    // The token pattern is like: 6DV7EOsbCciMH_BgJDdOp7wtJfg
    const tokenMatch = html.match(/["']([A-Za-z0-9_-]{20,40})["']/g);
    if (tokenMatch) {
      // Look for the specific token format used in API calls
      for (const match of tokenMatch) {
        const token = match.replace(/["']/g, '');
        if (token.length >= 20 && token.length <= 40 && /^[A-Za-z0-9_-]+$/.test(token)) {
          return token;
        }
      }
    }
    return null;
  }

  async getPopular(page: number = 1): Promise<Manga[]> {
    const data = await this.fetchJson<ComixResponse<ComixPaginated<ComixManga>>>(
      `${COMIX_API}/manga?page=${page}&limit=${this.FETCH_LIMIT}&order[views_7d]=desc&content_rating=suggestive&types[]=manhwa&types[]=manhua`
    );
    return this.mapMangaList(data.result?.items || []);
  }

  async getLatest(page: number = 1): Promise<Manga[]> {
    const data = await this.fetchJson<ComixResponse<ComixPaginated<ComixManga>>>(
      `${COMIX_API}/manga?page=${page}&limit=${this.FETCH_LIMIT}&order[chapter_updated_at]=desc`
    );
    return this.mapMangaList(data.result.items);
  }

  async search(query: string, page: number = 1): Promise<Manga[]> {
    const data = await this.fetchJson<ComixResponse<ComixPaginated<ComixManga>>>(
      `${COMIX_API}/manga?page=${page}&limit=${this.FETCH_LIMIT}&q=${encodeURIComponent(query)}`
    );
    return this.mapMangaList(data.result?.items || []);
  }

  async getMangaDetails(id: string): Promise<Manga> {
    const data = await this.fetchJson<ComixResponse<ComixManga>>(`${COMIX_API}/manga/${id}`);
    return this.mapManga(data.result);
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    // Comix.to API requires a Cloudflare-generated token for chapter endpoints
    // This token is generated client-side and cannot be easily replicated server-side
    // As a workaround, we try to fetch chapters but may fail with 403

    try {
      const data = await this.fetchJson<ComixResponse<ComixChapter[] | ComixPaginated<ComixChapter>>>(
        `${COMIX_API}/manga/${mangaId}/chapters?page=1&limit=100`
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
    } catch (err) {
      // Comix API returns 403 for chapter endpoints without proper token
      // Throw error with clear message for UI to handle
      throw new Error('COMIX_CHAPTERS_UNAVAILABLE');
    }
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
