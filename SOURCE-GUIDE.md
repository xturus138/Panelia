# Source Gateway Guide

## Where source lives

Source system splits into 2 parts:

- **Gateway**: `src/infrastructure/sources/gateway.ts`
- **Registry**: `src/infrastructure/sources/registry.ts`

App code should go through gateway, not direct provider files.

## Add new source

1. Create module folder:
   - `src/services/sources/<source-name>/impl.ts`
   - `src/services/sources/<source-name>/module.ts`

2. Implement provider in `impl.ts`:
   - must expose `id`
   - must expose `name`
   - must satisfy `SourceProvider`

3. Export module in `module.ts`:
   - `id`
   - `name`
   - `provider`

4. Register module in gateway:
   - `src/infrastructure/sources/registry.ts`
   - import module
   - add module to static provider list

5. Add or update tests:
   - `src/infrastructure/sources/registry.test.ts`
   - `src/infrastructure/sources/gateway.test.ts`
   - `src/infrastructure/sources/no-leak.test.ts`

## Rules

- Do not call source files directly from app layer.
- Do not add source logic in UI files.
- Keep source-specific code inside its own module folder.
- Use gateway for lookup, registration, and rehydration.

## Komiku

Komiku is not static provider. It is scrape preset.

File:
- `src/services/scrape/presets.ts`

Preset id:
- `komiku`

What it does:
- defines `baseUrl`
- defines search/popular/manga/chapter selectors
- gets converted into scrape source when needed

Related flow:
- `src/services/scrape/presets.ts`
- `src/services/scrape/scrapeAdapter.ts`
- `src/infrastructure/sources/registry.ts`

## Naming

- static source example: `mangadex`, `comick`
- scrape source example: `scrape:preset-komiku`

## Quick check

If you add new source and app code needs direct import of its file, design is wrong. Put it behind gateway.
