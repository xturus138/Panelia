# Comix vs Komiku: Comic Loading Differences

## Architecture

### Komiku
- **Type**: Scrape-based (HTML parsing)
- **Implementation**: `ScrapeAdapter` class
- **Loading**: Uses CSS selectors to parse HTML and extract manga/chapter/page data
- **Data Fetching**: Relies on HTML scraping via `/api/proxy`

### Comix
- **Type**: API-based (REST JSON endpoints)
- **Implementation**: `ComixProvider` class (direct `SourceProvider` implementation)
- **Loading**: Uses native REST API calls to fetch structured JSON data
- **Data Fetching**: Direct API calls with Cloudflare token handling and proxy support

---

## Loading Flow Comparison

### **Komiku (Scraping)**

#### Popular/Search Load Flow:
```
1. User requests popular/search
   ↓
2. ScrapeAdapter.getPopularPage(page) 
   ↓
3. buildPageUrl() - converts {page} placeholder to URL
   - Special handling: /manga/{page}? → /page/{page}/ for pages 2+
   ↓
4. fetchListingPage(url)
   - fetch(/api/proxy?url=...)
   - Receives HTML response
   ↓
5. parseSearchResults(html, selectors)
   - Uses CSS selectors: resultItem, resultTitle, resultUrl, resultCover
   - Parses DOM tree with node-html-parser
   - Returns SearchResult[] with computed IDs
   ↓
6. Results: ~30 items per page (limited by MAX_LISTING_PAGES = 10)
```

#### Manga Details Load Flow:
```
1. User clicks on manga
   ↓
2. Fetch manga page HTML via /api/proxy
   ↓
3. parseMangaPage(html)
   - Extracts title, cover, chapter list (all from single HTML parse)
   - Builds chapter array from table#Daftar_Chapter tbody
   - Returns ParsedMangaPage with embedded chapters
   ↓
4. Result: Manga + chapters extracted in single parse
```

#### Chapter Load Flow:
```
1. Chapter list already obtained from parseMangaPage
   - No additional fetch needed (already in ParsedMangaPage.chapters)
   ↓
2. User reads chapter
   ↓
3. Fetch chapter HTML via /api/proxy
   ↓
4. parseChapterPage(html)
   - Queries img selector: #Baca_Komik img
   - Filters images (removes lazy placeholders, tiny images, data URIs)
   - Returns Page[] with imageUrl
```

**Key:** All data for a manga (title, cover, chapters) is extracted in **one HTML parse** during manga page load.

---

### **Comix (API)**

#### Popular/Search Load Flow:
```
1. User requests popular/search
   ↓
2. ComixProvider.getPopular(page) / .search(query, page)
   ↓
3. fetchJson<ComixResponse<ComixPaginated<ComixManga>>>()
   - Uses Cloudflare-aware proxy: /api/proxy?url=...&referer=...
   - Receives JSON response with result.items
   ↓
4. mapMangaList(data.result.items)
   - Transforms API manga objects to Manga[]
   - ~30 items per page
   ↓
5. Result: Manga[] (without chapters)
```

#### Manga Details Load Flow:
```
1. User clicks on manga
   ↓
2. ComixProvider.getMangaDetails(mangaId)
   ↓
3. fetchJson<ComixResponse<ComixManga>>(/api/v1/manga/{id})
   - Returns single manga object
   ↓
4. mapManga(data.result)
   - Returns Manga (still no chapters)
```

**Note:** `getMangaDetails()` does NOT include chapters. Chapters are fetched separately.

#### Chapter Load Flow:
```
1. User opens manga details
   ↓
2. SEPARATE API call needed: ComixProvider.getChapters(mangaId)
   ↓
3. fetchJson<ComixResponse<ComixChapter[]>>(/api/v1/manga/{mangaId}/chapters)
   ↓
4. mapChapters(data.result.items)
   - Returns Chapter[]
   ↓
5. Result: Chapters loaded in second fetch
```

**Key Issue:** Comix **requires a Cloudflare token** to access `/api/v1/manga/{id}/chapters`
- Token is generated client-side in browser via Cloudflare challenges
- Cannot be easily replicated server-side
- Current implementation catches 403 error and throws `COMIX_CHAPTERS_UNAVAILABLE`
- **This prevents chapters from loading**

#### Page Load Flow:
```
1. User opens chapter
   ↓
2. ComixProvider.getPages(chapterId)
   ↓
3. fetchJson(/api/v1/chapter/{chapterId})
   - Expects JSON with result.images array
   ↓
4. Returns Page[] from image URLs
```

---

## Why Comix Loads "More" (But Incompletely)

### Apparent Abundance:
1. **Popular/Search** returns results quickly (API is fast)
2. **Manga List** shows many titles (~30 per page)
3. **UI displays** the manga cards

### But Chapter Loading Fails:
1. `getChapters()` requires Cloudflare token
2. Token unavailable server-side → 403 error
3. UI catches error and shows "Chapters unavailable"
4. Users see many manga but **cannot open any**

### Komiku:
1. **Popular/Search** also returns ~30 per page
2. **Manga Details** embeds chapters in `parseMangaPage()`
3. Chapters load **automatically** with no extra API call
4. Users can **actually read** chapters

---

## Technical Root Causes

| Aspect | Komiku | Comix |
|--------|--------|-------|
| **Data Fetching** | HTML scraping | REST API |
| **Chapters Included** | ✅ In manga page HTML | ❌ Separate API endpoint |
| **Auth Token** | ❌ Not needed | ⚠️ Cloudflare token (client-side only) |
| **Server-Side Viability** | ✅ Full HTML parsing works | ❌ Missing auth token breaks chapter fetch |
| **Load Flow** | 1 parse = manga + chapters | 2+ API calls = manga, then chapters (fails) |
| **User Experience** | ✅ Works end-to-end | ❌ Manga visible, chapters fail to load |

---

## Why This Matters

**Komiku = Functional but Slow**
- Scraping every page takes time
- But it works end-to-end
- Users can browse and read

**Comix = Fast API but Broken Chapter Access**
- Popular/search is fast
- Manga details fetch quickly
- **Chapter fetch fails** due to Cloudflare token requirement
- Users see "many" titles but can't actually read anything

---

## Solutions

### For Comix:
1. **Implement Cloudflare bypass** (e.g., Puppeteer/Playwright to generate token)
2. **Scrape chapter list from manga page HTML** instead of API
3. **Use Browser Automation** to handle Cloudflare challenges
4. **Document the limitation** and disable Comix until token issue is solved

### For Komiku:
1. **Already functional** – no changes needed
2. Optimization: cache parsed HTML to avoid re-parsing

---

## Summary

**Comix loads more because:**
- Fast JSON API returns many results quickly
- Popular/search shows ~30 titles per page
- **But chapters fail to load** due to missing Cloudflare token

**Komiku loads fewer because:**
- Slower HTML scraping
- But **actually delivers complete data** (chapters included in page parse)
- Users can browse and read end-to-end

The "many" in Comix is a **false abundance** – abundance of inaccessible data.
