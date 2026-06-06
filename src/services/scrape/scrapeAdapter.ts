import { parse as parseHtml } from 'node-html-parser';
import type { SourceProvider, Manga, Chapter, Page } from '~/types';
import type { SiteConfig, ScrapedManga, ScrapedChapter, ScrapedPage, ParsedMangaPage, SearchResult } from './types';

const MAX_LISTING_PAGES = 10;

type ListingSelectors = {
  resultItem: string;
  resultTitle: string;
  resultUrl: string;
  resultCover: string;
};

export class ScrapeAdapter implements SourceProvider {
  readonly id: string;
  readonly name: string;
  readonly config: SiteConfig;
  readonly sourceUrl: string;

  constructor(id: string, config: SiteConfig, sourceUrl: string) {
    this.id = id;
    this.name = id;
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
      sourceId: this.id,
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
    return imgs
      .map((img) => {
        let src = img.getAttribute('data-src')
          || img.getAttribute('data-lazy-src')
          || img.getAttribute('data-original')
          || img.getAttribute('data-srcset')
          || img.getAttribute('src')
          || '';

        // Handle srcset format (e.g. "url1 1x, url2 2x")
        if (src.includes(' ')) {
          src = src.split(' ')[0];
        }

        const width = parseInt(img.getAttribute('width') || '0', 10);
        const height = parseInt(img.getAttribute('height') || '0', 10);
        return { imageUrl: this.resolveUrl(src), width, height };
      })
      .filter((page) => {
        // Skip empty URLs
        if (!page.imageUrl || page.imageUrl.trim() === '') return false;
        // Skip base64 data URIs (inline placeholders)
        if (page.imageUrl.startsWith('data:image/')) return false;
        // Skip known placeholder patterns
        if (/lazy\.jpg|lazy\.png|placeholder|loading\.|spinner/i.test(page.imageUrl)) return false;
        // Skip tiny images (icons, tracking pixels, etc.)
        if ((page.width > 0 && page.width < 100) || (page.height > 0 && page.height < 100)) return false;
        return true;
      })
      .map((page, idx) => ({
        index: idx,
        imageUrl: page.imageUrl,
      }));
  }

  async searchManga(query: string): Promise<SearchResult[]> {
    if (!this.config.searchPage) return [];

    const { urlTemplate, resultItem, resultTitle, resultUrl, resultCover } = this.config.searchPage;
    return this.fetchPaginatedListing(
      urlTemplate,
      { resultItem, resultTitle, resultUrl, resultCover },
      query
    );
  }

  /** Fetch a single page of search results. Returns results and whether more pages may exist. */
  async searchMangaPage(query: string, page: number): Promise<{ results: SearchResult[]; hasMore: boolean }> {
    if (!this.config.searchPage) return { results: [], hasMore: false };
    const { urlTemplate, resultItem, resultTitle, resultUrl, resultCover } = this.config.searchPage;
    const selectors: ListingSelectors = { resultItem, resultTitle, resultUrl, resultCover };
    const url = this.buildPageUrl(urlTemplate, page, query);
    const results = await this.fetchListingPage(url, selectors);
    const hasMore = results.length > 0 && page < MAX_LISTING_PAGES;
    return { results, hasMore };
  }

  /** Fetch all popular results. Pagination is hidden from the UI. */
  async getPopularResults(): Promise<SearchResult[]> {
    if (this.config.popularPage) {
      const { urlTemplate, resultItem, resultTitle, resultUrl, resultCover } = this.config.popularPage;
      return this.fetchPaginatedListing(urlTemplate, { resultItem, resultTitle, resultUrl, resultCover });
    }

    return this.searchManga('');
  }

  /** Fetch a single page of popular results. Returns results and whether more pages may exist. */
  async getPopularPage(page: number): Promise<{ results: SearchResult[]; hasMore: boolean }> {
    if (!this.config.popularPage) return { results: [], hasMore: false };
    const { urlTemplate, resultItem, resultTitle, resultUrl, resultCover } = this.config.popularPage;
    const selectors: ListingSelectors = { resultItem, resultTitle, resultUrl, resultCover };
    const url = this.buildPageUrl(urlTemplate, page);
    const results = await this.fetchListingPage(url, selectors);
    const hasMore = results.length > 0 && page < MAX_LISTING_PAGES;
    return { results, hasMore };
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

  private async fetchPaginatedListing(
    urlTemplate: string,
    selectors: ListingSelectors,
    query?: string
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    if (!urlTemplate.includes('{page}')) {
      const url = this.buildPageUrl(urlTemplate, 1, query);
      return this.fetchListingPage(url, selectors);
    }

    for (let page = 1; page <= MAX_LISTING_PAGES; page++) {
      const pageUrl = this.buildPageUrl(urlTemplate, page, query);
      const pageResults = await this.fetchListingPage(pageUrl, selectors);
      if (pageResults.length === 0) break;
      results.push(...pageResults);
    }

    return results;
  }

  private buildPageUrl(template: string, page: number, query?: string): string {
    let url = template;
    if (template.includes('/manga/{page}?')) {
      url = template.replace('/{page}', page > 1 ? `/page/${page}/` : '/');
    } else {
      url = template.replace('{page}', String(page));
    }
    if (query !== undefined) {
      url = url.replace('{query}', encodeURIComponent(query));
    }
    return url;
  }

  private async fetchListingPage(url: string, selectors: ListingSelectors): Promise<SearchResult[]> {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`Listing failed: HTTP ${res.status}`);
    let html = await res.text();

    // Sanitize malformed HTML patterns that break node-html-parser
    // Fix: <span ...><b>...</span></b> -> <span ...><b>...</b></span>
    html = html.replace(/<span(.*?)><b>(.*?)<\/span><\/b>/gi, '<span$1><b>$2</b></span>');

    return this.parseSearchResults(html, selectors);
  }

  private parseSearchResults(html: string, selectors: ListingSelectors): SearchResult[] {
    const root = parseHtml(html);
    const items = root.querySelectorAll(selectors.resultItem);

    return items.map((item) => {
      const titleEl = this.querySelectorMulti(item, selectors.resultTitle);
      const linkEl = this.querySelectorMulti(item, selectors.resultUrl);
      const coverEl = this.querySelectorMulti(item, selectors.resultCover);

      const href = linkEl?.getAttribute('href') || '';
      let title = titleEl?.text?.trim() || linkEl?.text?.trim() || '';
      title = title.replace(/\s+/g, ' '); // Clean up multi-line spaces
      if (!title && coverEl) {
        const alt = coverEl.getAttribute('alt') || '';
        title = alt.replace(/^(Baca|Read|Manga|Manhwa|Manhua)\s+/i, '').trim();
      }
      if (!title && href) {
        // Fallback to URL slug (e.g. /manga/solo-leveling/ -> Solo Leveling)
        const slug = href.split('/').filter(Boolean).pop();
        if (slug) {
          title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
      }
      if (!title) title = 'Untitled';

      const url = this.resolveUrl(href);
      let coverSrc = coverEl?.getAttribute('data-src')
        || coverEl?.getAttribute('data-lazy-src')
        || coverEl?.getAttribute('data-original')
        || coverEl?.getAttribute('data-srcset')
        || coverEl?.getAttribute('src')
        || '';

      if (coverSrc.includes(' ')) {
        // Handle potential srcset (e.g. "url1 1x, url2 2x")
        coverSrc = coverSrc.split(' ')[0];
      }

      if (/lazy\.jpg|lazy\.png|placeholder|loading\.|spinner/i.test(coverSrc)) {
        coverSrc = '';
      }
      const coverUrl = this.resolveUrl(coverSrc);
      const id = `${this.id}:${simpleHash(url)}`;

      return { id, title, url, coverUrl };
    });
  }

  /**
   * Try multiple selectors (comma-separated) and return the first match.
   * node-html-parser doesn't support comma-separated selector lists natively.
   */
  private querySelectorMulti(
    root: ReturnType<typeof parseHtml>,
    selector: string
  ): ReturnType<typeof parseHtml>['querySelector'] extends (s: string) => infer R ? R : never {
    if (!selector) return null;
    const parts = selector.split(',').map(s => s.trim());
    for (const part of parts) {
      const el = root.querySelector(part);
      if (el) return el;
    }
    return null;
  }

  // ----- Helpers -----

  private makeId(url: string): string {
    return `${this.id}:${simpleHash(url)}`;
  }

  private makeChapterId(url: string): string {
    return `${this.id}:ch:${simpleHash(url)}`;
  }

  private extractText(root: ReturnType<typeof parseHtml>, selector: string): string {
    if (!selector) return '';
    const el = root.querySelector(selector);
    return el?.text || '';
  }

  private extractAttr(root: ReturnType<typeof parseHtml>, selector: string, attr: string): string {
    if (!selector) return '';
    const el = root.querySelector(selector);
    if (!el) return '';

    // For src attributes, check common lazy-load attributes first
    if (attr === 'src') {
      const lazySrc = el.getAttribute('data-src')
        || el.getAttribute('data-lazy-src')
        || el.getAttribute('data-original')
        || el.getAttribute('data-srcset')
        || el.getAttribute('src')
        || '';

      // Handle srcset format (e.g. "url1 1x, url2 2x")
      if (lazySrc.includes(' ')) {
        return lazySrc.split(' ')[0];
      }

      return lazySrc;
    }

    return el.getAttribute(attr) || '';
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
