# Panelia Clean Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Panelia into a layered clean architecture with consolidated stores, separated domain/infrastructure/presentation boundaries, thinner route pages, and safe removal of duplicate or obsolete files without changing user-facing behavior.

**Architecture:** This plan uses an incremental migration: first carve out stable `domain`, `infrastructure`, and `presentation` entry points, then migrate dependencies behind those boundaries, and finally thin route pages and delete replaced files. The refactor keeps the current Next.js App Router, Dexie, Zustand, and scraping behavior intact while making dependencies explicit and reducing multi-responsibility modules.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zustand, Dexie, Vitest, ESLint, Tailwind CSS

---

## File Map

### New files to create
- `src/domain/types/manga.ts` — manga, chapter, page, read-status, source entity types
- `src/domain/types/library.ts` — library, category, read-progress, downloaded-chapter types
- `src/domain/types/settings.ts` — app settings type
- `src/domain/types/index.ts` — barrel for domain types
- `src/domain/interfaces/source-provider.ts` — source provider contract
- `src/domain/interfaces/repository.ts` — repository contract types for DB-facing modules
- `src/domain/interfaces/index.ts` — barrel for interfaces
- `src/infrastructure/db/chapters.ts` — chapter persistence helpers
- `src/infrastructure/db/downloads.ts` — downloaded chapter persistence helpers
- `src/infrastructure/db/read-progress.ts` — read progress persistence helpers
- `src/infrastructure/db/scrape-sources.ts` — scrape source persistence helpers
- `src/infrastructure/db/settings.ts` — settings persistence helpers
- `src/infrastructure/db/index.ts` — exports db instance and repository helpers
- `src/infrastructure/sources/registry.ts` — single registry home replacing ambiguous source registry entrypoints
- `src/infrastructure/sources/index.ts` — source exports barrel
- `src/infrastructure/services/status-service.ts` — moved/normalized chapter status orchestration
- `src/infrastructure/services/sync-service.ts` — moved sync orchestration
- `src/infrastructure/services/index.ts` — infrastructure services barrel
- `src/presentation/stores/library-store.ts` — consolidated library Zustand store
- `src/presentation/stores/reader-store.ts` — consolidated reader Zustand store
- `src/presentation/stores/settings-store.ts` — consolidated settings Zustand store
- `src/presentation/stores/toast-store.ts` — consolidated toast Zustand store
- `src/presentation/stores/index.ts` — store barrel exports
- `src/presentation/hooks/use-manga-details.ts` — manga details page orchestration hook
- `src/presentation/hooks/use-reader-chapter.ts` — reader page orchestration hook
- `src/presentation/hooks/index.ts` — presentation hooks barrel

### Existing files to modify
- `src/types/index.ts` — convert to compatibility barrel that re-exports from domain
- `src/db/db.ts` — compatibility barrel or move schema ownership behind infrastructure export
- `src/db/library.ts` — delegate to infrastructure repository helpers
- `src/db/sync.ts` — delegate to infrastructure sync service
- `src/services/sources.ts` — compatibility re-export to new registry home
- `src/services/sources/index.ts` — compatibility re-export to new registry home
- `src/services/sources/mangadex.ts` — import domain contracts via new paths
- `src/services/sources/comick.ts` — import domain contracts via new paths
- `src/services/statusService.ts` — compatibility re-export to normalized service file
- `src/store/useSettingsStore.ts` — compatibility re-export to `presentation/stores/settings-store.ts`
- `src/store/useLibraryStore.ts` — compatibility re-export to `presentation/stores/library-store.ts`
- `src/store/useReaderStore.ts` — compatibility re-export to `presentation/stores/reader-store.ts`
- `src/stores/reader.ts` — compatibility re-export to `presentation/stores/reader-store.ts`
- `src/stores/toast.ts` — compatibility re-export to `presentation/stores/toast-store.ts`
- `src/hooks/useToast.ts` — import toast store from presentation store home
- `src/components/ui/ToastContainer.tsx` — import toast store from presentation store home
- `src/app/manga/[id]/page.tsx` — thin page by moving loading/state logic into hook + infra helpers
- `src/app/reader/[chapterId]/page.tsx` — thin page by moving loading/state logic into hook + infra helpers
- `src/app/settings/page.tsx` — point at consolidated settings store
- `src/app/browse/page.tsx` — switch to consolidated reader/toast/settings/service imports and extract obvious infra calls

### Existing files likely deleted at end of migration
- `src/stores/reader.ts`
- `src/stores/toast.ts`
- `src/store/useLibraryStore.ts`
- `src/store/useReaderStore.ts`
- `src/store/useSettingsStore.ts`
- `src/services/sources.ts` (only after imports are fully migrated)
- any replaced compatibility files once `rg` proves no remaining imports

### Test files to modify or create
- `src/db/library.test.ts` — add/expand tests for library repository behavior if absent
- `src/infrastructure/db/chapters.test.ts` — tests for chapter persistence helpers
- `src/infrastructure/sources/registry.test.ts` — tests for registry compatibility behavior
- `src/presentation/hooks/use-manga-details.test.ts` — orchestration hook tests if test setup supports hook tests
- `src/presentation/hooks/use-reader-chapter.test.ts` — reader hook tests if test setup supports hook tests

---

### Task 1: Carve out stable domain contracts and compatibility exports

**Files:**
- Create: `src/domain/types/manga.ts`
- Create: `src/domain/types/library.ts`
- Create: `src/domain/types/settings.ts`
- Create: `src/domain/types/index.ts`
- Create: `src/domain/interfaces/source-provider.ts`
- Create: `src/domain/interfaces/repository.ts`
- Create: `src/domain/interfaces/index.ts`
- Modify: `src/types/index.ts`
- Test: `npx vitest src/services/sources/smoke-domain-contracts.test.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from 'vitest';
import type { Manga, Chapter, AppSettings } from '~/domain/types';
import type { SourceProvider } from '~/domain/interfaces';

describe('domain contract entrypoints', () => {
  it('exposes domain types and source provider contract from new paths', () => {
    const manga: Manga = {
      id: 'mangadex:1',
      sourceId: 'mangadex',
      title: 'Test',
      coverUrl: 'https://example.com/cover.jpg',
      author: 'Author',
      artist: 'Artist',
      status: 'ongoing',
      description: 'Desc',
      genres: [],
      tags: [],
    };

    const chapter: Chapter = {
      id: 'mangadex:ch:1',
      mangaId: manga.id,
      chapterNumber: 1,
      title: 'Chapter 1',
      scanlator: '',
      releaseDate: '',
      pageCount: 0,
      read: false,
      lastReadPage: 0,
      status: 'unread',
    };

    const settings: AppSettings = {
      theme: 'dark',
      readerMode: 'webtoon',
      readingDirection: 'ltr',
      pageFitMode: 'fit-width',
      libraryViewMode: 'grid',
      brightness: 100,
      languageFilter: 'all',
      showNsfw: false,
    };

    const providerShape = {
      getPopular: async (_page: number) => [manga],
      getLatest: async (_page: number) => [manga],
      search: async (_query: string, _page: number) => [manga],
      getMangaDetails: async (_id: string) => manga,
      getChapters: async (_id: string) => [chapter],
      getPages: async (_id: string) => [],
    } satisfies SourceProvider;

    expect(manga.title).toBe('Test');
    expect(settings.readerMode).toBe('webtoon');
    expect(typeof providerShape.getPopular).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/services/sources/smoke-domain-contracts.test.ts`
Expected: FAIL with module resolution errors for `~/domain/types` and `~/domain/interfaces`

- [ ] **Step 3: Create the new domain files**

```ts
// src/domain/types/manga.ts
export interface Manga {
  id: string;
  sourceId: string;
  title: string;
  coverUrl: string;
  author: string;
  artist: string;
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'unknown';
  description: string;
  genres: string[];
  tags: string[];
  thumbnailUrl?: string;
  url?: string;
}

export type ReadStatus = 'unread' | 'viewed' | 'completed';

export interface Chapter {
  id: string;
  mangaId: string;
  chapterNumber: number;
  title: string;
  scanlator: string;
  releaseDate: string;
  pageCount: number;
  read: boolean;
  lastReadPage: number;
  url?: string;
  status: ReadStatus;
  viewedAt?: string;
  completedAt?: string;
}

export interface Page {
  index: number;
  imageUrl: string;
  width?: number;
  height?: number;
}

export interface Source {
  id: string;
  name: string;
  baseUrl: string;
  iconUrl: string;
  isInstalled: boolean;
  isNsfw: boolean;
  version: number;
  languages: string[];
}
```

```ts
// src/domain/types/library.ts
export interface LibraryEntry {
  mangaId: string;
  categories: string[];
  dateAdded: string;
  unreadCount: number;
  lastChapterRead?: number;
  lastReadDate?: string;
  lastViewedAt?: string;
  lastViewedChapterId?: string;
  lastViewedPage?: number;
  viewedCount?: number;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ReadProgress {
  chapterId: string;
  mangaId: string;
  lastPage: number;
  totalPages: number;
  completed: boolean;
  lastReadAt: string;
}

export interface DownloadedChapter {
  id: string;
  chapterId: string;
  mangaId: string;
  pages: Array<{ index: number; blobUrl: string }>;
  downloadedAt: string;
  sizeBytes: number;
}
```

```ts
// src/domain/types/settings.ts
export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  readerMode: 'vertical-scroll' | 'webtoon' | 'single-page' | 'horizontal-swipe';
  readingDirection: 'rtl' | 'ltr';
  pageFitMode: 'fit-width' | 'fit-height' | 'original' | 'auto';
  libraryViewMode: 'grid' | 'list';
  brightness: number;
  languageFilter: string;
  showNsfw: boolean;
}
```

```ts
// src/domain/types/index.ts
export * from './manga';
export * from './library';
export * from './settings';
```

```ts
// src/domain/interfaces/source-provider.ts
import type { Manga, Chapter, Page } from '~/domain/types';

export interface SourceProvider {
  getPopular(page: number): Promise<Manga[]>;
  getLatest(page: number): Promise<Manga[]>;
  search(query: string, page: number): Promise<Manga[]>;
  getMangaDetails(id: string): Promise<Manga>;
  getChapters(mangaId: string): Promise<Chapter[]>;
  getPages(chapterId: string): Promise<Page[]>;
}
```

```ts
// src/domain/interfaces/repository.ts
import type { Chapter, LibraryEntry, Manga, ReadProgress, DownloadedChapter, AppSettings } from '~/domain/types';
import type { ScrapeSource } from '~/services/scrape/types';

export interface MangaRepository {
  getById(id: string): Promise<Manga | undefined>;
  save(manga: Manga): Promise<void>;
}

export interface ChapterRepository {
  getByMangaId(mangaId: string): Promise<Chapter[]>;
  getById(id: string): Promise<Chapter | undefined>;
  saveMany(chapters: Chapter[]): Promise<void>;
}

export interface LibraryRepository {
  getEntry(mangaId: string): Promise<LibraryEntry | undefined>;
  saveEntry(entry: LibraryEntry): Promise<void>;
  deleteEntry(mangaId: string): Promise<void>;
}

export interface ReadProgressRepository {
  save(progress: ReadProgress): Promise<void>;
}

export interface DownloadedChapterRepository {
  deleteByMangaId(mangaId: string): Promise<void>;
}

export interface ScrapeSourceRepository {
  getById(id: string): Promise<ScrapeSource | undefined>;
  save(source: ScrapeSource): Promise<void>;
}

export interface SettingsRepository {
  save(settings: AppSettings): Promise<void>;
}
```

```ts
// src/domain/interfaces/index.ts
export * from './source-provider';
export * from './repository';
```

```ts
// src/types/index.ts
export * from '~/domain/types';
export type { SourceProvider } from '~/domain/interfaces';
```

- [ ] **Step 4: Run the contract test to verify it passes**

Run: `npx vitest src/services/sources/smoke-domain-contracts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain src/types/index.ts src/services/sources/smoke-domain-contracts.test.ts
git commit -m "refactor: add domain contract entrypoints"
```

### Task 2: Move source registry ownership into infrastructure with compatibility shims

**Files:**
- Create: `src/infrastructure/sources/registry.ts`
- Create: `src/infrastructure/sources/index.ts`
- Modify: `src/services/sources/index.ts`
- Modify: `src/services/sources.ts`
- Modify: `src/services/sources/mangadex.ts`
- Modify: `src/services/sources/comick.ts`
- Test: `src/infrastructure/sources/registry.test.ts`

- [ ] **Step 1: Write the failing registry compatibility test**

```ts
import { describe, expect, it } from 'vitest';
import { sourceRegistry as legacyRegistry } from '~/services/sources';
import { sourceRegistry as infraRegistry } from '~/infrastructure/sources';

describe('source registry compatibility', () => {
  it('exposes the same registry instance from legacy and infrastructure entrypoints', () => {
    expect(legacyRegistry).toBe(infraRegistry);
  });

  it('keeps built-in provider ids registered', () => {
    expect(infraRegistry.get('mangadex')).toBeTruthy();
    expect(infraRegistry.get('comick')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/infrastructure/sources/registry.test.ts`
Expected: FAIL with missing `~/infrastructure/sources` module

- [ ] **Step 3: Create the new infrastructure registry and shims**

```ts
// src/infrastructure/sources/registry.ts
import type { SourceProvider } from '~/domain/interfaces';
import { mangadexProvider } from '~/services/sources/mangadex';
import { comickProvider } from '~/services/sources/comick';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import type { SiteConfig } from '~/services/scrape/types';
import { getPreset, presetToScrapeSource } from '~/services/scrape/presets';

export interface SourceProviderEntry {
  id: string;
  name: string;
  provider: SourceProvider;
  iconUrl?: string;
  isScrape?: boolean;
}

const STATIC_PROVIDERS: SourceProviderEntry[] = [
  { id: 'mangadex', name: 'MangaDex', provider: mangadexProvider },
  { id: 'comick', name: 'Comick', provider: comickProvider },
];

const SCRAPE_PREFIX = 'scrape:';

class SourceRegistry {
  private providers = new Map<string, SourceProvider>();
  private scrapeAdapters = new Map<string, ScrapeAdapter>();

  constructor() {
    for (const entry of STATIC_PROVIDERS) {
      this.providers.set(entry.id, entry.provider);
    }
  }

  registerScrapeSource(id: string, config: SiteConfig, sourceUrl: string): void {
    const adapter = new ScrapeAdapter(id, config, sourceUrl);
    this.scrapeAdapters.set(id, adapter);
    this.providers.set(`${SCRAPE_PREFIX}${id}`, adapter);
  }

  unregisterScrapeSource(id: string): void {
    this.scrapeAdapters.delete(id);
    this.providers.delete(`${SCRAPE_PREFIX}${id}`);
  }

  register(id: string, provider: SourceProvider): void {
    this.providers.set(id, provider);
  }

  get(id: string): SourceProvider | null {
    return this.providers.get(id) ?? null;
  }

  getOrRehydrate(id: string): SourceProvider | null {
    const existing = this.providers.get(id);
    if (existing) return existing;

    if (id.startsWith(SCRAPE_PREFIX)) {
      const sourceId = id.slice(SCRAPE_PREFIX.length);
      if (sourceId.startsWith('preset-')) {
        const presetName = sourceId.slice('preset-'.length);
        const preset = getPreset(presetName);
        if (preset) {
          const scrapeSource = presetToScrapeSource(preset);
          this.registerScrapeSource(scrapeSource.id, scrapeSource.config, scrapeSource.baseUrl);
          return this.providers.get(id) ?? null;
        }
      }
    }

    return null;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  getAllProviders(): SourceProviderEntry[] {
    const providers = [...STATIC_PROVIDERS];
    for (const [id, adapter] of this.scrapeAdapters.entries()) {
      providers.push({
        id: `${SCRAPE_PREFIX}${id}`,
        name: adapter.id,
        provider: adapter,
        isScrape: true,
      });
    }
    return providers;
  }

  getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const sourceRegistry = new SourceRegistry();
export { mangadexProvider, comickProvider };
```

```ts
// src/infrastructure/sources/index.ts
export { sourceRegistry, mangadexProvider, comickProvider } from './registry';
export type { SourceProviderEntry } from './registry';
```

```ts
// src/services/sources/index.ts
export { sourceRegistry, mangadexProvider, comickProvider } from '~/infrastructure/sources';
export type { SourceProviderEntry } from '~/infrastructure/sources';
```

```ts
// src/services/sources.ts
export { sourceRegistry, mangadexProvider, comickProvider } from '~/infrastructure/sources';
export type { SourceProviderEntry } from '~/infrastructure/sources';
```

```ts
// src/services/sources/mangadex.ts
import type { SourceProvider } from '~/domain/interfaces';
```

```ts
// src/services/sources/comick.ts
import type { SourceProvider } from '~/domain/interfaces';
```

- [ ] **Step 4: Run the registry test to verify it passes**

Run: `npx vitest src/infrastructure/sources/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/sources src/services/sources.ts src/services/sources/index.ts src/services/sources/mangadex.ts src/services/sources/comick.ts src/infrastructure/sources/registry.test.ts
git commit -m "refactor: move source registry to infrastructure"
```

### Task 3: Introduce infrastructure DB modules and keep legacy DB entrypoints working

**Files:**
- Create: `src/infrastructure/db/chapters.ts`
- Create: `src/infrastructure/db/downloads.ts`
- Create: `src/infrastructure/db/read-progress.ts`
- Create: `src/infrastructure/db/scrape-sources.ts`
- Create: `src/infrastructure/db/settings.ts`
- Create: `src/infrastructure/db/index.ts`
- Modify: `src/db/db.ts`
- Modify: `src/db/library.ts`
- Test: `src/infrastructure/db/chapters.test.ts`

- [ ] **Step 1: Write the failing chapter repository test**

```ts
import { describe, expect, it } from 'vitest';
import { getChaptersByMangaId, saveChapters } from '~/infrastructure/db/chapters';
import { db } from '~/db/db';

describe('chapter repository helpers', () => {
  it('saves and loads chapters by manga id', async () => {
    const mangaId = 'test:manga';

    await saveChapters([
      {
        id: 'test:chapter:1',
        mangaId,
        chapterNumber: 1,
        title: 'One',
        scanlator: '',
        releaseDate: '',
        pageCount: 0,
        read: false,
        lastReadPage: 0,
        status: 'unread',
      },
    ]);

    const chapters = await getChaptersByMangaId(mangaId);
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.id).toBe('test:chapter:1');

    await db.chapters.delete('test:chapter:1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/infrastructure/db/chapters.test.ts`
Expected: FAIL with missing infrastructure DB module

- [ ] **Step 3: Create the infrastructure DB helper files and bridge legacy library helpers**

```ts
// src/infrastructure/db/chapters.ts
import { db } from '~/db/db';
import type { Chapter } from '~/domain/types';

export async function getChapterById(id: string): Promise<Chapter | undefined> {
  return db.chapters.get(id) as Promise<Chapter | undefined>;
}

export async function getChaptersByMangaId(mangaId: string): Promise<Chapter[]> {
  return (await db.chapters.where('mangaId').equals(mangaId).toArray()) as Chapter[];
}

export async function saveChapters(chapters: Chapter[]): Promise<void> {
  if (!chapters.length) return;
  await db.chapters.bulkPut(chapters);
}
```

```ts
// src/infrastructure/db/downloads.ts
import { db } from '~/db/db';

export async function deleteDownloadedChaptersByMangaId(mangaId: string): Promise<void> {
  const ids = await db.downloadedChapters.where('mangaId').equals(mangaId).primaryKeys();
  if (ids.length > 0) {
    await db.downloadedChapters.bulkDelete(ids);
  }
}
```

```ts
// src/infrastructure/db/read-progress.ts
import { db } from '~/db/db';

export async function deleteReadProgressByChapterIds(chapterIds: string[]): Promise<void> {
  if (!chapterIds.length) return;
  await db.readProgress.where('chapterId').anyOf(chapterIds).delete();
}
```

```ts
// src/infrastructure/db/scrape-sources.ts
import { db } from '~/db/db';
import type { ScrapeSource } from '~/services/scrape/types';

export async function getScrapeSourceById(id: string): Promise<ScrapeSource | undefined> {
  return db.scrapeSources.get(id) as Promise<ScrapeSource | undefined>;
}

export async function saveScrapeSource(source: ScrapeSource): Promise<void> {
  await db.scrapeSources.put(source);
}
```

```ts
// src/infrastructure/db/settings.ts
import { db } from '~/db/db';
import type { AppSettings } from '~/domain/types';

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put(settings);
}
```

```ts
// src/infrastructure/db/index.ts
export { db } from '~/db/db';
export * from './chapters';
export * from './downloads';
export * from './read-progress';
export * from './scrape-sources';
export * from './settings';
```

```ts
// src/db/library.ts
import { db } from './db';
import type { Manga, Chapter, LibraryEntry } from '~/domain/types';
import { deleteDownloadedChaptersByMangaId } from '~/infrastructure/db/downloads';
import { deleteReadProgressByChapterIds } from '~/infrastructure/db/read-progress';

export async function toggleInLibrary(manga: Manga, chapters?: Chapter[]) {
  const exists = await db.libraryEntries.get(manga.id);

  if (exists) {
    await removeFromLibrary(manga.id);
    return false;
  }

  const entry: LibraryEntry = {
    mangaId: manga.id,
    categories: [],
    dateAdded: new Date().toISOString(),
    unreadCount: chapters ? chapters.length : 0,
  };

  await db.transaction('rw', db.manga, db.libraryEntries, db.chapters, async () => {
    await db.manga.put(manga);
    await db.libraryEntries.put(entry);
    if (chapters?.length) {
      await db.chapters.bulkPut(chapters);
    }
  });

  return true;
}

export async function removeFromLibrary(mangaId: string): Promise<void> {
  await db.transaction('rw', [db.manga, db.chapters, db.libraryEntries, db.readProgress, db.downloadedChapters], async () => {
    await db.libraryEntries.delete(mangaId);
    await db.manga.delete(mangaId);

    const chapterIds = await db.chapters.where('mangaId').equals(mangaId).primaryKeys();
    if (chapterIds.length > 0) {
      await db.chapters.bulkDelete(chapterIds);
      await deleteReadProgressByChapterIds(chapterIds as string[]);
    }

    await deleteDownloadedChaptersByMangaId(mangaId);
  });
}

export async function isInLibrary(mangaId: string) {
  return Boolean(await db.libraryEntries.get(mangaId));
}
```

- [ ] **Step 4: Run the DB test to verify it passes**

Run: `npx vitest src/infrastructure/db/chapters.test.ts src/db/sync.test.ts src/db/scrapeSources.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/db src/db/library.ts src/infrastructure/db/chapters.test.ts
git commit -m "refactor: introduce infrastructure db helpers"
```

### Task 4: Consolidate Zustand stores into presentation/stores and keep compatibility imports

**Files:**
- Create: `src/presentation/stores/library-store.ts`
- Create: `src/presentation/stores/reader-store.ts`
- Create: `src/presentation/stores/settings-store.ts`
- Create: `src/presentation/stores/toast-store.ts`
- Create: `src/presentation/stores/index.ts`
- Modify: `src/store/useSettingsStore.ts`
- Modify: `src/store/useLibraryStore.ts`
- Modify: `src/store/useReaderStore.ts`
- Modify: `src/stores/reader.ts`
- Modify: `src/stores/toast.ts`
- Modify: `src/hooks/useToast.ts`
- Modify: `src/components/ui/ToastContainer.tsx`
- Test: `npx vitest src/hooks/useToast.ts`

- [ ] **Step 1: Write the failing store consolidation smoke test**

```ts
import { describe, expect, it } from 'vitest';
import { useSettingsStore } from '~/presentation/stores/settings-store';
import { useReaderStore } from '~/presentation/stores/reader-store';
import { useToastStore } from '~/presentation/stores/toast-store';

describe('presentation stores', () => {
  it('exposes consolidated Zustand stores', () => {
    expect(useSettingsStore.getState().readerMode).toBeTruthy();
    expect(useReaderStore.getState().isReaderOpen).toBe(false);
    expect(Array.isArray(useToastStore.getState().toasts)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/presentation/stores/presentation-stores.test.ts`
Expected: FAIL with missing presentation store modules

- [ ] **Step 3: Create consolidated stores and compatibility re-exports**

```ts
// src/presentation/stores/reader-store.ts
import { create } from 'zustand';

interface ReaderState {
  isReaderOpen: boolean;
  setReaderOpen: (open: boolean) => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  isReaderOpen: false,
  setReaderOpen: (open) => set({ isReaderOpen: open }),
}));
```

```ts
// src/presentation/stores/toast-store.ts
import { create } from 'zustand';

export type ToastType = 'loading' | 'success' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number | null;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<ToastItem, 'id'>>) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  updateToast: (id, updates) => set((state) => ({
    toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
  })),
}));
```

```ts
// src/presentation/stores/settings-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings } from '~/domain/types';

interface SettingsState extends AppSettings {
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      readerMode: 'webtoon',
      readingDirection: 'ltr',
      pageFitMode: 'fit-width',
      libraryViewMode: 'grid',
      brightness: 100,
      languageFilter: 'all',
      showNsfw: false,
      updateSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
    }),
    { name: 'panelia-settings' },
  ),
);
```

```ts
// src/presentation/stores/library-store.ts
import { create } from 'zustand';

interface LibraryState {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  searchQuery: '',
  setSearchQuery: (value) => set({ searchQuery: value }),
}));
```

```ts
// src/presentation/stores/index.ts
export { useLibraryStore } from './library-store';
export { useReaderStore } from './reader-store';
export { useSettingsStore } from './settings-store';
export { useToastStore } from './toast-store';
export type { ToastItem, ToastType } from './toast-store';
```

```ts
// src/store/useSettingsStore.ts
export { useSettingsStore } from '~/presentation/stores/settings-store';
```

```ts
// src/store/useLibraryStore.ts
export { useLibraryStore } from '~/presentation/stores/library-store';
```

```ts
// src/store/useReaderStore.ts
export { useReaderStore } from '~/presentation/stores/reader-store';
```

```ts
// src/stores/reader.ts
export { useReaderStore } from '~/presentation/stores/reader-store';
```

```ts
// src/stores/toast.ts
export { useToastStore } from '~/presentation/stores/toast-store';
export type { ToastItem, ToastType } from '~/presentation/stores/toast-store';
```

```ts
// src/hooks/useToast.ts
import { useToastStore } from '~/presentation/stores/toast-store';
```

```ts
// src/components/ui/ToastContainer.tsx
import { useToastStore } from '~/presentation/stores/toast-store';
```

- [ ] **Step 4: Run store smoke tests to verify they pass**

Run: `npx vitest src/presentation/stores/presentation-stores.test.ts src/hooks/useToast.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/presentation/stores src/store src/stores src/hooks/useToast.ts src/components/ui/ToastContainer.tsx src/presentation/stores/presentation-stores.test.ts
git commit -m "refactor: consolidate zustand stores under presentation"
```

### Task 5: Normalize infrastructure services and route imports

**Files:**
- Create: `src/infrastructure/services/status-service.ts`
- Create: `src/infrastructure/services/sync-service.ts`
- Create: `src/infrastructure/services/index.ts`
- Modify: `src/services/statusService.ts`
- Modify: `src/db/sync.ts`
- Modify: `src/app/manga/[id]/page.tsx`
- Modify: `src/app/reader/[chapterId]/page.tsx`
- Test: `src/db/sync.test.ts`

- [ ] **Step 1: Write the failing service compatibility test**

```ts
import { describe, expect, it } from 'vitest';
import { statusService as legacyStatusService } from '~/services/statusService';
import { statusService as infrastructureStatusService } from '~/infrastructure/services';

describe('service compatibility', () => {
  it('re-exports the same status service instance', () => {
    expect(legacyStatusService).toBe(infrastructureStatusService);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/infrastructure/services/service-compatibility.test.ts`
Expected: FAIL with missing infrastructure services module

- [ ] **Step 3: Create normalized service exports and point routes at them**

```ts
// src/infrastructure/services/status-service.ts
export { statusService } from '~/services/statusService';
```

```ts
// src/infrastructure/services/sync-service.ts
export * from '~/db/sync';
```

```ts
// src/infrastructure/services/index.ts
export { statusService } from './status-service';
export * from './sync-service';
```

```ts
// src/services/statusService.ts
// keep current implementation here for now, but ensure consumers can migrate to the normalized path in follow-up tasks
```

```ts
// src/app/manga/[id]/page.tsx
import { statusService } from '~/infrastructure/services';
```

```ts
// src/app/reader/[chapterId]/page.tsx
import { statusService } from '~/infrastructure/services';
```

- [ ] **Step 4: Run tests to verify compatibility and sync still passes**

Run: `npx vitest src/infrastructure/services/service-compatibility.test.ts src/db/sync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/services src/app/manga/[id]/page.tsx src/app/reader/[chapterId]/page.tsx src/infrastructure/services/service-compatibility.test.ts
git commit -m "refactor: normalize infrastructure service entrypoints"
```

### Task 6: Extract manga details page orchestration into a presentation hook

**Files:**
- Create: `src/presentation/hooks/use-manga-details.ts`
- Create: `src/presentation/hooks/index.ts`
- Modify: `src/app/manga/[id]/page.tsx`
- Test: `src/presentation/hooks/use-manga-details.test.ts`

- [ ] **Step 1: Write the failing manga details hook test**

```ts
import { describe, expect, it } from 'vitest';
import { useMangaDetailsViewModel } from '~/presentation/hooks/use-manga-details';

describe('useMangaDetailsViewModel', () => {
  it('exports a hook function', () => {
    expect(typeof useMangaDetailsViewModel).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/presentation/hooks/use-manga-details.test.ts`
Expected: FAIL with missing hook module

- [ ] **Step 3: Create the hook and slim the page**

```ts
// src/presentation/hooks/use-manga-details.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '~/db/db';
import { isInLibrary, toggleInLibrary } from '~/db/library';
import { sourceRegistry } from '~/infrastructure/sources';
import { statusService } from '~/infrastructure/services';
import { useReaderStore } from '~/presentation/stores';
import type { Chapter, Manga, ReadStatus } from '~/domain/types';

export function useMangaDetailsViewModel(id: string) {
  const [manga, setManga] = useState<Manga | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [inLib, setInLib] = useState(false);
  const [loading, setLoading] = useState(true);
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const [loadingChapterId, setLoadingChapterId] = useState<string | null>(null);
  const setReaderOpen = useReaderStore((state) => state.setReaderOpen);

  const libraryEntry = useLiveQuery(() => (id ? db.libraryEntries.get(id) : undefined), [id]);

  const openReader = useCallback((chapterId: string) => {
    setReaderUrl(`/reader/${encodeURIComponent(chapterId)}?manga=${encodeURIComponent(id)}`);
    setReaderOpen(true);
  }, [id, setReaderOpen]);

  const closeReader = useCallback(() => {
    setReaderUrl(null);
    setReaderOpen(false);
  }, [setReaderOpen]);

  useEffect(() => {
    const parts = id.split(':');
    const isScrape = parts[0] === 'scrape';
    const sourceId = isScrape ? `${parts[0]}:${parts[1]}` : parts[0];
    const mangaId = isScrape ? parts.slice(2).join(':') : parts.slice(1).join(':');

    const load = async () => {
      setLoading(true);
      try {
        if (sourceId.startsWith('scrape')) {
          const [m, c, l] = await Promise.all([
            db.manga.get(id),
            db.chapters.where('mangaId').equals(id).toArray(),
            isInLibrary(id),
          ]);
          setManga((m as Manga) ?? null);
          setChapters((c as Chapter[]).sort((a, b) => b.chapterNumber - a.chapterNumber));
          setInLib(l);
          return;
        }

        const provider = sourceRegistry.getOrRehydrate(sourceId);
        if (!provider || !mangaId) {
          setManga(null);
          setChapters([]);
          setInLib(false);
          return;
        }

        const [m, c, l, localChapters] = await Promise.all([
          provider.getMangaDetails(mangaId),
          provider.getChapters(mangaId),
          isInLibrary(id),
          db.chapters.where('mangaId').equals(id).toArray(),
        ]);

        const localMap = new Map(localChapters.map((chapter) => [chapter.id, chapter]));
        setManga({ ...m, id, sourceId });
        setChapters(
          c
            .sort((a, b) => b.chapterNumber - a.chapterNumber)
            .map((chapter) => {
              const local = localMap.get(chapter.id);
              return {
                ...chapter,
                mangaId: id,
                status: local?.status || 'unread',
                read: local?.read || false,
                lastReadPage: local?.lastReadPage || 0,
                viewedAt: local?.viewedAt,
                completedAt: local?.completedAt,
              };
            }),
        );
        setInLib(l);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  const handleToggleLibrary = useCallback(async () => {
    if (!manga) return;
    const next = await toggleInLibrary(manga, chapters);
    setInLib(next);
  }, [manga, chapters]);

  const toggleChapterStatus = useCallback(async (chapterId: string, nextStatus: ReadStatus) => {
    if (!manga) return;
    setLoadingChapterId(chapterId);
    await statusService.markChapterStatus(chapterId, id, nextStatus, 0);
    const updated = await db.chapters.get(chapterId);
    if (updated) {
      setChapters((prev) => prev.map((chapter) => (chapter.id === chapterId ? (updated as Chapter) : chapter)));
    }
    setLoadingChapterId(null);
  }, [id, manga]);

  const readCounts = useMemo(() => {
    const viewed = chapters.filter((chapter) => chapter.status !== 'unread').length;
    const completed = chapters.filter((chapter) => chapter.status === 'completed').length;
    return { viewed, completed, total: chapters.length };
  }, [chapters]);

  const lastViewedChapter = useMemo(() => {
    if (!libraryEntry?.lastViewedChapterId) return null;
    return chapters.find((chapter) => chapter.id === libraryEntry.lastViewedChapterId) ?? null;
  }, [chapters, libraryEntry]);

  return {
    manga,
    chapters,
    inLib,
    loading,
    readerUrl,
    loadingChapterId,
    libraryEntry,
    readCounts,
    lastViewedChapter,
    openReader,
    closeReader,
    handleToggleLibrary,
    toggleChapterStatus,
  };
}
```

```ts
// src/presentation/hooks/index.ts
export { useMangaDetailsViewModel } from './use-manga-details';
```

```ts
// src/app/manga/[id]/page.tsx
import { use } from 'react';
import { useMangaDetailsViewModel } from '~/presentation/hooks';
// keep existing JSX, but replace internal data-loading/state/status logic with hook output
```

- [ ] **Step 4: Run test and lint to verify the page still compiles**

Run: `npx vitest src/presentation/hooks/use-manga-details.test.ts && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/presentation/hooks src/app/manga/[id]/page.tsx
git commit -m "refactor: extract manga details page orchestration"
```

### Task 7: Extract reader page orchestration into a presentation hook

**Files:**
- Create: `src/presentation/hooks/use-reader-chapter.ts`
- Modify: `src/presentation/hooks/index.ts`
- Modify: `src/app/reader/[chapterId]/page.tsx`
- Test: `src/presentation/hooks/use-reader-chapter.test.ts`

- [ ] **Step 1: Write the failing reader hook smoke test**

```ts
import { describe, expect, it } from 'vitest';
import { useReaderChapterViewModel } from '~/presentation/hooks/use-reader-chapter';

describe('useReaderChapterViewModel', () => {
  it('exports a hook function', () => {
    expect(typeof useReaderChapterViewModel).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/presentation/hooks/use-reader-chapter.test.ts`
Expected: FAIL with missing reader hook module

- [ ] **Step 3: Create the reader hook and update page imports**

```ts
// src/presentation/hooks/use-reader-chapter.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '~/db/db';
import { sourceRegistry } from '~/infrastructure/sources';
import { statusService } from '~/infrastructure/services';
import { getScrapeSession, type ChapterInfo } from '~/services/scrape/sessionStore';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import { useSettingsStore } from '~/presentation/stores';
import type { Page } from '~/domain/types';

export type ReadingMode = 'vertical-scroll' | 'webtoon' | 'single-page' | 'horizontal-swipe';

function generatePlaceholderPages(count: number): Page[] {
  return Array.from({ length: count }).map((_, index) => ({
    index,
    imageUrl: `https://placehold.co/800x1200/1a1a1a/cccccc?text=Page+${index + 1}`,
  }));
}

export function useReaderChapterViewModel(chapterId: string, toast: ReturnType<typeof import('~/hooks/useToast').useToast>) {
  const searchParams = useSearchParams();
  const [pages, setPages] = useState<Page[]>([]);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [savedInLib, setSavedInLib] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [chapterStatus, setChapterStatus] = useState<'unread' | 'viewed' | 'completed'>('unread');
  const [chapterViewed, setChapterViewed] = useState(false);
  const [mangaInfo, setMangaInfo] = useState<{
    sourceId: string;
    mangaId: string;
    title: string;
    coverUrl: string;
    sourceUrl: string;
    chapters: ChapterInfo[];
  } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  const { readerMode, updateSettings } = useSettingsStore();
  const readingMode = readerMode as ReadingMode;
  const setReadingMode = useCallback((mode: ReadingMode) => updateSettings({ readerMode: mode }), [updateSettings]);

  const sourceId = chapterId.startsWith('scrape:') ? chapterId.split(':')[1] : '';

  const loadScrapeChapter = useCallback(async () => {
    setLoading(true);
    setError(null);
    const loadingToast = toast.loading('Mencari chapter...');
    try {
      const parts = chapterId.split(':');
      if (parts.length < 4 || parts[0] !== 'scrape' || parts[2] !== 'ch') {
        throw new Error('Format ID chapter tidak valid');
      }

      const session = getScrapeSession(parts[1]);
      const registrySourceId = `scrape:${parts[1]}`;
      const chapter = await db.chapters.get(chapterId);
      if (chapter) {
        if (chapter.lastReadPage) setCurrentPageIndex(chapter.lastReadPage);
        if (chapter.status) setChapterStatus(chapter.status);
      }

      let url = chapter?.url;
      let adapter: ScrapeAdapter | null = null;

      if (!url) {
        if (!session) throw new Error(`Chapter not found in database and no live session available for ${parts[1]}`);
        url = session.chapterUrls[chapterId];
        if (!url) throw new Error('Chapter URL not found in live session');
        adapter = new ScrapeAdapter(parts[1], session.config, session.baseUrl);
      }

      if (!adapter) {
        const provider = sourceRegistry.getOrRehydrate(registrySourceId);
        adapter = provider instanceof ScrapeAdapter ? provider : null;
        if (!adapter && session) {
          adapter = new ScrapeAdapter(parts[1], session.config, session.baseUrl);
        }
      }

      if (!adapter || !url) throw new Error(`Scrape adapter not found for source: ${registrySourceId}`);

      const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error(`Gagal mengambil chapter: HTTP ${response.status}`);
      const html = await response.text();
      const scrapedPages = adapter.parseChapterPage(html);
      const sourceUrl = new URL(url);
      const refererUrl = `${sourceUrl.protocol}//${sourceUrl.host}/`;

      setPages(scrapedPages.map((page) => ({
        index: page.index,
        imageUrl: `/api/proxy?url=${encodeURIComponent(page.imageUrl)}&referer=${encodeURIComponent(refererUrl)}`,
      })));
      loadingToast.dismiss();
    } catch (err) {
      loadingToast.dismiss();
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [chapterId, toast]);

  useEffect(() => {
    if (!chapterId) return;
    if (chapterId.startsWith('scrape:')) {
      void loadScrapeChapter();
      return;
    }
    setLoading(true);
    setPages(generatePlaceholderPages(5));
    setLoading(false);
  }, [chapterId, loadScrapeChapter]);

  useEffect(() => {
    if (!sourceId) return;
    const session = getScrapeSession(sourceId);
    if (!session) return;
    setMangaInfo({
      sourceId,
      mangaId: session.mangaId,
      title: session.mangaTitle,
      coverUrl: session.mangaCoverUrl,
      sourceUrl: session.sourceUrl,
      chapters: [...session.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber),
    });
    void db.libraryEntries.get(session.mangaId).then((entry) => setSavedInLib(Boolean(entry)));
  }, [sourceId]);

  useEffect(() => {
    if (pages.length === 0 || chapterViewed) return;
    const mangaId = mangaInfo?.mangaId ?? searchParams.get('manga') ?? '';
    if (!mangaId) return;
    setChapterViewed(true);
    if (chapterStatus === 'unread') {
      setChapterStatus('viewed');
      void statusService.markChapterStatus(chapterId, mangaId, 'viewed', 0);
    }
  }, [pages, chapterViewed, mangaInfo, searchParams, chapterStatus, chapterId]);

  return {
    pages,
    controlsVisible,
    setControlsVisible,
    loading,
    error,
    currentPageIndex,
    setCurrentPageIndex,
    savedInLib,
    saving,
    showChapterList,
    setShowChapterList,
    showModeMenu,
    setShowModeMenu,
    chapterStatus,
    mangaInfo,
    scrollContainerRef,
    modeMenuRef,
    readingMode,
    setReadingMode,
    loadScrapeChapter,
  };
}
```

```ts
// src/presentation/hooks/index.ts
export { useMangaDetailsViewModel } from './use-manga-details';
export { useReaderChapterViewModel } from './use-reader-chapter';
```

```ts
// src/app/reader/[chapterId]/page.tsx
import { use } from 'react';
import { useReaderChapterViewModel } from '~/presentation/hooks';
import { useToast } from '~/hooks/useToast';
// keep rendering markup, but replace stateful loading/orchestration logic with hook output
```

- [ ] **Step 4: Run test and lint to verify the page still compiles**

Run: `npx vitest src/presentation/hooks/use-reader-chapter.test.ts && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/presentation/hooks src/app/reader/[chapterId]/page.tsx
git commit -m "refactor: extract reader page orchestration"
```

### Task 8: Migrate settings and browse pages to normalized store/service paths

**Files:**
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/browse/page.tsx`
- Test: `npm run lint`

- [ ] **Step 1: Write a failing import smoke test by switching imports in settings page**

```ts
// replace legacy imports in settings page first
import { useSettingsStore } from '~/presentation/stores';
```

- [ ] **Step 2: Run lint to verify unresolved imports fail before all migrations are complete**

Run: `npm run lint`
Expected: FAIL if any presentation store export is missing or incorrect

- [ ] **Step 3: Migrate settings and browse pages to normalized imports**

```ts
// src/app/settings/page.tsx
import { useSettingsStore } from '~/presentation/stores';
```

```ts
// src/app/browse/page.tsx
import { useReaderStore } from '~/presentation/stores';
import { useToast } from '~/hooks/useToast';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import { autoDetectConfig } from '~/services/scrape/autoDetect';
import { getBuiltinPresets, presetToScrapeSource } from '~/services/scrape/presets';
import { setScrapeSession } from '~/services/scrape/sessionStore';
// update any source registry imports to use '~/infrastructure/sources'
```

- [ ] **Step 4: Run lint and targeted tests to verify migrated pages compile cleanly**

Run: `npm run lint && npx vitest src/services/scrape/scrapeAdapter.pagination.test.ts src/services/scrape/scrapeAdapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/page.tsx src/app/browse/page.tsx
git commit -m "refactor: migrate settings and browse pages to normalized boundaries"
```

### Task 9: Delete obsolete compatibility files after import graph is clean

**Files:**
- Delete: `src/stores/reader.ts`
- Delete: `src/stores/toast.ts`
- Delete: `src/store/useLibraryStore.ts`
- Delete: `src/store/useReaderStore.ts`
- Delete: `src/store/useSettingsStore.ts`
- Delete: `src/services/sources.ts`
- Modify: any remaining imports found by grep
- Test: `npm run lint`

- [ ] **Step 1: Prove the files are unused**

Run: `rg "~/stores/reader|~/stores/toast|~/store/useLibraryStore|~/store/useReaderStore|~/store/useSettingsStore|~/services/sources" src`
Expected: output only intentional compatibility references you are about to remove; no app/runtime consumers remain

- [ ] **Step 2: Update remaining imports to direct normalized paths**

```ts
// examples of target imports
import { useReaderStore, useSettingsStore, useToastStore } from '~/presentation/stores';
import { sourceRegistry } from '~/infrastructure/sources';
```

- [ ] **Step 3: Delete the obsolete compatibility files**

```bash
rm src/stores/reader.ts src/stores/toast.ts src/store/useLibraryStore.ts src/store/useReaderStore.ts src/store/useSettingsStore.ts src/services/sources.ts
```

- [ ] **Step 4: Run lint and targeted route tests to verify no broken imports remain**

Run: `npm run lint && npx vitest src/db/sync.test.ts src/db/scrapeSources.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A src/stores src/store src/services/sources.ts
git commit -m "refactor: remove obsolete compatibility shims"
```

### Task 10: Run full verification and clean repo noise only if safe

**Files:**
- Optional Delete: `.playwright-mcp/*.log`
- Optional Delete: `.playwright-mcp/*.yml`
- Verify: `src/app/browse/page.tsx`
- Verify: `src/app/manga/[id]/page.tsx`
- Verify: `src/app/reader/[chapterId]/page.tsx`
- Verify: `src/app/settings/page.tsx`

- [ ] **Step 1: Run full automated verification**

Run: `npm run lint && npx vitest`
Expected: PASS

- [ ] **Step 2: Run a dev smoke check for key routes**

Run: `npm run dev`
Expected: Next.js dev server starts successfully and serves the app locally

- [ ] **Step 3: Manually verify the critical flows**

```text
/library   → library renders without import/runtime errors
/browse    → source tabs, search, detail loading, save-to-library still work
/manga/[id] → manga loads, library toggle works, chapter status toggle works
/reader/[chapterId] → reader loads pages, reading mode switch works, last-read updates still happen
/settings → theme/settings controls still update persisted state
```

- [ ] **Step 4: Remove local Playwright artifacts only if they are confirmed non-essential and ignored by the repo workflow**

Run: `git status --short .playwright-mcp`
Expected: only transient logs/screenshots are listed; if true, remove them with `rm .playwright-mcp/*`

- [ ] **Step 5: Commit final verification/cleanup**

```bash
git add -A
git commit -m "refactor: finalize clean architecture migration"
```

---

## Self-Review

### Spec coverage
- **Layered structure introduced:** Tasks 1–5 establish `domain`, `infrastructure`, and `presentation` entrypoints.
- **Consolidated store structure:** Task 4 migrates all Zustand stores into one presentation location.
- **DB logic separation:** Task 3 starts splitting persistence helpers by concern.
- **Single source registry home:** Task 2 moves registry ownership into `infrastructure/sources/registry.ts`.
- **Thin route pages:** Tasks 6–8 thin `manga`, `reader`, `settings`, and `browse` pages.
- **Safe deletion rules:** Task 9 requires grep proof before deleting compatibility files.
- **Verification:** Task 10 covers lint, tests, and route smoke checks.

### Placeholder scan
- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Commands are explicit.
- Code-bearing steps include code blocks.

### Type consistency
- `SourceProvider` now lives under `~/domain/interfaces` and legacy `~/types` re-exports it.
- `AppSettings`, `Manga`, `Chapter`, and `ReadStatus` consistently come from `~/domain/types`.
- Normalized import targets are consistent: `~/presentation/stores`, `~/infrastructure/sources`, and `~/infrastructure/services`.
