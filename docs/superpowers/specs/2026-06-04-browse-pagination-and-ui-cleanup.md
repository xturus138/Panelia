# Browse Mode: Pagination & UI Cleanup Design

## Overview
Update the scrape source system to enforce "developer-only" source addition by removing the in-app configuration UI. Simultaneously, enhance the fetch logic for popular and search queries to fetch all pages behind the scenes, providing a complete "all comics" view without manual pagination.

## Components & Data Flow

### 1. Types & Config Updates (`src/services/scrape/types.ts` & `presets.ts`)
- **`SiteConfig` Changes:** 
  - `popularPage` will change from having a static `url` to a `urlTemplate` to support a `{page}` placeholder.
  - `searchPage` already has `urlTemplate`, but `{page}` will now be supported.
- **Komiku Preset Updates:**
  - `searchPage.urlTemplate`: Updated to support the API page parameter (e.g. `&page={page}`).
  - `popularPage.urlTemplate`: Updated to the paginated route (e.g. `https://komiku.org/page/{page}/`).

### 2. Fetch Logic (`src/services/scrape/scrapeAdapter.ts`)
- **Sequential Fetch Loop:** Both `searchManga` and `getPopularResults` will be updated to fetch pages sequentially.
  - Start at `page = 1`.
  - Replace `{page}` in the `urlTemplate`.
  - Fetch and parse results.
  - If results exist, append to list, increment `page`, and fetch the next page.
  - Stop condition: When a page returns 0 results OR `page > 10` (safety cap to prevent infinite loops/rate limiting).

### 3. UI Cleanup (`src/app/browse/page.tsx`)
- **Remove "Add Source" Button:** The disabled "+ Add source" tab button will be removed.
- **Remove Dev Tools:** 
  - The `Settings2` (gear icon) button next to the search bar.
  - The entire "Config Panel" (JSON editor).
  - The `showConfig` state, `configJson` state (can be replaced by direct config reference), and the `handleRedetect` function.
  - The `save` functionality will use the predefined `activeSource.config` directly rather than reading from `configJson` state.

## Architecture
- **Isolation:** The pagination logic is contained entirely within the `ScrapeAdapter`, keeping the UI completely unaware of pagination. The UI simply receives a larger array of results.
- **Safety:** The hard limit of 10 pages ensures the background fetch doesn't overload the source API or hang indefinitely.

## Testing Strategy
- Verify that opening the browse page with Komiku selected takes slightly longer but loads significantly more results than before.
- Verify searching for a common term fetches multiple pages of results.
- Verify the settings gear and "+ Add source" buttons are completely gone from the UI.
