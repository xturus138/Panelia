# Multi-Source Support Implementation Design

**Goal:** Enable selecting any Keiyoushi source and fetching real manga with full details, chapters, and pages.

**Architecture:** Hybrid approach - manual provider implementations for top 5 sources, with clear fallback for unimplemented sources.

---

## Architecture Overview

```
Browse Page
    ↓ (select source)
SourceRegistry.get(sourceId)
    ↓ (returns provider)
    ├─→ MangaDexProvider ✓ (API)
    ├─→ CubariProvider ✓ (API)
    ├─→ ComikeyProvider ✓ (API)
    ├─→ GlobalComixProvider ✓ (API)
    ├─→ HoneytoonProvider ✓ (API)
    └─→ NotImplementedProvider (fallback)
```

Each provider implements `SourceProvider` interface:
- `getPopular(page)` - Fetch popular manga list
- `getLatest(page)` - Fetch latest updates
- `search(query, page)` - Search manga
- `getMangaDetails(id)` - Get title, description, cover
- `getChapters(mangaId)` - Get chapter list
- `getPages(chapterId)` - Get page URLs for reading

---

## Sources to Implement

| Source | ID | Type | API/Website |
|--------|-----|------|--------------|
| MangaDex | `mangadex` | ✓ Already implemented | api.mangadex.org |
| Cubari | `6338219619148105941` | New | cubari.moe (API) |
| Comikey | `2769857481066602061` | New | comikey.com (API) |
| GlobalComix | `1702911211040495914` | New | globalcomix.com (API) |
| Honeytoon | `1063521896373496908` | New | honeytoon.com (API) |

---

## Provider Specifications

### 1. MangaDexProvider (existing)

- **Base URL:** `https://api.mangadex.org`
- **Auth:** None (public API)
- **Rate limit:** 5 req/sec
- **Data:** JSON API with covers, authors, chapters

### 2. CubariProvider

- **Base URL:** `https://cubari.moe`
- **Endpoints:**
  - Popular: `/api/series/listed/{source}?sort=popularity`
  - Latest: `/api/series/listed/{source}?sort=updated`
  - Details: `/api/series/{mangaId}`
  - Chapters: `/api/series/{mangaId}/chapters`
  - Pages: `/api/read/{chapterId}`
- **Note:** Uses `{source}` placeholder - Cubari proxies many sources

### 3. ComikeyProvider

- **Base URL:** `https://comikey.com`
- **Endpoints:**
  - Popular: `/api/v1/comics?sort=popularity&limit=20`
  - Search: `/api/v1/comics?search={query}`
  - Details: `/api/v1/comics/{id}`
  - Chapters: `/api/v1/comics/{id}/chapters`
  - Pages: `/api/v1/chapters/{id}/pages`
- **Auth:** None (public)

### 4. GlobalComixProvider

- **Base URL:** `https://globalcomix.com`
- **Endpoints:**
  - Popular: `/api/v1/comics?sort=popularity`
  - Search: `/api/v1/comics?search={query}`
  - Details: `/api/v1/comics/{id}`
  - Chapters: `/api/v1/comics/{id}/chapters`
- **Note:** May require API key (public key available)

### 5. HoneytoonProvider

- **Base URL:** `https://www.honeytoon.com`
- **Endpoints:**
  - Popular: `/api/v1/webtoons/genre?genre=all&sort=popular`
  - Search: `/api/v1/webtoons/search?keyword={query}`
  - Details: `/api/v1/webtoons/{id}`
  - Chapters: `/api/v1/webtoons/{id}/chapters`
- **Note:** Korean webtoons, may require CORS proxy

---

## UI Changes

### Browse Page

- Source selector already exists (horizontal scroll)
- Add visual indicator for implemented vs unimplemented sources
- Show source icon (if available from Keiyoushi)

### Manga Details Page (`/manga/[id]`)

- Already receives `id` - need to add `sourceId` parameter
- Current: `/manga/m1` 
- New: `/manga/m1?source=mangadex`

### Reader Page (`/reader/[chapterId]`)

- Already receives chapterId - need to add `sourceId` parameter
- Current: `/reader/m1-c1?manga=m1`
- New: `/reader/m1-c1?manga=m1&source=mangadex`

---

## Implementation Order

1. **Register all providers** in SourceRegistry (mock for now)
2. **Implement CubariProvider** - simplest API structure
3. **Implement ComikeyProvider** - standard REST API
4. **Implement GlobalComixProvider** - similar to Comikey
5. **Implement HoneytoonProvider** - Korean webtoon API
6. **Update UI** - Add sourceId to routes
7. **Test each source** - Verify data flows correctly

---

## Error Handling

- **Unimplemented source:** Show "This source is not yet supported" message with link to request it
- **API failures:** Show error toast, offer retry
- **Empty results:** Show "No manga found" with suggestions

---

## Testing Strategy

Each provider tested with:
1. `getPopular(0)` returns manga list
2. `getMangaDetails(id)` returns full details
3. `getChapters(mangaId)` returns chapter list
4. `getPages(chapterId)` returns page URLs

---

## Files to Create/Modify

**Create:**
- `src/services/cubari.ts`
- `src/services/comikey.ts`
- `src/services/globalcomix.ts`
- `src/services/honeytoon.ts`

**Modify:**
- `src/services/sources.ts` - Register all providers
- `src/app/manga/[id]/page.tsx` - Accept sourceId parameter
- `src/app/reader/[chapterId]/page.tsx` - Accept sourceId parameter
- `src/components/library/MangaCard.tsx` - Add sourceId to links
- Any existing links/ navigation

---

## Success Criteria

- [ ] Browse page shows all 5 sources as selectable
- [ ] Selecting a source loads its popular manga
- [ ] Clicking manga shows full details (title, description, cover)
- [ ] Chapter list loads correctly
- [ ] Reader displays pages from the correct source
- [ ] Unimplemented sources show clear fallback message