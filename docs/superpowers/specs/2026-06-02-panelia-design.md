# Panelia PWA Design Spec

**Date:** 2026-06-02
**Status:** Approved for Implementation

## 1. Overview

Panelia is a Mihon-inspired manga/comic reader built as a Progressive Web App (PWA). The goal is a modern, installable web app that runs on mobile browsers, supports offline reading, and provides a polished, native-like reading experience.

### Key Principles
- Mobile-first responsive design
- Dark theme default, light theme support
- Offline-capable via IndexedDB and Service Worker
- PWA installable from Chrome/Samsung Internet on Android
- Clean source provider architecture for future extensibility
- No backend required for v1

## 2. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js (App Router) | Modern React framework, App Router for layouts/server components |
| Language | TypeScript | Type safety, better DX |
| Styling | Tailwind CSS | Utility-first, fast prototyping, consistent design |
| Components | shadcn/ui | Unstyled, customizable primitives, Radix UI base |
| State | Zustand | Lightweight, no boilerplate, perfect for medium app size |
| Local DB | Dexie.js (IndexedDB) | Centralized service, type-safe, offline-first |
| PWA | Service Worker + manifest.json | Offline shell, installability, standalone display |

## 3. Data Model

All interfaces defined in `src/types/` for shared use across app.

### Core Entities

```typescript
interface Manga {
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
  url?: string; // source URL
}

interface Chapter {
  id: string;
  mangaId: string;
  chapterNumber: number;
  title: string;
  scanlator: string;
  releaseDate: string;
  pageCount: number;
  read: boolean;
  lastReadPage: number; // 0 if never read
}

interface Page {
  index: number;
  imageUrl: string;
  width?: number;
  height?: number;
}

interface Source {
  id: string;
  name: string;
  baseUrl: string;
  iconUrl: string;
  isInstalled: boolean;
  isNsfw: boolean;
  version: number;
  languages: string[];
}

interface LibraryEntry {
  mangaId: string;
  categories: string[];
  dateAdded: string;
  unreadCount: number;
  lastChapterRead?: number;
  lastReadDate?: string;
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

interface ReadProgress {
  chapterId: string;
  mangaId: string;
  lastPage: number;
  totalPages: number;
  completed: boolean;
  lastReadAt: string;
}

interface DownloadedChapter {
  id: string;
  chapterId: string;
  mangaId: string;
  pages: Array<{ index: number; blobUrl: string }>;
  downloadedAt: string;
  sizeBytes: number;
}

interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  readerMode: 'vertical-scroll' | 'webtoon' | 'single-page' | 'double-page';
  readingDirection: 'rtl' | 'ltr';
  pageFitMode: 'fit-width' | 'fit-height' | 'original' | 'auto';
  libraryViewMode: 'grid' | 'list';
  brightness: number; // 0-100
}
```

## 4. Architecture

### Directory Structure

```
panelia/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Redirect to /library
│   │   ├── manifest.ts         # PWA manifest generation
│   │   ├── sw.ts               # Service Worker registration
│   │   ├── library/
│   │   │   └── page.tsx        # Library tab
│   │   ├── browse/
│   │   │   ├── page.tsx        # Browse tab
│   │   │   └── sources/
│   │   │       └── page.tsx    # Source management
│   │   ├── updates/
│   │   │   └── page.tsx        # Updates tab
│   │   ├── downloads/
│   │   │   └── page.tsx        # Downloads tab
│   │   ├── settings/
│   │   │   └── page.tsx        # Settings tab
│   │   ├── manga/[id]/
│   │   │   └── page.tsx        # Manga details page
│   │   └── reader/[chapterId]/
│   │       └── page.tsx        # Reader screen
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── BottomNav.tsx
│   │   │   └── ThemeProvider.tsx
│   │   ├── library/
│   │   │   ├── MangaCard.tsx
│   │   │   ├── MangaGrid.tsx
│   │   │   ├── MangaList.tsx
│   │   │   └── EmptyState.tsx
│   │   ├── browse/
│   │   │   ├── SourceCard.tsx
│   │   │   └── SourceList.tsx
│   │   ├── manga/
│   │   │   ├── MangaHeader.tsx
│   │   │   ├── ChapterList.tsx
│   │   │   └── ChapterItem.tsx
│   │   ├── reader/
│   │   │   ├── ReaderView.tsx
│   │   │   ├── ReaderControls.tsx
│   │   │   └── ReaderSettings.tsx
│   │   └── settings/
│   │       ├── SettingSection.tsx
│   │       └── ThemeSelector.tsx
│   ├── db/
│   │   ├── db.ts               # Dexie instance definition
│   │   ├── library.ts          # Library operations
│   │   ├── manga.ts            # Manga operations
│   │   ├── chapters.ts         # Chapter operations
│   │   ├── settings.ts         # Settings operations
│   │   └── downloads.ts        # Download operations
│   ├── store/
│   │   ├── useLibraryStore.ts
│   │   ├── useReaderStore.ts
│   │   └── useSettingsStore.ts
│   ├── services/
│   │   ├── source-adapter.ts   # Source interface/adapter
│   │   ├── mock-source.ts      # Demo source implementation
│   │   └── pwa.ts              # PWA install prompt logic
│   ├── hooks/
│   │   ├── useManga.ts
│   │   ├── useChapters.ts
│   │   └── usePWA.ts
│   └── types/
│       ├── index.ts            # All TypeScript interfaces
│       └── source.ts           # Source adapter types
├── public/
│   ├── icons/                  # PWA app icons
│   └── demo-data/              # Static JSON demo content
├── .well-known/
│   └── assetlinks.json         # PWA Android trust verification (optional)
└── next.config.ts              # Next.js config with PWA plugin
```

## 5. Key Components

### 5.1 Service Layer

**Source Adapter Pattern:**
```typescript
interface SourceProvider {
  search(query: string): Promise<Manga[]>;
  getPopular(): Promise<Manga[]>;
  getLatest(): Promise<Manga[]>;
  getMangaDetails(id: string): Promise<Manga>;
  getChapters(mangaId: string): Promise<Chapter[]>;
  getPages(chapterId: string): Promise<Page[]>;
}

class MockSourceProvider implements SourceProvider {
  // Implementation using static JSON data
}
```

**Centralized Dexie Service:**
```typescript
class PaneliaDB extends Dexie {
  manga: Dexie.Table<Manga, string>;
  chapters: Dexie.Table<Chapter, string>;
  libraryEntries: Dexie.Table<LibraryEntry, string>;
  categories: Dexie.Table<Category, string>;
  readProgress: Dexie.Table<ReadProgress, string>;
  settings: Dexie.Table<AppSettings, string>;
  downloadedChapters: Dexie.Table<DownloadedChapter, string>;
  
  constructor() {
    super('panelia-db');
    this.version(1).stores({
      manga: 'id, sourceId, title',
      chapters: 'id, mangaId, chapterNumber',
      libraryEntries: 'mangaId, categories',
      categories: 'id, sortOrder',
      readProgress: '[chapterId+mangaId], lastReadAt',
      settings: '++id',
      downloadedChapters: 'id, chapterId, mangaId',
    });
  }
}
```

### 5.2 State Management (Zustand)

Three primary stores:

1. **Library Store**: Manages library state (entries, categories, filters, search)
2. **Reader Store**: Tracks reader settings, current chapter, page progress
3. **Settings Store**: App-wide settings (theme, preferences, reader defaults)

### 5.3 PWA Implementation

- `next-pwa` plugin or custom service worker
- Manifest generated via `manifest.ts` in App Router
- Standalone display mode
- Offline fallback shell
- "Install App" button triggered when `beforeinstallprompt` fires

## 6. UI/UX Design

### 6.1 Layout

- Mobile-first bottom navigation (5 tabs: Library, Browse, Updates, Downloads, Settings)
- Desktop: side navigation or expanded bottom nav
- Clean, card-based UI with skeleton loading states
- Bottom sheets/modals for settings and filters

### 6.2 Theme

- Dark theme default (`bg-zinc-950`, `text-zinc-50`)
- Light theme (`bg-white`, `text-zinc-900`)
- System theme detection via `prefers-color-scheme`
- Theme toggle in settings

### 6.3 Reader Screen

- Fullscreen/immersive mode (hides browser UI)
- Multiple reading modes (vertical scroll, webtoon, single page, double page)
- RTL/LTR direction support
- Tap zones for navigation
- Brightness overlay via CSS `filter: brightness()`
- Fit modes (width, height, original, auto)
- Progress indicator

## 7. Offline Strategy

- IndexedDB (Dexie) for structured data (manga metadata, chapters, library, settings)
- Cache API or IndexedDB for image/page blobs
- Service Worker intercepts requests for cached chapter pages
- Offline fallback page if no network and no cached content

## 8. Backup System

- Export: Serialize all library data, categories, progress, settings to JSON
- Import: Parse JSON, validate structure, merge or replace existing data
- Validation: Check required fields, handle version mismatches

## 9. Demo Data

- Static JSON files in `public/demo-data/`
- Mock manga entries with placeholder covers
- Sample chapters with static page URLs
- Mock source with ~10 manga for testing

## 10. Implementation Phases

1. **Phase 1**: Project setup, Next.js App Router, Tailwind, shadcn/ui, Dexie
2. **Phase 2**: Data model, Dexie schemas, Zustand stores, type definitions
3. **Phase 3**: UI shell, bottom navigation, theme system
4. **Phase 4**: Library screen, manga cards, grid/list view
5. **Phase 5**: Browse screen, source provider architecture, mock source
6. **Phase 6**: Manga details page, chapter list, library management
7. **Phase 7**: Reader screen with multiple modes, progress tracking
8. **Phase 8**: Updates screen, downloads screen
9. **Phase 9**: Settings screen, backup/export/import
10. **Phase 10**: PWA installability, offline caching, service worker
11. **Phase 11**: Polish, animations, empty states, skeleton loading

## 11. Notes

- No backend required for v1
- No APK output
- All demo data is static/mock
- Focus on mobile browser experience first
