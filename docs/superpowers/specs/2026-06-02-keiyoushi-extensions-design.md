# Keiyoushi Extensions Integration Design

## Goal
Integrate real manga sources using the Keiyoushi extensions repository while maintaining the existing app architecture.

## Scope for This Iteration
- Fetch and display real source catalog from https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json
- Implement a real adapter for MangaDex source using their public API
- Allow users to browse sources and select MangaDex for real manga data
- Maintain backward compatibility with existing mock data for unimplemented sources

## Architecture Overview

### Core Components

1. **ExtensionService** (`src/services/extensions.ts`)
   - Fetches and caches the Keiyoushi extensions index
   - Maps Keiyoushi metadata to Panelia's internal Source type
   - Provides source discovery and filtering capabilities

2. **SourceProvider Interface** (`src/types/index.ts` - extended)
   - Standard contract for all source implementations (mock and real)
   - Methods: getPopular, getLatest, search, getMangaDetails, getChapters, getPages

3. **SourceRegistry** (`src/services/sources.ts`)
   - Factory pattern mapping source IDs to provider implementations
   - Fallback to MockSourceProvider for unimplemented sources
   - Registration system for real source adapters

4. **MangaDexProvider** (`src/services/mangadex.ts`)
   - Concrete implementation of SourceProvider using MangaDex API
   - Handles API rate limiting and data mapping
   - Implements all required methods with real HTTP calls

5. **UI Integration** (`src/app/browse/page.tsx`, etc.)
   - Browse page displays available sources from ExtensionService
   - Source selection stores active source ID in state
   - Data fetching uses SourceRegistry.get(activeSourceId) instead of hardcoded mockSource

## Data Flow

1. **App Start**: ExtensionService fetches Keiyoushi index (cached 24h)
2. **Browse Load**: UI requests source list from ExtensionService
3. **Source Selection**: User selects a source (e.g., MangaDex)
4. **Provider Resolution**: App gets provider from SourceRegistry using source ID
5. **Data Fetching**: Provider makes direct API calls (MangaDex: api.mangadex.org)
6. **Rendering**: Existing UI components render real data identically to mock

## Implementation Details

### ExtensionService
- Fetch URL: `https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json`
- Cache strategy: localStorage with timestamp validation (24h expiry)
- Mapping: Convert Keiyoushi extension.sources[] array to Source[] objects
- Filtering: Optional language/NSFW filters based on user settings

### SourceRegistry
- Singleton instance for app-wide access
- Register method: `register(sourceId: string, provider: SourceProvider)`
- Get method: `get(sourceId: string): SourceProvider` (returns mockSource if not found)
- Initial registration: MangaDex provider registered at startup

### MangaDexProvider Implementation
- Base URL: `https://api.mangadex.org`
- Endpoints:
  - Popular: `/manga?order[rating]=desc&limit=20&offset={page*20}`
  - Latest: `/manga?order[createdAt]=desc&limit=20&offset={page*20}`
  - Search: `/manga?title={query}&limit=20&offset={page*20}`
  - Details: `/manga/{id}?includes[]=cover_art&includes[]=author&includes[]=artist`
  - Chapters: `/manga/{id}/feed?translatedLanguage[]=en&limit=500&offset={page*500}`
  - Pages: `/at-home/server/{chapterId}` then construct URLs from hash data

### Type Safety
- Extend existing Manga, Chapter, Page interfaces if needed for API-specific fields
- Maintain strict typing between adapter implementations and UI components
- Use discriminated unions where appropriate for different source types

### Error Handling & Fallbacks
- Network errors: Retry with exponential backoff (3 attempts)
- API errors: Graceful degradation to mock data with user notification
- Missing sources: Fallback to MockSourceProvider with "Source not implemented" indicator
- Rate limiting: Respect MangaDex headers, queue requests if needed

### Performance Considerations
- Cache extension index to avoid repeated fetches
- Consider caching frequently accessed manga data (details, chapters) briefly
- Implement request deduplication for simultaneous identical requests
- Bundle size: Lazy-load source providers only when needed

## Integration Points

### Existing Files to Modify
- `src/types/index.ts`: Add SourceProvider interface if not present
- `src/app/browse/page.tsx`: Replace mock data source with ExtensionService/SourceRegistry
- `src/app/library/page.tsx`: Potentially adapt for real source library sync
- `src/app/settings/page.tsx`: Add options for source filtering (language, NSFW)

### New Files to Create
- `src/services/extensions.ts`
- `src/services/sources.ts`
- `src/services/mangadex.ts`

## Testing Strategy
- Unit tests for ExtensionService parsing and caching
- Integration tests for MangaDexProvider against mock API responses
- Manual testing: Browse sources, select MangaDex, verify real data appears
- Fallback testing: Disable network, verify mock data still works

## Future Extensions
- Add more source adapters (MangaSee, MangaKatana, etc.) following same pattern
- Implement source update notifications when Keiyoushi index changes
- Add source rating/popularity metrics from community
- Implement background sync for library with real sources

## Open Questions
1. Should we prefetch popular sources or load on-demand?
2. How to handle sources requiring authentication (some may need login)?
3. Should we implement a "favorite sources" feature?
4. How to handle sources with different rate limiting policies?

---
*Design committed and ready for implementation planning.*