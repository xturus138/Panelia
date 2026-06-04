# Manga Reader Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Komiku scraper cover image, chapter count, and navigation in browse page.

**Architecture:** Tighten Komiku preset CSS selectors to match actual site structure (avoiding nav links and flag images), add cover URL validation with placeholder fallback, and use in-app reader routing instead of external tabs.

**Tech Stack:** Next.js, TypeScript, Dexie (IndexedDB)

---

### Task 1: Update Komiku preset

**Files:**
- Modify: `src/services/scrape/presets.ts` (lines 14-40)

- [ ] **Step 1: Edit Komiku config to use correct chapter and cover selectors**

Replace the Komiku preset config with verified selectors:

Old (lines 28-35):
```typescript
mangaPage: {
  title: 'h1',
  cover: 'img.wp-post-image, .thumb img, img',
  chapterList: 'a[href*="chapter" i]',
  chapterTitle: '',
  chapterUrl: '',
},
```

New:
```typescript
mangaPage: {
  title: 'h1',
  cover: '.ims img',
  chapterList: "table#Daftar_Chapter tbody tr[itemprop='itemListElement'] a",
  chapterTitle: '',
  chapterUrl: '',
},
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/services/scrape/presets.ts
git commit -m "fix(komiku): tighten cover and chapter-list selectors"
```

---

### Task 2: Fix chapter links in browse detail view

**Files:**
- Modify: `src/app/browse/page.tsx` (lines 506-519)

- [ ] **Step 1: Add Link import at top of file**

Find the existing imports (line 4-6) and add `Link` from next/navigation:

```typescript
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Wand2,
  Search as SearchIcon,
  BookOpen,
  Settings2,
  Library,
  Check,
} from "lucide-react";
import Link from "next/link";
```

- [ ] **Step 2: Replace `<a>` with `<Link>` in chapter list**

Old:
```tsx
{mangaData.chapters.map((ch) => (
  <a
    key={ch.id}
    href={ch.url}
    target="_blank"
    rel="noreferrer"
    className="block bg-card rounded-lg px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
  >
    <span className="font-medium">
      Chapter {ch.chapterNumber}
      {ch.title ? `: ${ch.title}` : ""}
    </span>
  </a>
))}
```

New:
```tsx
{mangaData.chapters.map((ch) => (
  <Link
    key={ch.id}
    href={`/reader/${ch.id}?manga=${mangaData.id}`}
    className="block bg-card rounded-lg px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
  >
    <span className="font-medium">
      Chapter {ch.chapterNumber}
      {ch.title ? `: ${ch.title}` : ""}
    </span>
  </Link>
))}
```

- [ ] **Step 3: Commit**

Run:
```bash
git add src/app/browse/page.tsx
git commit -m "fix(browse): use in-app reader link for chapters"
```

---

### Task 3: Add cover URL validation with fallback

**Files:**
- Modify: `src/app/browse/page.tsx` (add helper + integration in handleSelectResult and handleSave)

- [ ] **Step 1: Add `validateCoverUrl` helper function**

Add this function near the top of the component, after the existing `getAdapter` callback (after line 78):

```typescript
const NOISE_PATTERNS = [/\/jp\.png/, /\/kr\.png/, /\/cn\.png/, /\/logo/, /\/icon/];

async function validateCoverUrl(url: string): Promise<string> {
  const FALLBACK = "https://placehold.co/400x600/1a1a1a/cccccc?text=No+Cover";

  if (!url) return FALLBACK;

  // Check noise patterns
  if (NOISE_PATTERNS.some((p) => p.test(url))) return FALLBACK;

  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return FALLBACK;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return FALLBACK;

    return url;
  } catch {
    return FALLBACK;
  }
}
```

- [ ] **Step 2: Integrate validation into `handleSelectResult`**

In `handleSelectResult` (around line 120), after `adapter.parseMangaPage()` and before `setMangaData`, add validation:

```typescript
const parsed = adapter.parseMangaPage(processedHtml);

// Validate cover URL
parsed.coverUrl = await validateCoverUrl(parsed.coverUrl);

setMangaData(parsed);
setView("detail");
```

- [ ] **Step 3: Integrate validation into `handleSave`**

In `handleSave` (around line 173), before writing to `db.manga.put`, re-validate the cover:

```typescript
// Save manga to DB
const validatedCover = await validateCoverUrl(mangaData.coverUrl);
await db.manga.put({
  id: mangaData.id,
  sourceId: "scrape",
  title: mangaData.title,
  coverUrl: validatedCover,
  // ... rest stays the same
});
```

Since this also needs to update `mangaData.coverUrl` for any subsequent saves, add this line right after:
```typescript
mangaData.coverUrl = validatedCover; // keep in sync
```

- [ ] **Step 4: Commit**

Run:
```bash
git add src/app/browse/page.tsx
git commit -m "fix(browse): validate cover URL with placeholder fallback"
```
