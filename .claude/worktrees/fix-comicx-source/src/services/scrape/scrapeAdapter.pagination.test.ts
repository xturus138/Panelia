import { describe, expect, it, vi, afterEach } from 'vitest';
import { ScrapeAdapter } from './scrapeAdapter';
import type { SiteConfig } from './types';

const config: SiteConfig = {
  name: 'Test',
  baseUrl: 'https://example.com',
  searchPage: {
    urlTemplate: 'https://example.com/search?q={query}&page={page}',
    resultItem: '.item',
    resultTitle: '.title',
    resultUrl: 'a',
    resultCover: 'img',
  },
  popularPage: {
    urlTemplate: 'https://example.com/page/{page}/',
    resultItem: '.item',
    resultTitle: '.title',
    resultUrl: 'a',
    resultCover: 'img',
  },
  mangaPage: {
    title: 'h1',
    cover: 'img.cover',
    chapterList: '.chapter',
    chapterUrl: 'a',
  },
  chapterPage: {
    images: 'img.page',
  },
};

function pageHtml(prefix: string): string {
  return `
    <div class="item"><a href="/manga/${prefix}-1/"><span class="title">${prefix} 1</span><img src="/${prefix}-1.jpg" /></a></div>
    <div class="item"><a href="/manga/${prefix}-2/"><span class="title">${prefix} 2</span><img src="/${prefix}-2.jpg" /></a></div>
  `;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ScrapeAdapter pagination', () => {
  it('searchManga fetches pages until an empty page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(pageHtml('page1'), { status: 200 }))
      .mockResolvedValueOnce(new Response(pageHtml('page2'), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));

    const adapter = new ScrapeAdapter('test', config, 'https://example.com');
    const results = await adapter.searchManga('hello world');

    expect(results).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // URL is encoded once for the query, then proxy URL encoding keeps `%20` as `%2520`.
    expect(String(fetchMock.mock.calls[0][0])).toContain('hello%2520world');
    expect(String(fetchMock.mock.calls[0][0])).toContain('page%3D1');
    expect(String(fetchMock.mock.calls[1][0])).toContain('page%3D2');
    expect(String(fetchMock.mock.calls[2][0])).toContain('page%3D3');
  });

  it('getPopularResults fetches pages until an empty page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(pageHtml('popular1'), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));

    const adapter = new ScrapeAdapter('test', config, 'https://example.com');
    const results = await adapter.getPopularResults();

    expect(results).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('page%2F1');
    expect(String(fetchMock.mock.calls[1][0])).toContain('page%2F2');
  });

  it('searchMangaPage fetches a single page and detects hasMore', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(pageHtml('search_p2'), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));

    const adapter = new ScrapeAdapter('test', config, 'https://example.com');

    // Page with content
    const res1 = await adapter.searchMangaPage('hello', 2);
    expect(res1.results).toHaveLength(2);
    expect(res1.hasMore).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain('page%3D2');

    // Empty page
    const res2 = await adapter.searchMangaPage('hello', 3);
    expect(res2.results).toHaveLength(0);
    expect(res2.hasMore).toBe(false);
    expect(String(fetchMock.mock.calls[1][0])).toContain('page%3D3');
  });

  it('getPopularPage fetches a single page and detects hasMore', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(pageHtml('pop_p1'), { status: 200 }));

    const adapter = new ScrapeAdapter('test', config, 'https://example.com');
    const res = await adapter.getPopularPage(1);
    expect(res.results).toHaveLength(2);
    expect(res.hasMore).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain('page%2F1');
  });

  it('handles malformed HTML nesting that usually breaks node-html-parser', async () => {
    const malformedHtml = `
      <div class="bge">
        <div class="bgei"><a href="/manga/a"><img src="a.jpg"></a></div>
        <div class="kan">
          <a href="/manga/a"><h3>Title A</h3></a>
          <span class="judul2"><span style="color:red"><b>641</span></b> pembaca</span>
        </div>
      </div>
    `;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(malformedHtml, { status: 200 }));

    // Use selectors matching the HTML structure
    const komikuLikeConfig: SiteConfig = {
      name: 'Test',
      baseUrl: 'https://example.com',
      popularPage: {
        urlTemplate: 'https://example.com/popular',
        resultItem: 'div.bge',
        resultTitle: 'div.kan h3',
        resultUrl: 'div.kan a',
        resultCover: 'div.bgei img',
      },
      mangaPage: { title: '', cover: '', chapterList: '', chapterUrl: '' },
      chapterPage: { images: '' },
    };

    const adapter = new ScrapeAdapter('test', komikuLikeConfig, 'https://example.com');
    const results = await adapter.getPopularResults();

    // Without sanitization, Title A is lost because node-html-parser closes div.bge early at </span>
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Title A');

    fetchMock.mockRestore();
  });
});
