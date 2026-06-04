# Browse Mode Architecture Design

## Overview
Enable users to browse any manga site naturally inside Panelia, click chapters, and save progress to library — all without installing per-site code.

## Core Pieces

1. **Browse Mode UI** – New route `/browse` rendering a sandboxed browser view.
2. **CORS Proxy** – Existing `src/app/api/proxy/route.ts` genericized to allow any host (with safety caveats).
3. **ScrapeAdapter** – New provider that fetches a URL via proxy, runs user-provided CSS selectors to extract manga metadata (title, cover, chapter list, page images).
4. **Source Registry** – Existing `SourceProvider` interface unchanged. ScrapeAdapter implements it so Browse Mode integrates with library, downloads, reading flow.
5. **Reader Integration** – When user clicks a chapter in Browse Mode, PWA navigates to `/reader/[chapterId]` where `chapterId` is a stable identifier (e.g., `sourceId::<id>:urlHash`). Reader fetches page images via proxy, displays in existing vertical-scroll UI, updates `readProgress` automatically.

## Data flow for adding a source
- User visits `/browse`, enters a manga site homepage (e.g., `https://example.com/manga/one-piece`).
- PWA proxies the request, returns HTML.
- PWA runs a scraper config (see below) against the HTML to extract:
  - `title`: `"One Piece"`
  - `coverUrl`: `https://example.com/covers/one-piece.jpg`
  - `chapters`: array of `{ number, title, url }`
- PWA registers a temporary source in `sourceRegistry` with id `scrape::<hash>`.
- User clicks "Add to Library" → source becomes permanent, chapters added to library as `LibraryEntry`.
- Clicking a chapter in library → `/reader/scrape::<hash>::chapterUrlHash` → reader proxies the chapter URL, extracts image URLs via another config (or reuses same), renders pages.

## Error handling
If proxy fails (timeout, 4xx/5xx), show error toast. If selectors return no data, show "Failed to parse site — try a different URL or check config."

## Preserves existing providers
MangaDex/Comick providers keep working as-is. Browse Mode is an additional source type.

## System diagram
```
Panelia PWA
├── Native-feel reader UI (existing)
├── "Browse Mode" = thin browser wrapper
│   └── All requests go through CORS proxy → Target Site HTML
│       └── Proxy strips CORS, returns HTML to PWA
│           └── PWA renders it + can parse it for "Save" action
├── ScrapeAdapter
│   └── Takes URL + JSON config (CSS selectors) → extracts manga metadata
│       └── Implements SourceProvider → integrates with library/downloads
└── Reader shows extracted page images in existing page renderer
    └── Uses existing readProgress tracking
```

## Implementation milestones
1. Generalize proxy to allow any host (remove hard‑coded host list)
2. Add `/browse` route with sandboxed view
3. Build ScrapeAdapter (URL → HTML → metadata extraction)
4. Create scraper config format (JSON/YAML) for CSS selectors
5. Add user actions: "Add to Library" from browse view
6. Connect to existing Reader UI for chapter reading
7. Update library metadata tracking for scrape sources

## Risks
- Over‑broad proxy CORS could open attack surface → need host whitelist fallback
- Selector parsing fragile → need validation & error messages
- User‑submitted URLs could point to malicious sites → need sandboxing practices
- Proxy performance at scale → consider caching or rate limiting