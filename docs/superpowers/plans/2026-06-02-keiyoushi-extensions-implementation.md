# Keiyoushi Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Keiyoushi extensions catalog and implement a real MangaDex adapter for fetching manga data.

**Architecture:** Repository + Factory pattern — ExtensionService fetches and caches the Keiyoushi index, SourceRegistry maps source IDs to provider implementations, and MangaDexProvider implements the SourceProvider interface using the MangaDex API.

**Tech Stack:** TypeScript, Next.js App Router, Zustand, localStorage for caching, fetch API for HTTP requests.

---

## File Structure

### New Files to Create
- `src/services/extensions.ts` — Fetches and caches Keiyoushi extensions index, maps to Source type
- `src/services/sources.ts` — SourceRegistry factory, SourceProvider interface definition
- `src/services/mangadex.ts` — MangaDexProvider implementation using MangaDex API

### Existing Files to Modify
- `src/types/index.ts` — Add SourceProvider interface if not present
- `src/app/browse/page.tsx` — Replace mock data source with ExtensionService/SourceRegistry
- `src/app/settings/page.tsx` — Add source filtering options (language, NSFW)

---

## Task 1: Add SourceProvider Interface to Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add SourceProvider interface**

```typescript
export interface SourceProvider {
  getPopular(page: number): Promise<Manga[]>;
  getLatest(page: number): Promise<Manga[]>;
  search(query: string, page: number): Promise<Manga[]>;
  getMangaDetails(id: string): Promise<Manga>;
  getChapters(mangaId: string): Promise<Chapter[]>;
  getPages(chapterId: string): Promise<Page[]>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add SourceProvider interface"
```

---

## Task 2: Create ExtensionService

**Files:**
- Create: `src/services/extensions.ts`

- [ ] **Step 1: Write ExtensionService with fetch and cache logic**

```typescript
const KEIYOSHI_INDEX_URL = 'https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json';
const CACHE_KEY = 'keiyoushi-index';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface KeiyoushiSource {
  id: string;
  name: string;
  baseUrl: string;
  lang: string;
}

interface KeiyoushiExtension {
  name: string;
  pkg: string;
  apk: string;
  lang: string;
  code: number;
  version: string;
  nsfw: number;
  sources: KeiyoushiSource[];
}

export class ExtensionService {
  private cache: KeiyoushiExtension[] | null = null;

  async fetchIndex(): Promise<KeiyoushiExtension[]> {
    const cached = this.getCachedIndex();
    if (cached) {
      return cached;
    }

    const response = await fetch(KEIYOSHI_INDEX_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Keiyoushi index: ${response.statusText}`);
    }

    const data: KeiyoushiExtension[] = await response.json();
    this.setCachedIndex(data);
    return data;
  }

  private getCachedIndex(): KeiyoushiExtension[] | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_DURATION) {
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  private setCachedIndex(data: KeiyoushiExtension[]): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data,
      }));
    } catch {
      // Ignore storage errors
    }
  }

  async getSources(): Promise<Source[]> {
    const extensions = await this.fetchIndex();
    const sources: Source[] = [];

    for (const ext of extensions) {
      for (const src of ext.sources) {
        sources.push({
          id: src.id,
          name: src.name,
          baseUrl: src.baseUrl,
          iconUrl: '',
          isInstalled: false,
          isNsfw: ext.nsfw === 1,
          version: ext.code,
          languages: [src.lang],
        });
      }
    }

    return sources;
  }

  async getSourceById(id: string): Promise<Source | null> {
    const sources = await this.getSources();
    return sources.find(s => s.id === id) || null;
  }
}

export const extensionService = new ExtensionService();
```

- [ ] **Step 2: Commit**

```bash
git add src/services/extensions.ts
git commit -m "feat: add ExtensionService for Keiyoushi index"
```

---

## Task 3: Create SourceRegistry

**Files:**
- Create: `src/services/sources.ts`

- [ ] **Step 1: Write SourceRegistry factory**

```typescript
import { mockSource } from './mock-source';

class SourceRegistry {
  private providers: Map<string, SourceProvider> = new Map();

  register(id: string, provider: SourceProvider): void {
    this.providers.set(id, provider);
  }

  get(id: string): SourceProvider {
    return this.providers.get(id) || mockSource;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }
}

export const sourceRegistry = new SourceRegistry();
```

- [ ] **Step 2: Commit**

```bash
git add src/services/sources.ts
git commit -m "feat: add SourceRegistry factory"
```

---

## Task 4: Create MangaDexProvider

**Files:**
- Create: `src/services/mangadex.ts`

- [ ] **Step 1: Write MangaDexProvider implementation**

```typescript
const MANGADEX_API = 'https://api.mangadex.org';

interface MangaDexResponse<T> {
  data: T;
  result: 'ok' | 'error';
}

interface MangaDexManga {
  id: string;
  type: string;
  attributes: {
    title: { en: string };
    description: { en: string };
    status: string;
    year: number;
  };
  relationships: Array<{
    type: string;
    id: string;
    attributes?: any;
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
    const response = await fetch(`${MANGADEX_API}${endpoint}`, {
      headers: {
        'User-Agent': 'Panelia/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`MangaDex API error: ${response.statusText}`);
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
      title: manga.attributes.title.en,
      coverUrl,
      author,
      artist,
      status: this.mapStatus(manga.attributes.status),
      description: manga.attributes.description.en || '',
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
    const pages = chapter.dataSaver || chapter.data;

    return pages.map((filename, index) => ({
      index,
      imageUrl: `${baseUrl}/data-saver/${chapter.hash}/${filename}`,
    }));
  }

  private mapMangaList(mangaList: MangaDexManga[]): Manga[] {
    return mangaList.map(manga => ({
      id: manga.id,
      sourceId: 'mangadex',
      title: manga.attributes.title.en,
      coverUrl: this.getCoverUrl(manga),
      author: this.getAuthorName(manga),
      artist: this.getArtistName(manga),
      status: this.mapStatus(manga.attributes.status),
      description: manga.attributes.description.en || '',
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
    return author?.attributes?.name || 'Unknown';
  }

  private getArtistName(manga: MangaDexManga): string {
    const artist = manga.relationships.find(r => r.type === 'artist');
    return artist?.attributes?.name || this.getAuthorName(manga);
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
```

- [ ] **Step 2: Commit**

```bash
git add src/services/mangadex.ts
git commit -m "feat: add MangaDexProvider implementation"
```

---

## Task 5: Register MangaDex Provider

**Files:**
- Modify: `src/services/sources.ts`

- [ ] **Step 1: Import and register MangaDex provider**

```typescript
import { mockSource } from './mock-source';
import { mangadexProvider } from './mangadex';

class SourceRegistry {
  private providers: Map<string, SourceProvider> = new Map();

  constructor() {
    this.register('mangadex', mangadexProvider);
  }

  register(id: string, provider: SourceProvider): void {
    this.providers.set(id, provider);
  }

  get(id: string): SourceProvider {
    return this.providers.get(id) || mockSource;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }
}

export const sourceRegistry = new SourceRegistry();
```

- [ ] **Step 2: Commit**

```bash
git add src/services/sources.ts
git commit -m "feat: register MangaDex provider in SourceRegistry"
```

---

## Task 6: Update Browse Page to Use Real Sources

**Files:**
- Modify: `src/app/browse/page.tsx`

- [ ] **Step 1: Replace mock data with ExtensionService and SourceRegistry**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { extensionService } from '~/services/extensions';
import { sourceRegistry } from '~/services/sources';
import { MangaCard } from '~/components/library/MangaCard';
import type { Manga, Source } from '~/types';

export default function BrowsePage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const [manga, setManga] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    if (activeSource) {
      loadManga();
    }
  }, [activeSource]);

  async function loadSources() {
    try {
      setLoading(true);
      const data = await extensionService.getSources();
      setSources(data);
      // Default to first source
      if (data.length > 0) {
        setActiveSource(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }

  async function loadManga() {
    if (!activeSource) return;

    try {
      setLoading(true);
      const provider = sourceRegistry.get(activeSource.id);
      const data = await provider.getPopular(0);
      setManga(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manga');
    } finally {
      setLoading(false);
    }
  }

  if (loading && sources.length === 0) {
    return <div className="p-4">Loading sources...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Browse</h1>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Sources</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sources.map(source => (
            <button
              key={source.id}
              onClick={() => setActiveSource(source)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                activeSource?.id === source.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              {source.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-4">Loading manga...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {manga.map(m => (
            <MangaCard key={m.id} manga={m} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/browse/page.tsx
git commit -m "feat: update browse page to use real sources"
```

---

## Task 7: Add Source Filtering to Settings

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Add language and NSFW filter options**

```typescript
'use client';

import { useState } from 'react';
import { useSettingsStore } from '~/store/useSettingsStore';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore();
  const [languageFilter, setLanguageFilter] = useState('all');
  const [showNsfw, setShowNsfw] = useState(false);

  const handleLanguageChange = (lang: string) => {
    setLanguageFilter(lang);
    updateSettings({ ...settings, languageFilter: lang });
  };

  const handleNsfwToggle = () => {
    const newValue = !showNsfw;
    setShowNsfw(newValue);
    updateSettings({ ...settings, showNsfw: newValue });
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Source Filters</h2>

          <div className="mb-4">
            <label className="block mb-2">Language</label>
            <select
              value={languageFilter}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-800"
            >
              <option value="all">All Languages</option>
              <option value="en">English</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="nsfw"
              checked={showNsfw}
              onChange={handleNsfwToggle}
              className="w-4 h-4"
            />
            <label htmlFor="nsfw">Show NSFW sources</label>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Reader Settings</h2>
          {/* Existing reader settings */}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update AppSettings type to include new fields**

```typescript
// In src/types/index.ts
export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  readerMode: 'vertical-scroll' | 'webtoon' | 'single-page' | 'double-page';
  readingDirection: 'rtl' | 'ltr';
  pageFitMode: 'fit-width' | 'fit-height' | 'original' | 'auto';
  libraryViewMode: 'grid' | 'list';
  brightness: number;
  languageFilter: string;
  showNsfw: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx src/types/index.ts
git commit -m "feat: add source filtering options to settings"
```

---

## Task 8: Update Library Page for Real Source Support

**Files:**
- Modify: `src/app/library/page.tsx`

- [ ] **Step 1: Update library page to use SourceRegistry**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { sourceRegistry } from '~/services/sources';
import { MangaCard } from '~/components/library/MangaCard';
import type { Manga } from '~/types';

export default function LibraryPage() {
  const [manga, setManga] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLibrary();
  }, []);

  async function loadLibrary() {
    try {
      setLoading(true);
      // For now, use mock source for library
      // In future, this will sync with real sources
      const provider = sourceRegistry.get('mock');
      const data = await provider.getPopular(0);
      setManga(data);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-4">Loading library...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Library</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {manga.map(m => (
          <MangaCard key={m.id} manga={m} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/library/page.tsx
git commit -m "feat: update library page to use SourceRegistry"
```

---

## Task 9: Add Error Handling and Fallbacks

**Files:**
- Modify: `src/services/extensions.ts`

- [ ] **Step 1: Add retry logic and better error handling**

```typescript
export class ExtensionService {
  private cache: KeiyoushiExtension[] | null = null;

  async fetchIndex(): Promise<KeiyoushiExtension[]> {
    const cached = this.getCachedIndex();
    if (cached) {
      return cached;
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(KEIYOSHI_INDEX_URL, {
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: KeiyoushiExtension[] = await response.json();
        this.setCachedIndex(data);
        return data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) {
          // Exponential backoff: 1s, 2s
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Failed to fetch Keiyoushi index after retries');
  }

  // ... rest of the class remains the same
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/extensions.ts
git commit -m "feat: add retry logic and timeout to ExtensionService"
```

---

## Task 10: Final Integration Testing

**Files:**
- No file changes

- [ ] **Step 1: Test the complete flow**

```bash
# Start the dev server
npm run dev

# Manual testing checklist:
# 1. Open http://localhost:3000/browse
# 2. Verify sources are loaded from Keiyoushi index
# 3. Select MangaDex source
# 4. Verify real manga data appears
# 5. Click on a manga to view details
# 6. Verify chapters are loaded
# 7. Open a chapter to verify pages load
# 8. Test search functionality
# 9. Test settings page for language/NSFW filters
# 10. Test fallback to mock data when network is disabled
```

- [ ] **Step 2: Commit final changes**

```bash
git add .
git commit -m "feat: complete Keiyoushi extensions integration"
```

---

## Summary

This plan implements the Keiyoushi extensions catalog and MangaDex adapter in 10 tasks:

1. Add SourceProvider interface to types
2. Create ExtensionService for fetching and caching the Keiyoushi index
3. Create SourceRegistry factory for provider management
4. Implement MangaDexProvider with full API integration
5. Register MangaDex provider in the registry
6. Update browse page to use real sources
7. Add source filtering options to settings
8. Update library page for real source support
9. Add error handling and retry logic
10. Final integration testing

Each task is self-contained and can be implemented independently with clear commit boundaries.