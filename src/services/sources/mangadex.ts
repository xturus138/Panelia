import type { Manga, Chapter, Page, SourceProvider } from '~/types';

const MANGADEX_API = 'https://api.mangadex.org';

interface MangaDexResponse<T> {
  data: T;
  result: 'ok' | 'error';
}

interface MangaDexManga {
  id: string;
  type: string;
  attributes: {
    title: { [key: string]: string };
    description: { [key: string]: string };
    status: string;
    year: number;
  };
  relationships: Array<{
    type: string;
    id: string;
    attributes?: Record<string, unknown>;
  }>;
}

interface MangaDexChapter {
  id: string;
  type: string;
  attributes: {
    chapter: string;
    title: string;
    translatedLanguage: string;
    publishAt: string;
    pages: number;
  };
}

interface MangaDexPageResponse {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
}

export class MangaDexProvider implements SourceProvider {
  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(
      `/api/proxy?url=${encodeURIComponent(`${MANGADEX_API}${endpoint}`)}`
    );

    if (!response.ok) {
      let errMsg = `MangaDex API error: ${response.status}`;
      try {
        const body = await response.json();
        if (body.detail) errMsg += ` (${body.detail})`;
        else if (body.error) errMsg += ` (${body.error})`;
      } catch {
        // Fallback to generic statusText
      }
      throw new Error(errMsg);
    }

    return response.json();
  }

  async getPopular(page: number = 0): Promise<Manga[]> {
    const response = await this.fetch<MangaDexResponse<MangaDexManga[]>>(
      `/manga?order[rating]=desc&limit=20&offset=${page * 20}&includes[]=cover_art&includes[]=author&includes[]=artist`
    );

    return this.mapMangaList(response.data);
  }

  async getLatest(page: number = 0): Promise<Manga[]> {
    const response = await this.fetch<MangaDexResponse<MangaDexManga[]>>(
      `/manga?order[createdAt]=desc&limit=20&offset=${page * 20}&includes[]=cover_art&includes[]=author&includes[]=artist`
    );

    return this.mapMangaList(response.data);
  }

  async search(query: string, page: number = 0): Promise<Manga[]> {
    const response = await this.fetch<MangaDexResponse<MangaDexManga[]>>(
      `/manga?title=${encodeURIComponent(query)}&limit=20&offset=${page * 20}&includes[]=cover_art&includes[]=author&includes[]=artist`
    );

    return this.mapMangaList(response.data);
  }

  async getMangaDetails(id: string): Promise<Manga> {
    const response = await this.fetch<MangaDexResponse<MangaDexManga>>(
      `/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`
    );

    const manga = response.data;
    const coverUrl = this.getCoverUrl(manga);
    const author = this.getAuthorName(manga);
    const artist = this.getArtistName(manga);

    return {
      id: manga.id,
      sourceId: 'mangadex',
      title: manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title',
      coverUrl,
      author,
      artist,
      status: this.mapStatus(manga.attributes.status),
      description: manga.attributes.description.en || Object.values(manga.attributes.description)[0] || '',
      genres: [],
      tags: [],
      url: `https://mangadex.org/title/${manga.id}`,
    };
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    const response = await this.fetch<MangaDexResponse<MangaDexChapter[]>>(
      `/manga/${mangaId}/feed?translatedLanguage[]=en&limit=500&order[chapter]=asc`
    );

    return response.data.map(ch => ({
      id: ch.id,
      mangaId,
      chapterNumber: parseFloat(ch.attributes.chapter) || 0,
      title: ch.attributes.title || `Chapter ${ch.attributes.chapter}`,
      scanlator: 'MangaDex',
      releaseDate: ch.attributes.publishAt,
      pageCount: ch.attributes.pages,
      read: false,
      lastReadPage: 0,
    }));
  }

  async getPages(chapterId: string): Promise<Page[]> {
    const response = await this.fetch<MangaDexPageResponse>(
      `/at-home/server/${chapterId}`
    );

    const { baseUrl, chapter } = response;
    const filenames = chapter.dataSaver || chapter.data;

    return filenames.map((filename, index) => ({
      index,
      imageUrl: `${baseUrl}/data-saver/${chapter.hash}/${filename}`,
    }));
  }

  private mapMangaList(mangaList: MangaDexManga[]): Manga[] {
    return mangaList.map(manga => ({
      id: manga.id,
      sourceId: 'mangadex',
      title: manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title',
      coverUrl: this.getCoverUrl(manga),
      author: this.getAuthorName(manga),
      artist: this.getArtistName(manga),
      status: this.mapStatus(manga.attributes.status),
      description: manga.attributes.description.en || Object.values(manga.attributes.description)[0] || '',
      genres: [],
      tags: [],
      url: `https://mangadex.org/title/${manga.id}`,
    }));
  }

  private getCoverUrl(manga: MangaDexManga): string {
    const cover = manga.relationships.find(r => r.type === 'cover_art');
    if (!cover) return '';

    const filename = cover.attributes?.fileName;
    if (!filename) return '';

    return `https://uploads.mangadex.org/covers/${manga.id}/${filename}`;
  }

  private getAuthorName(manga: MangaDexManga): string {
    const author = manga.relationships.find(r => r.type === 'author');
    const name = author?.attributes?.name;
    return typeof name === 'string' ? name : 'Unknown';
  }

  private getArtistName(manga: MangaDexManga): string {
    const artist = manga.relationships.find(r => r.type === 'artist');
    const name = artist?.attributes?.name;
    return typeof name === 'string' ? name : this.getAuthorName(manga);
  }

  private mapStatus(status: string): Manga['status'] {
    const statusMap: Record<string, Manga['status']> = {
      ongoing: 'ongoing',
      completed: 'completed',
      hiatus: 'hiatus',
      cancelled: 'cancelled',
    };
    return statusMap[status] || 'unknown';
  }
}

export const mangadexProvider = new MangaDexProvider();
