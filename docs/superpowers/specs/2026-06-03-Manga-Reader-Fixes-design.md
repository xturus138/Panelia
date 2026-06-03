# Design: Manga Reader Fixes

Fix three issues in the manga reader: incorrect cover images (Japanese flag), incorrect chapter counts for Komiku source, and external tab navigation instead of in-app reader.

## Architecture

1.  **Preset Selector Tightening**: Update `src/services/scrape/presets.ts` with precise CSS selectors for Komiku's cover and chapter list.
2.  **Navigation Fix**: Update `src/app/browse/page.tsx` to use Next.js `Link` for chapter navigation, keeping the user within the app's reader route.
3.  **Cover Validation**: Implement a validation helper in `src/app/browse/page.tsx` to filter out noise images (flags, logos) and fallback to a neutral placeholder.

## Components & Data Flow

### 1. Komiku Preset Update (`src/services/scrape/presets.ts`)
Update the `komiku` preset `SiteConfig`:
-   `mangaPage.cover`: Change from `img.wp-post-image, .thumb img, img` to `.ims img`.
-   `mangaPage.chapterList`: Change from `a[href*="chapter" i]` to `table#Daftar_Chapter tbody tr[itemprop='itemListElement'] a`.

### 2. Navigation Update (`src/app/browse/page.tsx`)
-   Replace `<a>` tag in the chapter list detail view with Next.js `<Link>`.
-   Href format: `/reader/${ch.id}?manga=${mangaData.id}`.

### 3. Cover Validation (`src/app/browse/page.tsx`)
-   Helper: `validateCoverUrl(url: string): Promise<string>`.
    -   Performs `fetch(url, { method: 'HEAD' })`.
    -   Verifies status 200 and `content-type` starts with `image/`.
    -   Rejects URLs containing noise patterns: `/jp.png`, `/kr.png`, `/cn.png`, `/logo`, `/icon`.
-   Integration: Call helper in `handleSelectResult` and `handleSave`.
-   Fallback: `https://placehold.co/400x600/1a1a1a/cccccc?text=No+Cover`.

## Testing

1.  **Manual Test (Browse)**: Search "Infinite Golden Traits" on Komiku, verify cover is the manga art, not a flag.
2.  **Manual Test (Chapters)**: Verify exactly 3 chapters are listed (matching site table), not 5.
3.  **Manual Test (Reader)**: Click a chapter in Browse detail view, verify it opens `/reader/[id]` inside the app, not a new tab.
4.  **Integration Test**: Save manga to library, verify cover persists correctly in Library page.
