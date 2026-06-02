# Panelia

A Mihon-inspired manga/comic reader Progressive Web App (PWA) built with Next.js 15.

## Features

- 📚 **Library Management** - Save and organize your manga collection
- 🔍 **Browse Sources** - Discover manga from multiple sources
- 📖 **Reader** - Vertical scroll reading mode with tap controls
- 🌙 **Dark Theme** - Dark mode by default with light theme support
- 📱 **PWA** - Install as an app on mobile devices
- 💾 **Offline Support** - IndexedDB for local data storage

## Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework with App Router
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [Dexie.js](https://dexie.org/) - IndexedDB wrapper
- [Lucide React](https://lucide.dev/) - Icons

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm, yarn, or pnpm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Panelia
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm run start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── browse/            # Browse sources
│   ├── downloads/         # Downloaded chapters
│   ├── library/           # User's library
│   ├── manga/[id]/        # Manga details
│   ├── reader/[chapterId]/ # Reader screen
│   ├── settings/          # App settings
│   └── updates/           # Update notifications
├── components/
│   ├── layout/            # Layout components (BottomNav, ThemeProvider)
│   ├── library/           # Library components (MangaCard)
│   └── ui/                # shadcn/ui components
├── db/                    # Dexie database service
├── hooks/                 # Custom React hooks
├── services/             # Source providers
├── store/                 # Zustand stores
└── types/                 # TypeScript interfaces
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Adding New Sources

Sources implement the `MockSourceProvider` interface in `src/services/mock-source.ts`. Future sources can be added by creating new provider classes that implement:

```typescript
interface SourceProvider {
  search(query: string): Promise<Manga[]>;
  getPopular(): Promise<Manga[]>;
  getLatest(): Promise<Manga[]>;
  getMangaDetails(id: string): Promise<Manga>;
  getChapters(mangaId: string): Promise<Chapter[]>;
  getPages(chapterId: string): Promise<Page[]>;
}
```

## PWA Installation

### Android (Chrome)

1. Open the app in Chrome
2. Tap the menu button (three dots)
3. Tap "Add to Home screen"
4. Confirm installation

### Desktop (Chrome/Edge)

1. Open the app in browser
2. Look for the install icon in the address bar
3. Click "Install"

## License

MIT