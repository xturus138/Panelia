# Panelia Frontend Redesign - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 6 pages (Library, Browse, Manga Details, Reader, Downloads, Settings) with Clean Minimal aesthetic using Warm Neutrals colors and Plus Jakarta Sans typography.

**Architecture:** Tailwind CSS v4 with custom theme configuration in globals.css. Components built on shadcn/ui patterns. next-themes for dark mode. Floating bottom nav with shadow. 2-column mobile-first grid for manga cards.

**Tech Stack:** Next.js 16, Tailwind CSS v4, shadcn, Lucide React, next-themes, TypeScript

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx           # Root layout with theme + nav
│   ├── globals.css          # Tailwind config + design tokens
│   ├── library/page.tsx     # Library page
│   ├── browse/page.tsx     # Browse page
│   ├── manga/[id]/page.tsx  # Manga details page
│   ├── reader/[chapterId]/page.tsx  # Reader page
│   ├── downloads/page.tsx   # Downloads page
│   └── settings/page.tsx    # Settings page
├── components/
│   ├── layout/
│   │   └── BottomNav.tsx     # Floating pill-shaped bottom nav
│   └── library/
│       └── MangaCard.tsx     # Card with cover, title, genres
├── hooks/
│   └── useLibrary.ts        # Library data hook
└── store/
    └── useLibraryStore.ts   # Zustand store
```

---

## Tasks

### Task 1: Configure Design System in globals.css

**Files:**
- Modify: `src/app/globals.css:1-130`

- [ ] **Step 1: Update color palette to Warm Neutrals**

Replace the `:root` section with Warm Neutrals palette:

```css
:root {
  --background: #faf9f7;
  --foreground: #1a1a1a;
  --card: #ffffff;
  --card-foreground: #1a1a1a;
  --popover: #ffffff;
  --popover-foreground: #1a1a1a;
  --primary: #6366f1;
  --primary-foreground: #ffffff;
  --secondary: #f5f5f5;
  --secondary-foreground: #1a1a1a;
  --muted: #f5f5f5;
  --muted-foreground: #888888;
  --accent: #6366f1;
  --accent-foreground: #ffffff;
  --destructive: oklch(0.577 0.245 27.325);
  --border: #e5e5e5;
  --input: #f5f5f5;
  --ring: #6366f1;
  --radius: 0.75rem;
}
```

- [ ] **Step 2: Update dark mode with adjusted warm neutrals**

In `.dark` class, update to:

```css
.dark {
  --background: #1a1a1a;
  --foreground: #faf9f7;
  --card: #2d2d2d;
  --card-foreground: #faf9f7;
  --primary: #6366f1;
  --primary-foreground: #ffffff;
  --secondary: #2d2d2d;
  --secondary-foreground: #faf9f7;
  --muted: #2d2d2d;
  --muted-foreground: #888888;
  --accent: #6366f1;
  --accent-foreground: #ffffff;
  --border: #404040;
  --input: #2d2d2d;
  --ring: #6366f1;
}
```

- [ ] **Step 3: Verify changes**

Run: `npm run dev` and check http://localhost:3000 for color changes

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: Configure Warm Neutrals color palette in Tailwind"
```

---

### Task 2: Update Layout with Plus Jakarta Sans Font

**Files:**
- Modify: `src/app/layout.tsx:1-37`

- [ ] **Step 1: Update font to Plus Jakarta Sans**

Replace the font import and metadata:

```tsx
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "~/components/layout/ThemeProvider";
import { BottomNav } from "~/components/layout/BottomNav";
import { ServiceWorkerRegistrar } from "~/components/layout/ServiceWorkerRegistrar";

const plusJakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Panelia",
  description: "A Mihon-inspired PWA manga reader.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={plusJakarta.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ServiceWorkerRegistrar />
          <main className="pb-20">{children}</main>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify font loads**

Run: `npm run dev` and check browser DevTools for Plus Jakarta Sans loading

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: Switch to Plus Jakarta Sans font"
```

---

### Task 3: Redesign BottomNav with Floating Pill Style

**Files:**
- Modify: `src/components/layout/BottomNav.tsx:1-38`

- [ ] **Step 1: Update BottomNav with floating pill style**

Replace entire file:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Book, Compass, SquareArrowDown, Settings } from "lucide-react"
import { cn } from "~/lib/utils"

const navItems = [
  { href: "/library", label: "Library", icon: Book },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/downloads", label: "Downloads", icon: SquareArrowDown },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 max-w-lg mx-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-full px-6 py-3 flex items-center justify-around shadow-lg shadow-black/5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-full transition-all duration-150",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Update pb-16 to pb-24 for more bottom space**

In layout.tsx, change `pb-16` to `pb-24`:

```tsx
<main className="pb-24">{children}</main>
```

- [ ] **Step 3: Verify floating nav renders**

Run: `npm run dev` and check bottom nav is pill-shaped with shadow

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/BottomNav.tsx src/app/layout.tsx
git commit -m "feat: Redesign BottomNav with floating pill style"
```

---

### Task 4: Redesign MangaCard Component

**Files:**
- Modify: `src/components/library/MangaCard.tsx:1-60`

- [ ] **Step 1: Update MangaCard with clean minimal style**

Replace entire file:

```tsx
"use client"

import Link from "next/link"
import type { Manga } from "~/types"
import { cn } from "~/lib/utils"

interface MangaCardProps {
  manga: Manga
  className?: string
}

export function MangaCard({ manga, className }: MangaCardProps) {
  return (
    <Link
      href={`/manga/${manga.id}`}
      className={cn(
        "group block bg-card rounded-xl overflow-hidden shadow-sm",
        "transition-all duration-150 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
    >
      {/* Cover Image with Badge */}
      <div className="relative aspect-[0.7] bg-muted overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={manga.coverUrl}
          alt={manga.title}
          className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-105"
        />
        {/* Chapter Badge */}
        {manga.chapterCount && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
            Ch. {manga.chapterCount}
          </div>
        )}
      </div>
      
      {/* Info Section */}
      <div className="p-3">
        <h3 className="font-semibold text-[13px] text-card-foreground truncate mb-1 leading-tight">
          {manga.title}
        </h3>
        {manga.genres && manga.genres.length > 0 && (
          <p className="text-[11px] text-muted-foreground truncate">
            {manga.genres.slice(0, 2).join(" • ")}
          </p>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Check type definitions**

Read `src/types/index.ts` to ensure Manga type has `genres` and `chapterCount`. If not, note the fields to add.

- [ ] **Step 3: Verify card renders**

Run: `npm run dev` and check library page shows cards with hover effects

- [ ] **Step 4: Commit**

```bash
git add src/components/library/MangaCard.tsx
git commit -m "feat: Redesign MangaCard with clean minimal style"
```

---

### Task 5: Redesign Library Page

**Files:**
- Modify: `src/app/library/page.tsx:1-25`

- [ ] **Step 1: Update Library page with clean minimal layout**

Replace entire file:

```tsx
"use client"

import { useLibrary } from '~/hooks/useLibrary'
import { MangaCard } from '~/components/library/MangaCard'
import { Search } from 'lucide-react'

export default function LibraryPage() {
  const { mangaList } = useLibrary()

  if (!mangaList) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold text-foreground leading-tight">Library</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {mangaList.length} manga in collection
          </p>
        </div>
        <button className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <Search className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-secondary rounded-xl px-4 py-3 flex items-center gap-3 mb-6">
        <Search className="w-4 h-4 text-muted-foreground" />
        <span className="text-[15px] text-muted-foreground">Search manga...</span>
      </div>

      {/* Manga Grid */}
      {mangaList.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="text-4xl mb-4">📚</div>
          <h2 className="text-lg font-semibold mb-2">Your library is empty</h2>
          <p className="text-muted-foreground text-sm">
            Go to Browse to add manga to your collection
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {mangaList.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify layout renders**

Run: `npm run dev` and check library page has header, search bar, 2-column grid

- [ ] **Step 3: Commit**

```bash
git add src/app/library/page.tsx
git commit -m "feat: Redesign Library page with clean minimal layout"
```

---

### Task 6: Redesign Browse Page

**Files:**
- Modify: `src/app/browse/page.tsx:1-98`

- [ ] **Step 1: Update Browse page with clean minimal layout**

Replace entire file:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { extensionService } from '~/services/extensions'
import { sourceRegistry } from '~/services/sources'
import { MangaCard } from '~/components/library/MangaCard'
import { Search, ChevronDown } from 'lucide-react'
import type { Manga, Source } from '~/types'

export default function BrowsePage() {
  const [sources, setSources] = useState<Source[]>([])
  const [activeSource, setActiveSource] = useState<Source | null>(null)
  const [manga, setManga] = useState<Manga[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSources = useCallback(async () => {
    try {
      setLoading(true)
      const data = await extensionService.getSources()
      setSources(data)
      if (data.length > 0) {
        setActiveSource(data[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadManga = useCallback(async () => {
    if (!activeSource) return
    try {
      setLoading(true)
      const provider = sourceRegistry.get(activeSource.id)
      const data = await provider.getPopular(0)
      setManga(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manga')
    } finally {
      setLoading(false)
    }
  }, [activeSource])

  useEffect(() => {
    loadSources()
  }, [loadSources])

  useEffect(() => {
    if (activeSource) {
      loadManga()
    }
  }, [activeSource, loadManga])

  if (loading && sources.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading sources...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <p className="text-destructive text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-foreground leading-tight">Browse</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Discover new manga to read
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-secondary rounded-xl px-4 py-3 flex items-center gap-3 mb-6">
        <Search className="w-4 h-4 text-muted-foreground" />
        <span className="text-[15px] text-muted-foreground">Search manga...</span>
      </div>

      {/* Source Selector */}
      {sources.length > 0 && (
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {sources.map(source => (
              <button
                key={source.id}
                onClick={() => setActiveSource(source)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  activeSource?.id === source.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {source.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manga Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <p className="text-muted-foreground">Loading manga...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {manga.map(m => (
            <MangaCard key={m.id} manga={m} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify browse page renders**

Run: `npm run dev` and check browse page shows sources as pills, 2-column grid

- [ ] **Step 3: Commit**

```bash
git add src/app/browse/page.tsx
git commit -m "feat: Redesign Browse page with source pills and clean layout"
```

---

### Task 7: Redesign Manga Details Page

**Files:**
- Modify: `src/app/manga/[id]/page.tsx:1-76`

- [ ] **Step 1: Update Manga Details with clean minimal layout**

Replace entire file:

```tsx
"use client"

import { use, useEffect, useState } from 'react'
import { mockSource } from '~/services/mock-source'
import { toggleInLibrary, isInLibrary } from '~/db/library'
import type { Manga, Chapter } from '~/types'
import Link from 'next/link'
import { ArrowLeft, Library, Check, ChevronRight } from 'lucide-react'

export default function MangaDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [manga, setManga] = useState<Manga | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [inLib, setInLib] = useState(false)

  useEffect(() => {
    Promise.all([
      mockSource.getMangaDetails(id),
      mockSource.getChapters(id),
      isInLibrary(id)
    ]).then(([m, c, l]) => {
      setManga(m)
      setChapters(c)
      setInLib(l)
    })
  }, [id])

  const handleToggleLibrary = async () => {
    const isNowInLib = await toggleInLibrary(manga!)
    setInLib(isNowInLib)
  }

  if (!manga) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Hero Header */}
      <div className="relative h-64 w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={manga.coverUrl} 
          alt={manga.title} 
          className="w-full h-full object-cover opacity-40" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        
        {/* Back Button */}
        <button 
          onClick={() => window.history.back()}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Cover + Info */}
        <div className="absolute bottom-0 left-4 right-4 flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={manga.coverUrl} 
            alt={manga.title} 
            className="w-28 h-40 rounded-xl shadow-lg object-cover" 
          />
          <div className="flex flex-col justify-end pb-2 flex-1">
            <h1 className="text-xl font-bold text-foreground leading-tight">{manga.title}</h1>
            {manga.author && (
              <p className="text-sm text-muted-foreground mt-1">{manga.author}</p>
            )}
            {manga.genres && manga.genres.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {manga.genres.slice(0, 3).map(genre => (
                  <span key={genre} className="text-[10px] font-medium bg-secondary px-2 py-1 rounded-full">
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-6">
        {/* Add to Library Button */}
        <button
          onClick={handleToggleLibrary}
          className={`w-full py-3.5 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all duration-150 mb-6 ${
            inLib 
              ? 'bg-primary/10 text-primary border border-primary/20' 
              : 'bg-primary text-primary-foreground'
          }`}
        >
          {inLib ? (
            <>
              <Check className="w-4 h-4" />
              In Library
            </>
          ) : (
            <>
              <Library className="w-4 h-4" />
              Add to Library
            </>
          )}
        </button>

        {/* Description */}
        {manga.description && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground leading-relaxed">{manga.description}</p>
          </div>
        )}

        {/* Chapters Section */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground">
            {chapters.length} Chapters
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {chapters.map(ch => (
            <Link
              key={ch.id}
              href={`/reader/${ch.id}?manga=${manga.id}`}
              className="bg-card rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[14px] text-card-foreground truncate">
                  Chapter {ch.chapterNumber}: {ch.title}
                </p>
                {ch.releaseDate && (
                  <p className="text-[12px] text-muted-foreground mt-1">{ch.releaseDate}</p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify details page renders**

Run: `npm run dev` and check manga details shows hero header with cover, genre tags, chapter list

- [ ] **Step 3: Commit**

```bash
git add "src/app/manga/[id]/page.tsx"
git commit -m "feat: Redesign Manga Details page with hero header and clean layout"
```

---

### Task 8: Redesign Downloads Page

**Files:**
- Modify: `src/app/downloads/page.tsx:1-60`

- [ ] **Step 1: Read current downloads page**

Read `src/app/downloads/page.tsx` to understand current structure

- [ ] **Step 2: Update Downloads page with clean minimal layout**

Replace with clean minimal design following the same patterns (header, cards, etc.)

- [ ] **Step 3: Verify downloads page renders**

Run: `npm run dev` and check downloads page follows new design

- [ ] **Step 4: Commit**

```bash
git add src/app/downloads/page.tsx
git commit -m "feat: Redesign Downloads page with clean minimal layout"
```

---

### Task 9: Redesign Settings Page

**Files:**
- Modify: `src/app/settings/page.tsx:1-60`

- [ ] **Step 1: Read current settings page**

Read `src/app/settings/page.tsx` to understand current structure

- [ ] **Step 2: Update Settings page with clean minimal layout**

Use grouped list style with section headers, toggle switches, and clean spacing

- [ ] **Step 3: Verify settings page renders**

Run: `npm run dev` and check settings page follows new design

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: Redesign Settings page with clean minimal layout"
```

---

### Task 10: Final Review and Polish

- [ ] **Step 1: Run lint and build**

Run: `npm run lint && npm run build`
Fix any errors

- [ ] **Step 2: Test responsive on different viewport sizes**

Run: `npm run dev` and resize browser

- [ ] **Step 3: Verify dark mode works**

Toggle dark mode and check all pages

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Complete Panelia frontend redesign - Clean Minimal aesthetic"
```

---

## Validation Checklist

- [ ] All pages use consistent spacing (px-4, pt-6, pb-4)
- [ ] Typography hierarchy is clear (28px header, 14px body, 11px caption)
- [ ] Cards have proper hover states (scale 1.02, shadow)
- [ ] Bottom nav is floating pill with shadow
- [ ] Search bars are rounded (rounded-xl)
- [ ] Colors match Warm Neutrals palette
- [ ] Font is Plus Jakarta Sans throughout
- [ ] Mobile-first responsive (2 columns)
- [ ] Dark mode fully supported