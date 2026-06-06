# Source Architecture Guide

Read this file before changing source/provider architecture.

## Goal

Every content source must behave the same from app perspective.

- API source and scrape source use same module pattern
- app code uses gateway only
- scraping is internal implementation detail
- no `scrape:` special path in gateway, UI, hooks, sync, or reader flow

## Core rule

Every source lives here:

- `src/services/sources/<source-name>/impl.ts`
- `src/services/sources/<source-name>/module.ts`

Every source module exports:

```ts
export const someSourceModule = {
  id: 'some-source',
  name: 'Some Source',
  provider: someSourceProvider,
}
```

## Gateway flow

App-facing lookup must go through:

- `src/infrastructure/sources/gateway.ts`
- `src/infrastructure/sources/registry.ts`

App code should only do this:

```ts
const provider = sourceGateway.getProvider('komiku')
```

Not this:

- direct imports from source implementation files in UI/hooks
- special-case scrape registration paths
- source id parsing that depends on `scrape:` prefix

## Current module examples

API-backed:
- `src/services/sources/mangadex/`
- `src/services/sources/comick/`

Scrape-backed but same module shape:
- `src/services/sources/komiku/`

Komiku uses `ScrapeAdapter` internally, but externally behaves like any other source module.

## Internal scrape pieces

These files are internal helpers, not app-facing source architecture:

- `src/services/scrape/scrapeAdapter.ts`
- `src/services/scrape/presets.ts`
- `src/services/scrape/sessionStore.ts`
- `src/services/scrape/autoDetect.ts`

They may be used by source modules, especially scrape-backed ones.

## Register new source

1. Create module folder:
   - `src/services/sources/<source-name>/impl.ts`
   - `src/services/sources/<source-name>/module.ts`

2. Implement provider in `impl.ts`
   - must satisfy `SourceProvider`
   - must expose `id`
   - must expose `name`

3. Export module in `module.ts`

4. Register module in registry:
   - edit `src/infrastructure/sources/registry.ts`
   - add module to `STATIC_PROVIDER_MODULES`

5. Verify app still uses gateway only

## Source id format

Unified format:

- manga id: `{sourceId}:{remoteOrDerivedId}`
- chapter id: `{sourceId}:...`

Examples:
- `mangadex:12345`
- `comick:abcde`
- `komiku:solo-leveling`
- `komiku:ch:abc123`

Do not add new prefixes like `scrape:`.

## Files that should stay generic

These files must not hardcode source-specific architecture branches:

- `src/infrastructure/sources/gateway.ts`
- `src/infrastructure/sources/registry.ts`
- `src/presentation/hooks/use-manga-details.ts`
- `src/presentation/hooks/use-reader-chapter.ts`
- `src/services/downloads/download-manager.ts`
- `src/db/sync.ts`

If one of these files needs source-specific behavior, push that behavior down into source module implementation.

## Verification checklist

Before merging source changes, verify:

- `sourceGateway.getProvider('<source>')` resolves source
- browse/popular works
- search works
- manga details works
- chapter list works
- reader works
- download path still works for scrape-backed sources
- tests pass
- `npx --no-install tsc --noEmit` passes

## Quick smell test

If adding new source requires editing UI logic for source type differences, architecture is wrong.

If adding new source only needs:
- new module folder
- registry registration
- tests

architecture is correct.
