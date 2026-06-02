Build a Mihon-inspired manga/comic reader as a web app, but do not copy Mihon branding, code, UI assets, or proprietary source behavior. The app should be a Progressive Web App so it can run in a browser and be installed on Android from Chrome/Samsung Internet without APK distribution.

Project name: Panelia

Goal:
Create a modern PWA manga reader with library management, source browsing, chapter reading, offline caching, and Android-installable behavior. Mihon is the inspiration because it has a library tab, categories, multiple reader modes, extensions/sources, tracking, backups, dark/light theme, and local reading features. However, this project should be implemented as an original web-first app. Mihon itself is an Android Kotlin app, while this project must be browser-first/PWA-first.

Core tech stack:
- Next.js or Vite + React
- TypeScript
- Tailwind CSS
- Zustand or Redux Toolkit for state
- IndexedDB using Dexie.js for local database
- Service Worker + Web App Manifest for PWA installability
- React Router if using Vite
- No native Android APK code
- Mobile-first responsive UI

Main features:

1. PWA installable app
- Add `manifest.json`
- Add app icon placeholders
- Add service worker
- Support offline shell loading
- Display mode should be standalone
- App should feel like a native Android reader when installed
- Add an “Install App” prompt/button when supported

2. App layout
Create a mobile-first interface with bottom navigation:
- Library
- Browse
- Updates
- Downloads
- Settings

Use a clean dark theme by default, with light theme support.

3. Library screen
- Show saved manga/comic titles in a grid/list
- Each item has cover, title, unread count, latest chapter, source name
- Add category filtering
- Add search within library
- Add sort options: title, latest update, unread, date added
- Empty state with button to browse sources

4. Browse screen
Because this is a web app, create a clean source system:
- Add a mock source provider interface
- Add one demo source using static JSON data
- Design source adapter architecture so future sources can be added
- Support adding external repository URLs (e.g., `https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json`) to dynamically fetch, list, install, and update third-party sources/extensions
- Each source should support:
  - search(query)
  - getPopular()
  - getLatest()
  - getMangaDetails(id)
  - getChapters(mangaId)
  - getPages(chapterId)

5. Manga details page
- Cover image
- Title
- Author
- Status
- Description
- Genres/tags
- Source
- Add to Library / Remove from Library button
- Chapter list
- Chapter sorting ascending/descending
- Mark chapter as read/unread
- Download/offline button per chapter

6. Reader screen
Create a configurable reader similar in concept to manga reader apps:
- Vertical scroll mode
- Webtoon continuous mode
- Single page mode
- Double page mode for wider screens
- RTL/LTR reading direction setting
- Tap zones or buttons for next/previous page
- Reader settings overlay
- Brightness overlay simulation using CSS
- Fit width / fit height / original size
- Remember reading progress per chapter
- Resume reading from last page

7. Offline support
Use IndexedDB for:
- Library entries
- Manga metadata
- Chapter read progress
- Cached chapter page URLs or blobs
- Settings
- Categories

Use Cache API or IndexedDB for offline page caching. For demo content, make downloaded chapters readable offline after caching.

8. Updates screen
- Show mock latest chapter updates from saved library items
- Add “Check for updates” button
- Store last checked timestamp
- For now, simulate update checking using the demo source

9. Downloads screen
- Show downloaded/offline chapters
- Show storage usage estimate
- Allow deleting a downloaded chapter
- Allow deleting all downloads

10. Settings screen
Include:
- Theme: system/light/dark
- Reader mode
- Reading direction
- Page fit mode
- Library grid/list toggle
- Backup export/import JSON
- Clear cache
- About app

11. Backup system
- Export library, categories, reading progress, and settings as JSON
- Import from JSON
- Validate imported structure before applying

12. Data model
Create TypeScript interfaces for:
- Manga
- Chapter
- Page
- Source
- LibraryEntry
- Category
- ReadProgress
- DownloadedChapter
- AppSettings

13. UI quality
The app should look polished:
- Use cards, skeleton loading states, empty states, bottom sheets/modals
- Smooth transitions
- Good mobile spacing
- Reader should be immersive and hide navigation while reading
- Use placeholder demo covers/pages if needed
- Do not make the UI look like a basic CRUD dashboard

14. Deliverables
- Fully working local development app
- Clean folder structure
- README with setup instructions
- PWA install instructions for Android browser
- Demo data included
- No APK output
- No backend required for v1 unless necessary


Build the first complete MVP with mock/demo content. Prioritize making the app usable on mobile browser and installable as a PWA.