// src/services/scrape/types.ts

/**
 * Declarative config describing how to extract data from a manga site.
 * Users provide one config per domain. A config is a JSON object
 * that tells the ScrapeAdapter which CSS selectors to use.
 */
export interface SiteConfig {
  /** Display name shown in UI */
  name: string;

  /** Base URL of the site (e.g., "https://mangadex.org") */
  baseUrl: string;

  /** Optional: how to search the site for manga by name */
  searchPage?: {
    /** URL template with {query} and optional {page} placeholders */
    urlTemplate: string;
    /** Selector for each result card/container */
    resultItem: string;
    /** Selector for the title text within a result */
    resultTitle: string;
    /** Selector for the link (href) within a result */
    resultUrl: string;
    /** Selector for the cover image within a result */
    resultCover: string;
  };

  /** Optional: how to scrape popular/latest manga from a listing page */
  popularPage?: {
    /** URL template for the listing page. Supports {page}. */
    urlTemplate: string;
    /** Selector for each result card/container */
    resultItem: string;
    /** Selector for the title text within a result */
    resultTitle: string;
    /** Selector for the link (href) within a result */
    resultUrl: string;
    /** Selector for the cover image within a result */
    resultCover: string;
  };

  /** CSS selectors for extracting manga metadata from a series page */
  mangaPage: {
    title: string;
    cover: string;
    chapterList: string;
    chapterTitle?: string;
    chapterUrl: string;
  };

  /** CSS selectors for extracting page images from a chapter page */
  chapterPage: {
    images: string;
  };
}

export interface ScrapedManga {
  id: string;          // hash of the source URL
  sourceId: string;    // always "scrape"
  title: string;
  coverUrl: string;
  author: string;
  artist: string;
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'unknown';
  description: string;
  genres: string[];
  tags: string[];
  thumbnailUrl?: string;
  url: string;         // the original URL we scraped
}

export interface ScrapedChapter {
  id: string;          // hash of the chapter URL
  mangaId: string;
  chapterNumber: number;
  title: string;
  scanlator: string;
  releaseDate: string;
  pageCount: number;   // 0 until pages are fetched
  read: boolean;
  lastReadPage: number;
  url: string;         // the original chapter URL
}

export interface ScrapedPage {
  index: number;
  imageUrl: string;
  width?: number;
  height?: number;
}

export interface ScrapeSource {
  id: string;          // user-supplied or auto-generated id
  name: string;
  baseUrl: string;
  config: SiteConfig;
  createdAt: string;
}

export type ParsedMangaPage = ScrapedManga & { chapters: ScrapedChapter[] };

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  coverUrl: string;
}
