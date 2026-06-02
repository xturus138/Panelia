# Panelia PWA MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Minimum Viable Product (MVP) for Panelia, a Mihon-inspired PWA manga reader, focusing on core architecture, UI shell, and PWA setup.

**Architecture:** A Next.js 15 App Router application with a mobile-first, offline-capable design. It uses a centralized Dexie.js service for local data storage and Zustand for state management. The UI is built with Tailwind CSS and shadcn/ui.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Dexie.js.

---

### Task 1: Project Initialization

**Files:**
- Create: `panelia/` (project root)
- Modify: `panelia/tsconfig.json`, `panelia/tailwind.config.ts`

- [ ] **Step 1: Create Next.js project**
Run: `npx create-next-app@latest panelia --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
Choose the following options when prompted:
- `Would you like to use App Router? (recommended)` -> `Yes`

- [ ] **Step 2: Navigate into the project directory**
Run: `cd panelia`

- [ ] **Step 3: Initialize shadcn/ui**
Run: `npx shadcn-ui@latest init`
Choose the following options:
- `Which style would you like to use?` -> `Default`
- `Which color would you like to use as base color?` -> `Slate`
- `Where is your global CSS file?` -> `src/app/globals.css`
- `Would you like to use CSS variables for colors?` -> `Yes`
- `Where is your tailwind.config.js located?` -> `tailwind.config.ts`
- `Configure import alias for components:` -> `~/components`
- `Configure import alias for utils:` -> `~/lib`
- `Are you using React Server Components?` -> `Yes`
- `Write configuration to components.json.` -> `Yes`

- [ ] **Step 4: Install additional dependencies**
Run: `npm install dexie zustand lucide-react`

- [ ] **Step 5: Commit initial project setup**
Run:
```bash
git init
git add .
git commit -m "feat: initialize Next.js, Tailwind, and shadcn/ui"
```

### Task 2: Data Model and Type Definitions

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create the main types file**
Create `src/types/index.ts` with all the interfaces from the design spec.
```typescript
// src/types/index.ts
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

export interface LibraryEntry {
  mangaId: string;
  categories: string[];
  dateAdded: string;
  unreadCount: number;
  lastChapterRead?: number;
  lastReadDate?: string;
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

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  readerMode: 'vertical-scroll' | 'webtoon' | 'single-page' | 'double-page';
  readingDirection: 'rtl' | 'ltr';
  pageFitMode: 'fit-width' | 'fit-height' | 'original' | 'auto';
  libraryViewMode: 'grid' | 'list';
  brightness: number; // 0-100
}
```

- [ ] **Step 2: Commit data model**
Run:
```bash
git add src/types/index.ts
git commit -m "feat: define core data models"
```

### Task 3: Centralized Database Service (Dexie.js)

**Files:**
- Create: `src/db/db.ts`

- [ ] **Step 1: Create the Dexie database class**
Create `src/db/db.ts` with the class definition for the database.
```typescript
// src/db/db.ts
import Dexie, { type EntityTable } from 'dexie';
import type { Manga, Chapter, LibraryEntry, Category, ReadProgress, AppSettings, DownloadedChapter } from '~/types';

class PaneliaDB extends Dexie {
  manga!: EntityTable<Manga, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  libraryEntries!: EntityTable<LibraryEntry, 'mangaId'>;
  categories!: EntityTable<Category, 'id'>;
  readProgress!: EntityTable<ReadProgress, '[chapterId+mangaId]'>;
  settings!: EntityTable<AppSettings, 'theme'>; // Using theme as a pseudo-PK for single-row settings
  downloadedChapters!: EntityTable<DownloadedChapter, 'id'>;

  constructor() {
    super('panelia-db');
    this.version(1).stores({
      manga: 'id, sourceId, title',
      chapters: 'id, mangaId, chapterNumber',
      libraryEntries: 'mangaId, *categories',
      categories: 'id, sortOrder',
      readProgress: '[chapterId+mangaId], lastReadAt',
      settings: 'theme', // Only one settings object exists
      downloadedChapters: 'id, chapterId, mangaId',
    });
  }
}

export const db = new PaneliaDB();
```

- [ ] **Step 2: Commit database service**
Run:
```bash
git add src/db/db.ts
git commit -m "feat: implement centralized Dexie database service"
```

### Task 4: UI Shell and Theme Provider

**Files:**
- Create: `src/components/layout/ThemeProvider.tsx`, `src/components/layout/BottomNav.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the ThemeProvider component**
```typescript
// src/components/layout/ThemeProvider.tsx
"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

- [ ] **Step 2: Create the BottomNav component**
```typescript
// src/components/layout/BottomNav.tsx
"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Compass, SquareArrowDown, History, Settings } from "lucide-react";
import { cn } from "~/lib/utils";

const navItems = [
  { href: "/library", label: "Library", icon: Book },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/updates", label: "Updates", icon: History },
  { href: "/downloads", label: "Downloads", icon: SquareArrowDown },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm">
      <div className="grid h-16 grid-cols-5 max-w-lg mx-auto font-medium">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className={cn(
              "inline-flex flex-col items-center justify-center px-5 hover:bg-muted",
              pathname === href ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="w-5 h-5 mb-1" />
            <span className="text-xs">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Update the root layout**
Modify `src/app/layout.tsx` to include the `ThemeProvider` and `BottomNav`.
```typescript
// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "~/components/layout/ThemeProvider";
import { BottomNav } from "~/components/layout/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Panelia",
  description: "A Mihon-inspired PWA manga reader.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <main className="pb-16">{children}</main>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit UI shell and theme**
Run:
```bash
git add .
git commit -m "feat: implement UI shell with BottomNav and ThemeProvider"
```

### Task 5: Placeholder Pages and Root Redirect

**Files:**
- Create: `src/app/library/page.tsx`, `src/app/browse/page.tsx`, `src/app/updates/page.tsx`, `src/app/downloads/page.tsx`, `src/app/settings/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create placeholder pages**
Create simple placeholder pages for each main route. Example for `library`:
```typescript
// src/app/library/page.tsx
export default function LibraryPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Library</h1>
    </div>
  );
}
```
Repeat for `/browse`, `/updates`, `/downloads`, and `/settings`.

- [ ] **Step 2: Implement root redirect**
Modify `src/app/page.tsx` to redirect to the library.
```typescript
// src/app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/library');
}
```
- [ ] **Step 3: Commit placeholder pages**
Run:
```bash
git add .
git commit -m "feat: add placeholder pages and root redirect"
```

### Task 6: PWA Setup (Manifest and Service Worker)

**Files:**
- Create: `src/app/manifest.ts`, `public/sw.js`, `public/icons/icon-192x192.png`, `public/icons/icon-512x512.png`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create PWA icons**
Create placeholder icons in `public/icons/`. You can use a simple square image for now.

- [ ] **Step 2: Create the manifest file**
```typescript
// src/app/manifest.ts
import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Panelia',
    short_name: 'Panelia',
    description: 'A Mihon-inspired PWA manga reader.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b', // slate-950
    theme_color: '#09090b',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
```

- [ ] **Step 3: Update layout metadata for PWA**
Modify `src/app/layout.tsx` to include PWA metadata.
```typescript
// src/app/layout.tsx
// ... imports
export const metadata: Metadata = {
  title: "Panelia",
  description: "A Mihon-inspired PWA manga reader.",
  manifest: "/manifest.webmanifest",
};
// ... rest of the file
```

- [ ] **Step 4: Create a basic service worker**
Create `public/sw.js`. For now, it can be a minimal offline handler.
```javascript
// public/sw.js
self.addEventListener('fetch', (event) => {
  // For MVP, we'll implement a simple network-first strategy.
  // Caching will be added in a later task.
  event.respondWith(fetch(event.request));
});
```

- [ ] **Step 5: Register the service worker**
Create a component to register the service worker and add it to `layout.tsx`.
```typescript
// src/components/layout/ServiceWorkerRegistrar.tsx
"use client";

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => console.log('Service Worker registered with scope:', registration.scope))
        .catch((error) => console.error('Service Worker registration failed:', error));
    }
  }, []);

  return null;
}
```
Then add `<ServiceWorkerRegistrar />` inside the `ThemeProvider` in `src/app/layout.tsx`.

- [ ] **Step 6: Commit PWA setup**
Run:
```bash
git add .
git commit -m "feat: implement basic PWA manifest and service worker"
```

### Task 7: Zustand Stores

**Files:**
- Create: `src/store/useLibraryStore.ts`, `src/store/useReaderStore.ts`, `src/store/useSettingsStore.ts`

- [ ] **Step 1: Create Settings Store**
```typescript
// src/store/useSettingsStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings } from '~/types';

interface SettingsState extends AppSettings {
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      readerMode: 'vertical-scroll',
      readingDirection: 'ltr',
      pageFitMode: 'fit-width',
      libraryViewMode: 'grid',
      brightness: 100,
      updateSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
    }),
    {
      name: 'panelia-settings',
    }
  )
);
```

- [ ] **Step 2: Create Library Store**
```typescript
// src/store/useLibraryStore.ts
import { create } from 'zustand';

interface LibraryState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCategoryId: string | null;
  setActiveCategory: (id: string | null) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  activeCategoryId: null,
  setActiveCategory: (id) => set({ activeCategoryId: id }),
}));
```

- [ ] **Step 3: Create Reader Store**
```typescript
// src/store/useReaderStore.ts
import { create } from 'zustand';

interface ReaderState {
  currentChapterId: string | null;
  mangaId: string | null;
  currentPage: number;
  showControls: boolean;
  setChapter: (mangaId: string, chapterId: string) => void;
  setPage: (page: number) => void;
  toggleControls: () => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  currentChapterId: null,
  mangaId: null,
  currentPage: 1,
  showControls: false,
  setChapter: (mangaId, chapterId) => set({ mangaId, currentChapterId: chapterId, currentPage: 1 }),
  setPage: (page) => set({ currentPage: page }),
  toggleControls: () => set((state) => ({ showControls: !state.showControls })),
}));
```

- [ ] **Step 4: Commit stores**
Run:
```bash
git add src/store
git commit -m "feat: implement Zustand stores"
```

### Task 8: Mock Source and Demo Data

**Files:**
- Create: `public/demo-data/manga.json`, `public/demo-data/chapters.json`, `src/services/mock-source.ts`

- [ ] **Step 1: Create demo manga JSON**
```json
// public/demo-data/manga.json
[
  {
    "id": "m1",
    "sourceId": "mock",
    "title": "Solo Leveling",
    "coverUrl": "https://upload.wikimedia.org/wikipedia/en/thumb/8/87/Solo_Leveling_Webtoon.png/220px-Solo_Leveling_Webtoon.png",
    "author": "Chugong",
    "artist": "DUBU",
    "status": "completed",
    "description": "In a world where hunters, humans who possess magical abilities, must battle deadly monsters to protect the human race from certain annihilation, a notoriously weak hunter named Sung Jinwoo finds himself in a seemingly endless struggle for survival.",
    "genres": ["Action", "Fantasy"],
    "tags": ["Webtoon"]
  }
]
```

- [ ] **Step 2: Create demo chapters JSON**
```json
// public/demo-data/chapters.json
{
  "m1": [
    {
      "id": "c1",
      "mangaId": "m1",
      "chapterNumber": 1,
      "title": "Prologue",
      "scanlator": "Official",
      "releaseDate": "2018-03-04",
      "pageCount": 3,
      "read": false,
      "lastReadPage": 0
    }
  ]
}
```

- [ ] **Step 3: Create Mock Source Provider**
```typescript
// src/services/mock-source.ts
import type { Manga, Chapter, Page } from '~/types';

export class MockSourceProvider {
  async getPopular(): Promise<Manga[]> {
    const res = await fetch('/demo-data/manga.json');
    return res.json();
  }

  async getLatest(): Promise<Manga[]> {
    const res = await fetch('/demo-data/manga.json');
    return res.json();
  }

  async search(query: string): Promise<Manga[]> {
    const manga = await this.getPopular();
    return manga.filter(m => m.title.toLowerCase().includes(query.toLowerCase()));
  }

  async getMangaDetails(id: string): Promise<Manga> {
    const mangaList = await this.getPopular();
    const manga = mangaList.find(m => m.id === id);
    if (!manga) throw new Error('Manga not found');
    return manga;
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    const res = await fetch('/demo-data/chapters.json');
    const data = await res.json();
    return data[mangaId] || [];
  }

  async getPages(chapterId: string): Promise<Page[]> {
    // Generate placeholder pages for testing reader
    return Array.from({ length: 5 }).map((_, i) => ({
      index: i,
      imageUrl: `https://placehold.co/800x1200/222222/cccccc?text=Page+${i + 1}`,
    }));
  }
}

export const mockSource = new MockSourceProvider();
```

- [ ] **Step 4: Commit mock source**
Run:
```bash
git add public/demo-data src/services
git commit -m "feat: implement mock source and demo data"
```

### Task 9: Library Screen

**Files:**
- Modify: `src/app/library/page.tsx`
- Create: `src/components/library/MangaCard.tsx`, `src/hooks/useLibrary.ts`

- [ ] **Step 1: Create useLibrary hook**
```typescript
// src/hooks/useLibrary.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '~/db/db';
import type { Manga, LibraryEntry } from '~/types';

export function useLibrary() {
  const libraryEntries = useLiveQuery(() => db.libraryEntries.toArray());
  const mangaList = useLiveQuery(async () => {
    if (!libraryEntries) return [];
    const mangaIds = libraryEntries.map(e => e.mangaId);
    return db.manga.where('id').anyOf(mangaIds).toArray();
  }, [libraryEntries]);

  return { libraryEntries, mangaList };
}
```

- [ ] **Step 2: Create MangaCard Component**
```typescript
// src/components/library/MangaCard.tsx
import Link from 'next/link';
import type { Manga } from '~/types';

export function MangaCard({ manga }: { manga: Manga }) {
  return (
    <Link href={`/manga/${manga.id}`} className="block relative aspect-[2/3] overflow-hidden rounded-md group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={manga.coverUrl} alt={manga.title} className="object-cover w-full h-full transition-transform group-hover:scale-105" />
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-xs font-semibold text-white line-clamp-2">{manga.title}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Update Library Page**
```typescript
// src/app/library/page.tsx
"use client";

import { useLibrary } from '~/hooks/useLibrary';
import { MangaCard } from '~/components/library/MangaCard';

export default function LibraryPage() {
  const { mangaList } = useLibrary();

  if (!mangaList) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Library</h1>
      {mangaList.length === 0 ? (
        <p className="text-muted-foreground">Your library is empty. Go to Browse to add manga.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {mangaList.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit Library screen**
Run:
```bash
git add src/app/library src/components/library src/hooks
git commit -m "feat: implement library screen and db hooks"
```

### Task 10: Browse Screen

**Files:**
- Modify: `src/app/browse/page.tsx`

- [ ] **Step 1: Implement Browse Page**
```typescript
// src/app/browse/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { mockSource } from '~/services/mock-source';
import { MangaCard } from '~/components/library/MangaCard';
import type { Manga } from '~/types';

export default function BrowsePage() {
  const [popular, setPopular] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockSource.getPopular().then(data => {
      setPopular(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Browse</h1>
      <h2 className="text-lg font-semibold mb-3">Popular (Mock Source)</h2>
      {loading ? (
        <p>Loading sources...</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {popular.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit Browse screen**
Run:
```bash
git add src/app/browse
git commit -m "feat: implement browse screen with mock data"
```

### Task 11: Manga Details and Library Management

**Files:**
- Create: `src/app/manga/[id]/page.tsx`
- Modify: `src/db/library.ts` (new file)

- [ ] **Step 1: Create Library DB operations**
```typescript
// src/db/library.ts
import { db } from './db';
import type { Manga, LibraryEntry } from '~/types';

export async function toggleInLibrary(manga: Manga) {
  const exists = await db.libraryEntries.get(manga.id);
  
  if (exists) {
    await db.libraryEntries.delete(manga.id);
    await db.manga.delete(manga.id); // Assuming we only store it if in library or cached
    return false;
  } else {
    const entry: LibraryEntry = {
      mangaId: manga.id,
      categories: [],
      dateAdded: new Date().toISOString(),
      unreadCount: 0
    };
    
    await db.transaction('rw', db.manga, db.libraryEntries, async () => {
      await db.manga.put(manga);
      await db.libraryEntries.put(entry);
    });
    return true;
  }
}

export async function isInLibrary(mangaId: string) {
  return !!(await db.libraryEntries.get(mangaId));
}
```

- [ ] **Step 2: Implement Manga Details Page**
```typescript
// src/app/manga/[id]/page.tsx
"use client";

import { use, useEffect, useState } from 'react';
import { mockSource } from '~/services/mock-source';
import { toggleInLibrary, isInLibrary } from '~/db/library';
import type { Manga, Chapter } from '~/types';
import Link from 'next/link';

export default function MangaDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [manga, setManga] = useState<Manga | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [inLib, setInLib] = useState(false);

  useEffect(() => {
    Promise.all([
      mockSource.getMangaDetails(id),
      mockSource.getChapters(id),
      isInLibrary(id)
    ]).then(([m, c, l]) => {
      setManga(m);
      setChapters(c);
      setInLib(l);
    });
  }, [id]);

  if (!manga) return <div className="p-4">Loading...</div>;

  const handleToggleLibrary = async () => {
    const isNowInLib = await toggleInLibrary(manga);
    setInLib(isNowInLib);
  };

  return (
    <div className="pb-20">
      <div className="relative h-64 w-full bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute bottom-4 left-4 flex gap-4">
           {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={manga.coverUrl} alt={manga.title} className="w-24 h-36 rounded shadow-lg object-cover" />
          <div className="flex flex-col justify-end">
            <h1 className="text-xl font-bold text-white">{manga.title}</h1>
            <p className="text-sm text-zinc-300">{manga.author}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <button 
          onClick={handleToggleLibrary}
          className="w-full py-2 mb-4 rounded-md font-semibold bg-primary text-primary-foreground"
        >
          {inLib ? 'In Library' : 'Add to Library'}
        </button>

        <p className="text-sm mb-6">{manga.description}</p>

        <h2 className="text-lg font-bold mb-3">{chapters.length} Chapters</h2>
        <div className="flex flex-col gap-2">
          {chapters.map(ch => (
            <Link 
              key={ch.id} 
              href={`/reader/${ch.id}?manga=${manga.id}`}
              className="p-3 bg-muted rounded-md flex justify-between items-center"
            >
              <span>Chapter {ch.chapterNumber}: {ch.title}</span>
              <span className="text-xs text-muted-foreground">{ch.releaseDate}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit Manga details**
Run:
```bash
git add src/app/manga src/db/library.ts
git commit -m "feat: implement manga details page and library toggle"
```

### Task 12: Reader Screen

**Files:**
- Create: `src/app/reader/[chapterId]/page.tsx`

- [ ] **Step 1: Implement Reader Page**
```typescript
// src/app/reader/[chapterId]/page.tsx
"use client";

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mockSource } from '~/services/mock-source';
import type { Page } from '~/types';

export default function ReaderPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = use(params);
  const searchParams = useSearchParams();
  const mangaId = searchParams.get('manga');
  const router = useRouter();
  
  const [pages, setPages] = useState<Page[]>([]);
  const [controlsVisible, setControlsVisible] = useState(false);

  useEffect(() => {
    mockSource.getPages(chapterId).then(setPages);
  }, [chapterId]);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col overflow-y-auto">
      {/* Pages Container - Vertical Scroll Mode for MVP */}
      <div 
        className="flex-1 w-full max-w-3xl mx-auto flex flex-col"
        onClick={() => setControlsVisible(!controlsVisible)}
      >
        {pages.map((page) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            key={page.index} 
            src={page.imageUrl} 
            alt={`Page ${page.index + 1}`} 
            className="w-full object-contain"
            loading="lazy"
          />
        ))}
      </div>

      {/* Overlay Controls */}
      {controlsVisible && (
        <>
          {/* Header */}
          <div className="fixed top-0 left-0 right-0 bg-black/80 text-white p-4 flex items-center">
            <button onClick={() => router.back()} className="mr-4">← Back</button>
            <span className="truncate">Chapter Viewer</span>
          </div>
          
          {/* Footer */}
          <div className="fixed bottom-0 left-0 right-0 bg-black/80 text-white p-4">
             <div className="text-center text-sm">{pages.length} Pages</div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit Reader**
Run:
```bash
git add src/app/reader
git commit -m "feat: implement basic vertical reader screen"
```

### Task 13: Settings Screen

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Implement Settings Page**
```typescript
// src/app/settings/page.tsx
"use client";

import { useSettingsStore } from '~/store/useSettingsStore';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const settings = useSettingsStore();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-3">App Theme</h2>
          <select 
            className="w-full p-2 rounded bg-muted border border-border"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="system">System Default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Reader Mode</h2>
          <select 
            className="w-full p-2 rounded bg-muted border border-border"
            value={settings.readerMode}
            onChange={(e) => settings.updateSettings({ readerMode: e.target.value as any })}
          >
            <option value="vertical-scroll">Vertical Scroll</option>
            <option value="single-page">Single Page</option>
            <option value="webtoon">Webtoon</option>
          </select>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Data</h2>
          <button 
            className="w-full p-2 bg-destructive text-destructive-foreground rounded font-medium"
            onClick={() => alert('Wipe database not implemented in MVP')}
          >
            Clear Local Data
          </button>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit Settings**
Run:
```bash
git add src/app/settings
git commit -m "feat: implement basic settings page"
```

