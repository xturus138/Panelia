import type { Manga, Chapter, Page, SourceProvider } from '~/types';

const COMICK_API = 'https://api.comick.app';
const PROXY_PREFIX = '/api/proxy?url=';

interface ComickManga {
  slug: string;
  hid: string;
  title: string;
  cover_url?: string;
  last_up: number;
}

interface ComickSearchResult {
  slug: string;
  hid: string;
  title: string;
}

interface ComickMangaDetails {
  title: string;
  cover_url: string;
  authors: { name: string }[];
  description: string;
  genres: string[];
  status: string;
  md_covers: { b2key: string; url: string }[];
}

interface ComickPages {
  chapter: {
    md_images: { b2key: string; w: number; h: number }[];
  };
}

export class ComickProvider implements SourceProvider {
  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      let errMsg = `Comick API error: ${response.status}`;
      try {
        const body = await response.json();
        if (body.detail) errMsg += ` (${body.detail})`;
        else if (body.error) errMsg += ` (${body.error})`;
      } catch {
        // ignore parse errors
      }
      throw new Error(errMsg);
    }
    return response.json();
  }

  async getPopular(page: number = 0): Promise<Manga[]> {
    const limit = 20
    const offset = page * limit
    const data = await this.fetchJson<ComickManga[]>(
      `${PROXY_PREFIX}${encodeURIComponent(`${COMICK_API}/top?comic_types=manga&page=${Math.floor(offset / limit) + 1}&limit=${limit}`)}`
    )
    return this.mapMangaList(data)
  }

  async getLatest(page: number = 0): Promise<Manga[]> {
    const limit = 20
    const offset = page * limit
    const data = await this.fetchJson<ComickSearchResult[]>(
      `${PROXY_PREFIX}${encodeURIComponent(`${COMICK_API}/search/?q=&page=${Math.floor(offset / limit) + 1}&limit=${limit}&st=s`)}`
    )
    return this.fetchMangaDetails(data)
  }

  async search(query: string, page: number = 0): Promise<Manga[]> {
    const limit = 20
    const offset = page * limit
    const data = await this.fetchJson<ComickSearchResult[]>(
      `${PROXY_PREFIX}${encodeURIComponent(`${COMICK_API}/v1.0/search/?q=${encodeURIComponent(query)}&page=${Math.floor(offset / limit) + 1}&limit=${limit}`)}`
    )
    return this.fetchMangaDetails(data)
  }

  private async fetchMangaDetails(items: ComickSearchResult[]): Promise<Manga[]> {
    const mangaPromises = items.map(async (item) => {
      try {
        const details = await this.fetchJson<ComickMangaDetails>(
          `${PROXY_PREFIX}${encodeURIComponent(`${COMICK_API}/comic/${item.slug}`)}`
        )
        return this.mapManga(details, item.hid)
      } catch {
        return null
      }
    })

    const results = await Promise.all(mangaPromises)
    return results.filter((m): m is Manga => m !== null)
  }

  private mapMangaList(items: ComickManga[]): Manga[] {
    return items.map((item) => ({
      id: item.hid,
      sourceId: 'comick',
      title: item.title,
      coverUrl: item.cover_url || '',
      author: 'Unknown',
      artist: 'Unknown',
      status: 'ongoing' as const,
      description: '',
      genres: [],
      tags: [],
      url: `https://comick.app/comic/${item.slug}`,
    }))
  }

  private mapManga(details: ComickMangaDetails, hid: string): Manga {
    const cover = details.md_covers?.[0]
    return {
      id: hid,
      sourceId: 'comick',
      title: details.title,
      coverUrl: details.cover_url || cover?.url || '',
      author: details.authors?.map(a => a.name).join(', ') || 'Unknown',
      artist: 'Unknown',
      status: this.mapStatus(details.status),
      description: details.description || '',
      genres: details.genres || [],
      tags: [],
      url: `https://comick.app/comic/${hid}`,
    }
  }

  async getMangaDetails(id: string): Promise<Manga> {
    const search = await this.fetchJson<ComickSearchResult[]>(
      `${PROXY_PREFIX}${encodeURIComponent(`${COMICK_API}/v1.0/search/?q=${encodeURIComponent(id)}&limit=1`)}`
    )
    if (search.length === 0) throw new Error('Manga not found')

    const details = await this.fetchJson<ComickMangaDetails>(
      `${PROXY_PREFIX}${encodeURIComponent(`${COMICK_API}/comic/${search[0].slug}`)}`
    )
    return this.mapManga(details, search[0].hid)
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    const data = await this.fetchJson<any[]>(
      `${PROXY_PREFIX}${encodeURIComponent(`${COMICK_API}/comic/${mangaId}/chapters?lang=en&chap-order=1&limit=500`)}`
    )
    return data.map((ch: any) => ({
      id: ch.chapter.hid,
      mangaId,
      chapterNumber: parseFloat(ch.chapter.chap) || 0,
      title: ch.chapter.title || `Chapter ${ch.chapter.chap}`,
      scanlator: 'Comick',
      releaseDate: new Date(ch.chapter.created_at * 1000).toISOString(),
      pageCount: ch.md_images?.length || 0,
      read: false,
      lastReadPage: 0,
    }))
  }

  async getPages(chapterId: string): Promise<Page[]> {
    const data = await this.fetchJson<ComickPages>(
      `${PROXY_PREFIX}${encodeURIComponent(`${COMICK_API}/chapter/${chapterId}`)}`
    )
    return data.chapter.md_images.map((img, index) => ({
      index,
      imageUrl: `https://meo.comick.pictures/${img.b2key}`,
      width: img.w,
      height: img.h,
    }))
  }

  private mapStatus(status: string): Manga['status'] {
    const statusMap: Record<string, Manga['status']> = {
      ongoing: 'ongoing',
      completed: 'completed',
      hiatus: 'hiatus',
      cancelled: 'cancelled',
      stopped: 'cancelled',
    }
    return statusMap[status?.toLowerCase()] || 'unknown'
  }
}

export const comickProvider = new ComickProvider()