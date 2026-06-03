# Panelia Frontend Redesign - Design Spec

**Date:** 2026-06-03
**Status:** Approved

---

## Design Direction

**Aesthetic:** Clean Minimal
**Description:** Generous whitespace, subtle shadows, elegant typography. A modern, refined reading experience that's easy on the eyes.

---

## Design System

### Color Palette: Warm Neutrals

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#faf9f7` | Page background |
| `background-card` | `#ffffff` | Card surfaces |
| `text-primary` | `#1a1a1a` | Headings, primary text |
| `text-secondary` | `#888888` | Subtitles, descriptions |
| `text-muted` | `#666666` | Timestamps, metadata |
| `accent` | `#6366f1` | Buttons, highlights, active states |
| `accent-hover` | `#4f46e5` | Button hover state |
| `border` | `#e5e5e5` | Borders, dividers |
| `surface` | `#f5f5f5` | Input backgrounds, subtle fills |

### Typography

**Font Family:** Plus Jakarta Sans (Google Fonts)

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 (Page titles) | 28px | 700 | 1.2 |
| H2 (Section headers) | 20px | 600 | 1.3 |
| H3 (Card titles) | 13px | 600 | 1.4 |
| Body | 14px | 400 | 1.5 |
| Caption | 11px | 400 | 1.4 |
| Button | 14px | 600 | 1 |

### Spacing System

- Base unit: 4px
- Common spacing: 8px, 12px, 16px, 24px, 32px
- Card gap: 16px
- Section margin: 24px
- Page padding: 16px (mobile), 24px (tablet+)

### Elevation (Shadows)

- **Cards:** `0 1px 3px rgba(0,0,0,0.08)`
- **Floating nav:** `0 4px 20px rgba(0,0,0,0.1)`
- **Modals:** `0 25px 50px -12px rgba(0,0,0,0.25)`

### Border Radius

- Cards: 12px
- Buttons: 8px
- Inputs: 12px
- Bottom nav: 24px (pill shape)
- Full rounded: 9999px

---

## Layout System

### Mobile-First Grid

- **Library/Browse:** 2 columns on mobile, 3 on tablet, 4-6 on desktop
- **Card aspect ratio:** 0.7 (manga cover standard)
- **Gutter:** 16px

### Floating Bottom Navigation

- Position: Fixed bottom, 20px margin from edges
- Style: White background, rounded pill shape (24px radius)
- Items: Icon + label, evenly distributed
- Active state: Primary text color, subtle background highlight

### Page Structure

```
Page Header (sticky optional)
├── Title + metadata
└── Action buttons (search, profile)

Content Area
├── Search/filter bar (where applicable)
└── Content grid/list

[Floating Bottom Nav]
```

---

## Components

### MangaCard

**Structure:**
```
┌─────────────────┐
│                 │
│   Cover Image   │  ← 0.7 aspect ratio, rounded top
│   (badge)       │  ← Chapter count badge top-right
│                 │
├─────────────────┤
│ Title           │  ← 13px, weight 600, single line ellipsis
│ Genre Tags      │  ← 11px, text-secondary
└─────────────────┘
```

**States:**
- Default: White background, subtle shadow
- Hover: Slight scale (1.02), deeper shadow
- Active: Press scale (0.98)

### SearchBar

- Background: surface color (#f5f5f5)
- Border radius: 12px
- Icon: Search emoji or SVG on left
- Placeholder text: text-secondary color
- Padding: 12px 16px

### BottomNav

- Background: white
- Border radius: 24px
- Padding: 12px 24px
- Box shadow: elevated
- Items: 4 max (Library, Browse, Downloads, Settings)
- Active: accent color, bold label

### ChapterListItem

- Background: white
- Padding: 16px
- Border radius: 8px
- Layout: Chapter info left, release date right
- Hover: Background darkens slightly

### Button

**Primary:**
- Background: accent
- Text: white
- Padding: 12px 24px
- Border radius: 8px

**Secondary:**
- Background: surface
- Text: text-primary
- Same sizing as primary

---

## Pages to Redesign

### 1. Library (`/library`)
- Header with title + manga count
- Search/filter bar
- 2-column grid of MangaCards
- Empty state message when no manga

### 2. Browse (`/browse`)
- Header with title
- Source selector (horizontal scroll pills)
- Search bar
- 2-column grid of MangaCards
- Loading states

### 3. Manga Details (`/manga/[id]`)
- Hero header with cover + gradient overlay
- Title, author, genres
- "Add to Library" / "In Library" toggle button
- Description text
- Chapter list (scrollable)
- Back navigation

### 4. Reader (`/reader/[chapterId]`)
- Immersive full-screen reading
- Tap zones for navigation
- Minimal top bar (manga title, page indicator)
- Bottom controls (prev/next, slider)

### 5. Downloads (`/downloads`)
- Header with title
- List of downloaded chapters
- Delete/manage actions

### 6. Settings (`/settings`)
- Grouped settings sections
- Toggle switches for preferences
- Clean list layout

---

## Implementation Notes

### CSS Strategy
- Use Tailwind CSS with custom theme configuration
- Add Plus Jakarta Sans via Google Fonts
- Configure Tailwind colors to match design tokens
- Use CSS variables for any dynamic theming

### Component Strategy
- Create shared `MangaCard` component
- Create `BottomNav` component with active state logic
- Create `SearchBar` component
- Update existing pages to use new components

### Animation
- Use CSS transitions for hover states (150ms ease)
- Scale cards on hover: `transform: scale(1.02)`
- Subtle opacity transitions for loading states

---

## Validation Checklist

- [ ] All pages use consistent spacing
- [ ] Typography hierarchy is clear
- [ ] Cards have proper hover states
- [ ] Bottom nav is floating with shadow
- [ ] Search bars are rounded
- [ ] Colors match design tokens
- [ ] Font is Plus Jakarta Sans throughout
- [ ] Mobile-first responsive