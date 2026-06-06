# Panelia Clean Architecture Refactor Design

**Date:** 2026-06-05  
**Status:** Approved for Specification Review  
**Target:** Refactor Panelia toward layered clean architecture, remove unused/duplicate files safely, and improve modularity without regressing current behavior.

## 1. Goals

Refactor the current Next.js 16 + React 19 + Dexie + Zustand codebase into a layered clean architecture that:

- separates pure domain concepts from infrastructure and UI concerns
- consolidates duplicated state-management structure
- reduces large multi-responsibility page files
- keeps scraping, source-provider, and IndexedDB logic outside presentation
- deletes only files that are proven duplicate, replaced, or unused
- preserves existing user-facing behavior during the structural migration

## 2. Non-Goals

This refactor does **not** aim to:

- redesign product features
- change the app from client-side/offline-first to server-backed
- replace Next.js App Router, Dexie, Zustand, or Tailwind
- rewrite the scrape engine unless required for architectural boundaries
- remove tests that still document behavior

## 3. Proposed Layered Structure

```text
src/
├── domain/
│   ├── types/
│   │   ├── manga.ts
│   │   ├── library.ts
│   │   ├── settings.ts
│   │   ├── source.ts
│   │   └── index.ts
│   └── interfaces/
│       ├── repository.ts
│       ├── source-provider.ts
│       └── index.ts
│
├── infrastructure/
│   ├── db/
│   │   ├── db.ts
│   │   ├── manga.ts
│   │   ├── chapters.ts
│   │   ├── library.ts
│   │   ├── downloads.ts
│   │   ├── read-progress.ts
│   │   ├── scrape-sources.ts
│   │   ├── settings.ts
│   │   └── index.ts
│   ├── sources/
│   │   ├── mangadex.ts
│   │   ├── comick.ts
│   │   ├── registry.ts
│   │   └── index.ts
│   ├── scrape/
│   │   ├── types.ts
│   │   ├── scrape-adapter.ts
│   │   ├── presets.ts
│   │   ├── auto-detect.ts
│   │   ├── session-store.ts
│   │   ├── *.test.ts
│   │   └── __fixtures__/
│   ├── services/
│   │   ├── status-service.ts
│   │   ├── sync-service.ts
│   │   └── proxy-service.ts
│   └── api/
│       ├── proxy/route.ts
│       └── sync/route.ts
│
├── presentation/
│   ├── app/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── library/
│   │   ├── browse/
│   │   ├── manga/
│   │   ├── reader/
│   │   └── settings/
│   ├── hooks/
│   └── stores/
│       ├── library-store.ts
│       ├── reader-store.ts
│       ├── settings-store.ts
│       └── toast-store.ts
│
├── lib/
│   ├── utils.ts
│   └── constants.ts
│
└── tests/
```

## 4. Layer Responsibilities

### 4.1 Domain

The `domain` layer contains only business-facing types and contracts.

Responsibilities:
- entity and value-object types (`Manga`, `Chapter`, `LibraryEntry`, `AppSettings`, etc.)
- repository contracts
- source-provider contracts
- domain-safe enums and shared business vocabulary

Rules:
- must not import from Dexie, Next.js, React, Zustand, scraping modules, or UI components
- must be stable and framework-agnostic

### 4.2 Infrastructure

The `infrastructure` layer implements persistence, scraping, source providers, and integration details.

Responsibilities:
- Dexie schema and data-access modules
- MangaDex and Comick implementations
- scrape adapter, presets, config, and supporting utilities
- sync/proxy/status services
- API route backing modules

Rules:
- may depend on `domain`
- must not import from `presentation`
- should expose focused repository/service functions instead of large god-modules

### 4.3 Presentation

The `presentation` layer contains all React/Next.js UI concerns.

Responsibilities:
- App Router pages/layouts
- React components
- UI hooks
- Zustand stores
- route-level orchestration and user interaction state

Rules:
- should not contain scraping logic or raw Dexie calls inside components
- page files should be route entrypoints rather than large feature containers
- hooks and store actions should bridge UI to infrastructure functions

## 5. Dependency Rules

Allowed:
- `domain` → no internal app dependency
- `infrastructure` → may depend on `domain`
- `presentation` → may depend on `domain` and call infrastructure through exported repository/service functions
- `lib` → may be used by all layers if it remains framework-agnostic

Forbidden:
- `domain` importing from `presentation`, `infrastructure`, `app`, Dexie, Next.js, or Zustand
- `infrastructure` importing from `presentation`
- page/components directly owning DB or scrape orchestration
- components directly performing persistence or source fetching

## 6. Module Boundaries

### 6.1 Components

Components in `presentation/components/**` should be mostly props-driven and rendering-focused.

Examples:
- `MangaCard` renders metadata and action triggers
- layout components render shell/navigation concerns
- reader components manage display behavior, not persistence implementation

If a component accumulates too much non-render logic, move that logic to a hook, store action, or infrastructure service.

### 6.2 Hooks

Hooks in `presentation/hooks/**` should orchestrate:
- route params
- async loading state
- derived UI state
- component-facing actions

Candidate hooks include:
- `useLibraryView()`
- `useMangaDetails(mangaId)`
- `useReaderChapter(chapterId)`
- `useToast()`

### 6.3 Stores

All Zustand state should be consolidated into a single directory:
- `library-store.ts`
- `reader-store.ts`
- `settings-store.ts`
- `toast-store.ts`

Store rules:
- own UI/application state
- expose typed actions/selectors
- keep logic small and slice-like
- avoid embedding scrape selector logic or large infrastructure pipelines

This specifically removes the current duplication between `src/store/*` and `src/stores/*`.

### 6.4 DB Modules

Database logic should be split by concern under `infrastructure/db/`:
- `manga.ts`
- `chapters.ts`
- `library.ts`
- `downloads.ts`
- `read-progress.ts`
- `scrape-sources.ts`
- `settings.ts`

`db.ts` remains the Dexie schema/instance definition only.

Exports should be verb-oriented and focused, for example:
- `getMangaById`
- `saveManga`
- `getLibraryEntries`
- `updateReadProgress`

### 6.5 Sources and Scrape Engine

Responsibilities are separated as follows:
- `infrastructure/sources/` for concrete provider integrations (MangaDex, Comick)
- `infrastructure/scrape/` for generic CSS-selector scraping engine and related utilities
- `infrastructure/services/` for cross-cutting operational helpers

The current ambiguous split between `src/services/sources.ts` and `src/services/sources/index.ts` should be consolidated into a single registry home: `infrastructure/sources/registry.ts`.

## 7. Naming Conventions

To improve consistency and discoverability:

- files use kebab-case: `manga-card.tsx`, `status-service.ts`
- component exports use PascalCase
- hooks use `useXxx`
- stores use `xxx-store.ts`
- repository modules use noun-based file names and verb-based exports

## 8. Cleanup and Deletion Strategy

The cleanup must be safe and evidence-based.

### 8.1 Migration Order

1. consolidate duplicates first
2. move files into new layers without changing behavior
3. split oversized files only after the structure is stable
4. delete files only after proving they are duplicate, replaced, or unused

### 8.2 Deletion Rules

A file may be deleted only if at least one of these is true:
- it is a duplicate replaced by a merged module
- it is confirmed unused by imports and runtime flow
- it is obsolete after relocation and replaced with a new module
- it is generated noise not required by the app or tests

Examples likely removable during refactor:
- duplicate store files after consolidation
- obsolete source-registry indirection files after merge
- local Playwright log artifacts under `.playwright-mcp/` if repo hygiene is desired

Examples requiring verification before deletion:
- `autoDetect.ts`
- `sessionStore.ts`
- `extensions.ts`
- test files that may still capture intended behavior

## 9. Route Refactor Expectations

These pages are likely too broad and should become thinner orchestration entrypoints:
- `src/app/browse/page.tsx`
- `src/app/manga/[id]/page.tsx`
- `src/app/reader/[chapterId]/page.tsx`
- `src/app/settings/page.tsx`

Target flow:
1. route file reads params and composes feature hooks/components
2. hook coordinates state and async loading
3. store manages shared UI/application state where needed
4. infrastructure modules perform DB/source work
5. components render UI only

## 10. Verification Strategy

After each refactor phase, verify with:
- `npm run lint`
- targeted Vitest runs for touched modules
- full `npx vitest` after major structural changes if feasible
- smoke-check of key routes:
  - `/library`
  - `/browse`
  - `/manga/[id]`
  - `/reader/[chapterId]`
  - `/settings`

## 11. Success Criteria

The refactor is successful when:
- there is only one store location
- route pages are significantly thinner
- DB logic is separated by concern
- source registry has one clear home
- domain contracts/types are separate from implementations
- duplicate/unused replacement files are removed safely
- imports are more predictable and modular
- lint and tests pass after the migration

## 12. Recommended Execution Style

Use an incremental migration rather than a single rewrite:
- preserve working behavior while moving boundaries
- normalize imports after each structural step
- avoid deleting ambiguous files until dependency checks confirm safety
- prefer small, well-bounded modules over large generalized ones

This balances clean architecture goals with the current PWA’s offline-first and scrape-heavy constraints.
