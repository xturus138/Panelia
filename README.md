# Panelia

A Mihon-inspired manga/comic reader Progressive Web App (PWA) built with Next.js 15.

## Read docs first

Before changing architecture, especially source/provider code, read docs in `/docs` first.

Key docs:
- `docs/SOURCE-GUIDE.md` — unified source/provider architecture guide
- `docs/superpowers/plans/2026-06-06-modular-source-gateway.md` — source gateway refactor plan/history
- `docs/superpowers/specs/2026-06-03-multi-source-design.md` — earlier multi-source design notes

If you work on sources, providers, browse, reader, sync, or downloads, read `docs/SOURCE-GUIDE.md` first.

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

1. Clone repository:
```bash
git clone <repository-url>
cd Panelia
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in browser.

### Build for Production

```bash
npm run build
npm run start
```

## Project Structure

```text
src/
├── app/                     # Next.js App Router pages
├── components/              # UI components
├── db/                      # Data sync and persistence helpers
├── domain/                  # Core domain types and interfaces
├── hooks/                   # Custom React hooks
├── infrastructure/          # Gateways, registries, db adapters, services
├── presentation/            # View-model hooks and stores
├── services/
│   ├── scrape/              # Internal scrape helpers
│   └── sources/             # Unified source modules
└── types/                   # Compatibility exports
```

## Unified source architecture

All sources now follow one module-based architecture.

- every source lives under `src/services/sources/<source-name>/`
- every source exposes same provider interface
- gateway lookup goes through `sourceGateway.getProvider('<source>')`
- scrape vs API is internal implementation detail only

Current source modules:
- `mangadex`
- `comick`
- `komiku`

For source work, read `docs/SOURCE-GUIDE.md`.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Verification commands

Useful checks for source/provider work:

```bash
npx --no-install tsc --noEmit
npx --no-install vitest run src/infrastructure/sources/ src/services/sources/ src/services/scrape/
```

## Documentation

Project documentation lives in `/docs`.

Current important docs:
- `docs/SOURCE-GUIDE.md`
- `docs/superpowers/plans/`
- `docs/superpowers/specs/`

## PWA Installation

### Android (Chrome)

1. Open app in Chrome
2. Tap menu button (three dots)
3. Tap "Add to Home screen"
4. Confirm installation

### Desktop (Chrome/Edge)

1. Open app in browser
2. Look for install icon in address bar
3. Click "Install"

## License

MIT
