// src/services/scrape/scrapeAdapter.ts
import { parse as parseHtml } from 'node-html-parser';
import type { SourceProvider, Manga, Chapter, Page } from '~/types';
import type { SiteConfig, ScrapedManga, ScrapedChapter, ScrapedPage, ParsedMangaPage } from './types';

export class ScrapeAdapter implements SourceProvider {
  readonly id: string;
  private config: SiteConfig;
  private sourceUrl: string;

  constructor(id: string, config: SiteConfig, sourceUrl: string) {
    this.id = id;
    this.config = config;
    this.sourceUrl = sourceUrl;
  }

  resolveUrl(href: string): string {
    try {
      return new URL(href, this.config.baseUrl).toString();
    } catch {
      return href;
    }
  }

  parseMangaPage(html: string): ParsedMangaPage {
    const root = parseHtml(html);
    const title = this.extractText(root, this.config.mangaPage.title) || 'Untitled';
    const coverSrc = this.extractAttr(root, this.config.mangaPage.cover, 'src') || '';
    const coverUrl = coverSrc ? this.resolveUrl(coverSrc) : '';

    const mangaId = this.makeId(this.sourceUrl);
    const chapterNodes = root.querySelectorAll(this.config.mangaPage.chapterList);
    const chapters: ScrapedChapter[] = chapterNodes.map((node, idx) => {
      const a = this.config.mangaPage.chapterUrl
        ? node.querySelector(this.config.mangaPage.chapterUrl)
        : node;
      const href = a?.getAttribute('href') || '';
      const url = this.resolveUrl(href);
      const titleText = this.config.mangaPage.chapterTitle
        ? this.resolveTitleText(a, node, this.config.mangaPage.chapterTitle, idx)
        : (a?.text || `Chapter ${idx + 1}`);

      return {
        id: this.makeChapterId(url),
        mangaId,
        chapterNumber: chapterNodes.length - idx,
        title: titleText.trim(),
        scanlator: '',
        releaseDate: '',
        pageCount: 0,
        read: false,
        lastReadPage: 0,
        url,
      };
    });

    return {
      id: mangaId,
      sourceId: 'scrape',
      title,
      coverUrl,
      author: '',
      artist: '',
      status: 'unknown',
      description: '',
      genres: [],
      tags: [],
      url: this.sourceUrl,
      chapters,
    };
  }

  parseChapterPage(html: string): ScrapedPage[] {
    const root = parseHtml(html);
    const imgs = root.querySelectorAll(this.config.chapterPage.images);
    return imgs.map((img, idx) => {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      return {
        index: idx,
        imageUrl: this.resolveUrl(src),
      };
    });
  }

  // ----- SourceProvider implementation (delegates to fetch + parse) -----

  async getPopular(_page: number): Promise<Manga[]> {
    return [];
  }

  async getLatest(_page: number): Promise<Manga[]> {
    return [];
  }

  async search(_query: string, _page: number): Promise<Manga[]> {
    return [];
  }

  async getMangaDetails(_id: string): Promise<Manga> {
    // Caller should use parseMangaPage directly with the URL they already have
    throw new Error('ScrapeAdapter.getMangaDetails: fetch via /api/proxy and call parseMangaPage');
  }

  async getChapters(_mangaId: string): Promise<Chapter[]> {
    return [];
  }

  async getPages(_chapterId: string): Promise<Page[]> {
    return [];
  }

  // ----- Helpers -----

  private makeId(url: string): string {
    return `scrape:${this.id}:${simpleHash(url)}`;
  }

  private makeChapterId(url: string): string {
    return `scrape:${this.id}:ch:${simpleHash(url)}`;
  }

  private extractText(root: ReturnType<typeof parseHtml>, selector: string): string {
    if (!selector) return '';
    const el = root.querySelector(selector);
    return el?.text || '';
  }

  private extractAttr(root: ReturnType<typeof parseHtml>, selector: string, attr: string): string {
    if (!selector) return '';
    const el = root.querySelector(selector);
    return el?.getAttribute(attr) || '';
  }

  private resolveTitleText(
    a: ReturnType<ReturnType<typeof parseHtml>['querySelector']> | null | undefined,
    node: ReturnType<ReturnType<typeof parseHtml>['querySelector']> | null,
    titleSelector: string,
    idx: number
  ): string {
    // If title selector matches the same element as the url element, use it directly
    if (a && titleSelector && this.matchesSelector(a, titleSelector)) {
      return a.text || `Chapter ${idx + 1}`;
    }
    const el = a?.querySelector(titleSelector) ?? node?.querySelector(titleSelector);
    return el?.text || `Chapter ${idx + 1}`;
  }

  private matchesSelector(el: ReturnType<ReturnType<typeof parseHtml>['querySelector']> | null, selector: string): boolean {
    if (!el || !selector) return false;
    // Check tag match for simple selectors like "a" or "h1"
    if (/^[a-zA-Z][\w-]*$/.test(selector)) {
      return el.tagName?.toLowerCase() === selector.toLowerCase();
    }
    // Fallback: check if querySelector(selector) returns the same element
    try {
      return el.querySelector(selector) === el || (el as any).querySelectorAll?.(selector)?.includes?.(el);
    } catch {
      return false;
    }
  }
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
