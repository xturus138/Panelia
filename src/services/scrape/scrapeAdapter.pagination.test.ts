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
});
