# Browse Mode Pagination & UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hidden pagination to Komiku browse/search (auto-load pages sequentially, safety-capped at 10 pages) and remove all developer-only UI ("+ Add source" button, config panel, gear icon).

**Architecture:** `SiteConfig` uses `urlTemplate` with `{page}` placeholder for both `searchPage` and `popularPage`. `ScrapeAdapter` loops over pages, fetching until empty or page > 10. UI no longer exposes config editing; the source list is static from built-in presets.

**Tech Stack:** Next.js App Router, TypeScript, React, node-html-parser, fetch proxy.

---

## File Structure

- `src/services/scrape/types.ts` — declare scrape config shape. Add paginated popular page config via `urlTemplate`.
- `src/services/scrape/presets.ts` — built-in source configs. Update Komiku URL templates for search/popular pagination.
- `src/services/scrape/scrapeAdapter.ts` — fetch and parse listing pages. Add sequential pagination helpers and reuse result parsing.
- `src/services/scrape/scrapeAdapter.pagination.test.ts` — regression tests for paginated search/popular fetch behavior.
- `src/app/browse/page.tsx` — browse UI. Remove add-source/config editing controls and use preset configs directly.
- `docs/superpowers/specs/2026-06-04-browse-pagination-and-ui-cleanup.md` — update implementation notes after code changes.

---

### Task 1: Update Scrape Types & Komiku Config

**Files:**
- Modify: `src/services/scrape/types.ts`
- Modify: `src/services/scrape/presets.ts`

- [ ] **Step 1: Update `popularPage` type**

In `src/services/scrape/types.ts`, replace `popularPage.url` with `popularPage.urlTemplate`:

```ts
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
```

- [ ] **Step 2: Update Komiku preset**

In `src/services/scrape/presets.ts`, set:

```ts
      searchPage: {
        // Komiku loads results from api.komiku.org via HTMX (lazy-load)
        urlTemplate: 'https://api.komiku.org/?post_type=manga&s={query}&page={page}',
        resultItem: 'div.bge',
        resultTitle: 'h3',
        resultUrl: 'a[href^="/manga/"]',
        resultCover: 'img.lazy, img',
      },
      popularPage: {
        urlTemplate: 'https://komiku.org/page/{page}/',
        resultItem: 'div.ls4v',
        resultTitle: 'a',
        resultUrl: 'a',
        resultCover: 'img.lazy',
      },
```

- [ ] **Step 3: Run type check/build**

Run: `npm run build`

Expected: no TypeScript error about `popularPage.url`.

- [ ] **Step 4: Commit**

```bash
git add src/services/scrape/types.ts src/services/scrape/presets.ts
git commit -m "feat(scrape): add paginated Komiku listing templates"
```

---

### Task 2: Add Sequential Pagination to ScrapeAdapter

**Files:**
- Modify: `src/services/scrape/scrapeAdapter.ts`

- [ ] **Step 1: Extract result parser**

Add a private parser method inside `ScrapeAdapter`:

```ts
  private parseSearchResults(
    html: string,
    selectors: {
      resultItem: string;
      resultTitle: string;
      resultUrl: string;
      resultCover: string;
    }
  ): SearchResult[] {
    const root = parseHtml(html);
    const items = root.querySelectorAll(selectors.resultItem);
    return items.map((item) => {
      const titleEl = item.querySelector(selectors.resultTitle);
      const linkEl = item.querySelector(selectors.resultUrl);
      const coverEl = item.querySelector(selectors.resultCover);

      let title = titleEl?.text?.trim() || linkEl?.text?.trim() || '';
      if (!title && coverEl) {
        const alt = coverEl.getAttribute('alt') || '';
        title = alt.replace(/^(Baca|Read|Manga|Manhwa|Manhua)\s+/i, '').trim();
      }
      if (!title) title = 'Untitled';

      const href = linkEl?.getAttribute('href') || '';
      const url = this.resolveUrl(href);
      let coverSrc = coverEl?.getAttribute('data-src')
        || coverEl?.getAttribute('data-lazy-src')
        || coverEl?.getAttribute('data-original')
        || coverEl?.getAttribute('src')
        || '';
      if (/lazy\.jpg|lazy\.png|placeholder|loading\.|spinner/i.test(coverSrc)) {
        coverSrc = '';
      }
      const coverUrl = this.resolveUrl(coverSrc);
      const id = `scrape:${this.id}:${simpleHash(url)}`;

      return { id, title, url, coverUrl };
    });
  }
```

- [ ] **Step 2: Add page URL helper**

Add private helper:

```ts
  private buildPageUrl(template: string, page: number, query?: string): string {
    let url = template.replace('{page}', String(page));
    if (query !== undefined) {
      url = url.replace('{query}', encodeURIComponent(query));
    }
    return url;
  }
```

- [ ] **Step 3: Add fetch helper**

Add private helper:

```ts
  private async fetchListingPage(
    url: string,
    selectors: {
      resultItem: string;
      resultTitle: string;
      resultUrl: string;
      resultCover: string;
    }
  ): Promise<SearchResult[]> {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`Listing failed: HTTP ${res.status}`);
    const html = await res.text();
    return this.parseSearchResults(html, selectors);
  }
```

- [ ] **Step 4: Add paginated helper with max 10 pages**

Add:

```ts
  private async fetchPaginatedListing(
    urlTemplate: string,
    selectors: {
      resultItem: string;
      resultTitle: string;
      resultUrl: string;
      resultCover: string;
    },
    query?: string
  ): Promise<SearchResult[]> {
    const maxPages = 10;
    const results: SearchResult[] = [];

    if (!urlTemplate.includes('{page}')) {
      return this.fetchListingPage(this.buildPageUrl(urlTemplate, 1, query), selectors);
    }

    for (let page = 1; page <= maxPages; page++) {
      const pageUrl = this.buildPageUrl(urlTemplate, page, query);
      const pageResults = await this.fetchListingPage(pageUrl, selectors);
      if (pageResults.length === 0) break;
      results.push(...pageResults);
    }

    return results;
  }
```

- [ ] **Step 5: Refactor `searchManga`**

Replace body with:

```ts
  async searchManga(query: string): Promise<SearchResult[]> {
    if (!this.config.searchPage) return [];

    const { urlTemplate, resultItem, resultTitle, resultUrl, resultCover } = this.config.searchPage;
    return this.fetchPaginatedListing(
      urlTemplate,
      { resultItem, resultTitle, resultUrl, resultCover },
      query
    );
  }
```

- [ ] **Step 6: Refactor `getPopularResults`**

Replace body with:

```ts
  async getPopularResults(): Promise<SearchResult[]> {
    if (this.config.popularPage) {
      const { urlTemplate, resultItem, resultTitle, resultUrl, resultCover } = this.config.popularPage;
      return this.fetchPaginatedListing(urlTemplate, { resultItem, resultTitle, resultUrl, resultCover });
    }

    return this.searchManga('');
  }
```

- [ ] **Step 7: Run build**

Run: `npm run build`

Expected: build passes.

- [ ] **Step 8: Commit**

```bash
git add src/services/scrape/scrapeAdapter.ts
git commit -m "feat(scrape): fetch paginated listing results"
```

---

### Task 3: Add Pagination Regression Tests

**Files:**
- Create: `src/services/scrape/scrapeAdapter.pagination.test.ts`

- [ ] **Step 1: Add tests**

Create `src/services/scrape/scrapeAdapter.pagination.test.ts`:

```ts
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
    expect(String(fetchMock.mock.calls[0][0])).toContain('hello%20world');
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
```

- [ ] **Step 2: Run targeted test**

Run: `npm test -- src/services/scrape/scrapeAdapter.pagination.test.ts`

Expected: tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/services/scrape/scrapeAdapter.pagination.test.ts
git commit -m "test(scrape): cover paginated listing fetches"
```

---

### Task 4: Remove Add Source Button and Config UI

**Files:**
- Modify: `src/app/browse/page.tsx`

- [ ] **Step 1: Remove imports**

Remove unused imports from `lucide-react`:

```ts
  Wand2,
  Settings2,
```

Remove unused import:

```ts
import { autoDetectConfig } from '~/services/scrape/autoDetect';
```

- [ ] **Step 2: Remove config editor state**

Delete:

```ts
  const [configJson, setConfigJson] = useState<string>('');
  const [showConfig, setShowConfig] = useState(false);
  const configDirty = useRef(false);
```

If `useRef` becomes unused, remove it from React import.

- [ ] **Step 3: Simplify active source reset effect**

Remove config JSON setup lines:

```ts
    setConfigJson(JSON.stringify(activeSource.config, null, 2));
    configDirty.current = false;
```

- [ ] **Step 4: Replace `getAdapter`**

Replace `getAdapter` with:

```ts
  const getAdapter = useCallback(
    (url: string): ScrapeAdapter => {
      if (!activeSource) throw new Error('No source selected');
      return new ScrapeAdapter(activeSource.id, activeSource.config, url);
    },
    [activeSource]
  );
```

- [ ] **Step 5: Update save/session config use**

In `handleSelectResult`, replace live config parse block with:

```ts
        const liveConfig = activeSource.config;
```

In `handleSave`, replace JSON parse validation block with:

```ts
      const config = activeSource.config;
```

- [ ] **Step 6: Remove redetect function**

Delete `handleRedetect` completely.

- [ ] **Step 7: Remove Add Source button**

Delete JSX:

```tsx
        <button
          disabled
          className="px-3 py-2 rounded-t-lg text-xs text-muted-foreground/40 italic"
          title="More sources coming soon"
        >
          + Add source
        </button>
```

- [ ] **Step 8: Remove gear button**

Delete JSX button with `title="Edit scrape config"` and `Settings2` icon.

- [ ] **Step 9: Remove Config Panel block**

Delete entire JSX block beginning:

```tsx
      {/* Config Panel */}
      {showConfig && (
```

through the matching closing `)}`.

- [ ] **Step 10: Run build**

Run: `npm run build`

Expected: no unused import/state errors.

- [ ] **Step 11: Commit**

```bash
git add src/app/browse/page.tsx
git commit -m "refactor(browse): remove runtime source config UI"
```

---

### Task 5: Update Spec Notes and Verify

**Files:**
- Modify: `docs/superpowers/specs/2026-06-04-browse-pagination-and-ui-cleanup.md`

- [ ] **Step 1: Append implementation notes**

Append:

```md

## Implementation Notes

- `SiteConfig.popularPage` now uses `urlTemplate` so built-in sources can declare page-aware listing URLs.
- Komiku search/popular listing config supports `{page}` and is fetched sequentially through `ScrapeAdapter`.
- Runtime source/config editing UI was removed from Browse; new sources are added by editing built-in presets in code.
- Pagination is intentionally hidden from the UI and capped at 10 pages to avoid unbounded scraping.
```

- [ ] **Step 2: Run validation**

Run:

```bash
npm test -- src/services/scrape/scrapeAdapter.pagination.test.ts
npm run build
```

Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-06-04-browse-pagination-and-ui-cleanup.md
git commit -m "docs: record browse pagination implementation notes"
```

---

## Self-Review Checklist

- Spec coverage: pagination, UI removal, dev-only source changes all covered.
- Placeholder scan: no TBD/TODO/"implement later".
- Type consistency: `urlTemplate` used consistently.
- Safety: max 10 page cap.
