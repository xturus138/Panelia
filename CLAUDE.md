# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Panelia is a Mihon-inspired PWA manga reader built with Next.js 16 (App Router) and React 19. It stores all user data client-side in IndexedDB via Dexie, and scrapes manga sites using declarative CSS-selector configs.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`)
- `npx vitest` — run all tests
- `npx vitest src/path/to/file.test.ts` — run a single test file

## Architecture

### Data Layer (all client-side, no traditional DB)

- **Dexie (IndexedDB)**: `src/db/db.ts` — `PaneliaDB` class with versioned schema migrations. Tables: `manga`, `chapters`, `libraryEntries`, `categories`, `readProgress`, `settings`, `downloadedChapters`, `scrapeSources`.
- **Zustand stores** (persisted to localStorage):
  - `src/store/useSettingsStore.ts` — app settings (theme, reader mode, etc.)
  - `src/store/useReaderStore.ts` — reader state
  - `src/store/useLibraryStore.ts` — library state
  - `src/stores/` — additional stores (reader, toast)
- **Shared types**: `src/types/index.ts` — `Manga`, `Chapter`, `Page`, `SourceProvider` interface, `LibraryEntry`, `AppSettings`, etc.

### Source System

Two kinds of manga sources:

1. **API sources** (`src/services/sources/`): Direct API integrations (MangaDex, Comick). Each implements `SourceProvider` interface. Registered in `src/services/sources/index.ts` via `SourceRegistry`.
2. **Scrape sources** (`src/services/scrape/`): CSS-selector-based scraping. Users provide a `SiteConfig` JSON describing selectors for manga pages, chapter pages, search, and popular listings. `ScrapeAdapter` parses HTML with `node-html-parser`. Presets in `src/services/scrape/presets.ts`. Rehydrated on demand via `sourceRegistry.getOrRehydrate()`.

### API Routes

- `src/app/api/proxy/route.ts` — CORS proxy. Client-side scrape/fetch calls go through `/api/proxy?url=...` to bypass browser CORS restrictions. Uses session cookies for host allowlisting.
- `src/app/api/sync/route.ts` — data sync endpoint.

### Pages (App Router)

- `/library` — main library view (home redirects here)
- `/browse` — search/browse manga sources
- `/manga/[id]` — manga details + chapter list
- `/reader/[chapterId]` — manga reader
- `/updates` — update feed
- `/downloads` — downloaded chapters
- `/settings` — app settings

### UI

- Tailwind CSS 4 with `tailwind-merge`, `clsx`, `class-variance-authority`
- `shadcn` component system (`src/components/ui/`)
- `next-themes` for dark/light mode
- `lucide-react` for icons
- `@base-ui/react` for headless UI primitives

## Conventions

- Path aliases: `@/*` and `~/*` both resolve to `./src/*`
- All manga/chapter IDs for scraped content use `scrape:{sourceId}:{hash(url)}` format
- Dexie schema changes require a new `this.version(N).stores({...})` block in `db.ts`
- Tests use Vitest with `globals: true`, environment `node`. Test files are co-located: `*.test.ts` next to source
- The proxy route is the only way to fetch external manga site content from the client

## Next.js Version

This is Next.js 16 with potential breaking changes from training data. Check `node_modules/next/dist/docs/` before writing Next.js-specific code.
